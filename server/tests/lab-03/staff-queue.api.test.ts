import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const PASSWORD = "StaffPass123!";

const EMAIL = {
  staff: `queue.staff.${STAMP}@toktickit.test`,
  otherStaff: `queue.staff2.${STAMP}@toktickit.test`,
  requester: `queue.requester.${STAMP}@toktickit.test`,
  admin: `queue.admin.${STAMP}@toktickit.test`,
};

const createdUserIds: string[] = [];
let staffId = "";
let requesterId = "";
let adminId = "";
let categoryId = "";
let systemId = "";

const PREFIX = `Q-${STAMP}`;
const TICKET_COUNT = 12;

const STATUSES = ["NEW", "OPEN", "IN_PROGRESS"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

async function createTestUser(email: string, fullName: string, role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR") {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: { email, fullName, name: fullName, role, department: "Queue Test", isActive: true, mustChangePassword: false, passwordHash },
  });
  createdUserIds.push(user.id);
  return user.id;
}

function ticketNumber(i: number): string {
  return `${PREFIX}-${String(i).padStart(3, "0")}`;
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  staffId = await createTestUser(EMAIL.staff, `Queue Staff ${STAMP}`, "IT_STAFF");
  await createTestUser(EMAIL.otherStaff, `Queue Staff Two ${STAMP}`, "IT_STAFF");
  requesterId = await createTestUser(EMAIL.requester, `Queue Requester ${STAMP}`, "REQUESTER");
  adminId = await createTestUser(EMAIL.admin, `Queue Admin ${STAMP}`, "ADMINISTRATOR");

  const category = await prisma.category.create({ data: { name: `Queue Category ${STAMP}`, description: "Queue tests" } });
  const system = await prisma.relatedSystem.create({
    data: { name: `Queue System ${STAMP}`, code: `QSYS-${STAMP}`, description: "Queue tests" },
  });
  categoryId = category.id;
  systemId = system.id;

  const base = Date.now() - TICKET_COUNT * 60_000;
  for (let i = 0; i < TICKET_COUNT; i += 1) {
    await prisma.ticket.create({
      data: {
        ticketNumber: ticketNumber(i),
        requesterId,
        assignedToId: i % 2 === 0 ? staffId : null,
        categoryId,
        relatedSystemId: systemId,
        requestedPriority: PRIORITIES[i % PRIORITIES.length],
        itPriority: PRIORITIES[i % PRIORITIES.length],
        currentStatus: STATUSES[i % STATUSES.length],
        summary: `Queue Test Ticket ${i}`,
        description: i === 3 ? "Contains the UNIQUEDESCTOKEN marker for description search." : `Queue description number ${i}`,
        createdAt: new Date(base + i * 60_000),
        updatedAt: new Date(base + i * 60_000),
      },
    });
  }
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { categoryId } });
  if (categoryId) await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
  if (systemId) await prisma.relatedSystem.delete({ where: { id: systemId } }).catch(() => undefined);
  if (createdUserIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("API-08 · RBAC protection on GET /api/staff/tickets", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/staff/tickets");
    expect(res.status).toBe(401);
  });

  it("rejects a Requester with 403 Forbidden", async () => {
    const agent = await login(EMAIL.requester);
    const res = await agent.get("/api/staff/tickets");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows an IT Staff member with 200 OK", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.get("/api/staff/tickets");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("allows an Administrator with 200 OK", async () => {
    const agent = await login(EMAIL.admin);
    const res = await agent.get("/api/staff/tickets");
    expect(res.status).toBe(200);
  });
});

describe("API-09 · GET /api/staff/tickets (listing, search, filters)", () => {
  it("returns data rows enriched with requester, category, and owner, plus pagination metadata", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.get("/api/staff/tickets").query({ search: PREFIX, pageSize: 50 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(TICKET_COUNT);
    expect(res.body.pagination).toMatchObject({
      totalCount: TICKET_COUNT,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    const row = res.body.data.find((t: any) => t.ticketNumber === ticketNumber(0));
    expect(row.requester.name).toBe(`Queue Requester ${STAMP}`);
    expect(row.category.name).toBe(`Queue Category ${STAMP}`);
    expect(row.owner.name).toBe(`Queue Staff ${STAMP}`);
    expect(typeof row.activeAttachmentsCount).toBe("number");
    expect(typeof row.publicCommentsCount).toBe("number");
    expect(typeof row.internalNotesCount).toBe("number");
  });

  it("defaults to newest-first ordering (createdAt desc)", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.get("/api/staff/tickets").query({ search: PREFIX, pageSize: 50 });

    const numbers = res.body.data.map((t: any) => t.ticketNumber);
    expect(numbers[0]).toBe(ticketNumber(TICKET_COUNT - 1));
    expect(numbers[numbers.length - 1]).toBe(ticketNumber(0));
  });

  it("searches across ticket number, summary, and description", async () => {
    const agent = await login(EMAIL.staff);

    const byNumber = await agent.get("/api/staff/tickets").query({ search: ticketNumber(5) });
    expect(byNumber.body.data).toHaveLength(1);
    expect(byNumber.body.data[0].ticketNumber).toBe(ticketNumber(5));

    const bySummary = await agent.get("/api/staff/tickets").query({ q: "Queue Test Ticket 7" });
    expect(bySummary.body.data.some((t: any) => t.ticketNumber === ticketNumber(7))).toBe(true);

    const byDescription = await agent.get("/api/staff/tickets").query({ search: "UNIQUEDESCTOKEN" });
    expect(byDescription.body.data).toHaveLength(1);
    expect(byDescription.body.data[0].ticketNumber).toBe(ticketNumber(3));
  });

  it("filters by category", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.get("/api/staff/tickets").query({ categoryId, pageSize: 50 });

    expect(res.body.pagination.totalCount).toBe(TICKET_COUNT);
    expect(res.body.data.every((t: any) => t.category.id === categoryId)).toBe(true);
  });

  it("filters by status", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.get("/api/staff/tickets").query({ categoryId, status: "NEW", pageSize: 50 });

    expect(res.body.pagination.totalCount).toBe(4);
    expect(res.body.data.every((t: any) => t.currentStatus === "NEW")).toBe(true);
  });

  it("filters by IT priority and requested priority", async () => {
    const agent = await login(EMAIL.staff);

    const byIt = await agent.get("/api/staff/tickets").query({ categoryId, itPriority: "URGENT", pageSize: 50 });
    expect(byIt.body.pagination.totalCount).toBe(3);
    expect(byIt.body.data.every((t: any) => t.itPriority === "URGENT")).toBe(true);

    const byRequested = await agent
      .get("/api/staff/tickets")
      .query({ categoryId, requestedPriority: "LOW", pageSize: 50 });
    expect(byRequested.body.pagination.totalCount).toBe(3);
    expect(byRequested.body.data.every((t: any) => t.requestedPriority === "LOW")).toBe(true);
  });

  it("filters by owner: unassigned and specific staff", async () => {
    const agent = await login(EMAIL.staff);

    const unassigned = await agent
      .get("/api/staff/tickets")
      .query({ categoryId, ownerId: "unassigned", pageSize: 50 });
    expect(unassigned.body.pagination.totalCount).toBe(6);
    expect(unassigned.body.data.every((t: any) => t.owner === null)).toBe(true);

    const assigned = await agent
      .get("/api/staff/tickets")
      .query({ categoryId, ownerId: staffId, pageSize: 50 });
    expect(assigned.body.pagination.totalCount).toBe(6);
    expect(assigned.body.data.every((t: any) => t.owner && t.owner.id === staffId)).toBe(true);
  });

  it("supports the owner=me alias for the authenticated staff member", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.get("/api/staff/tickets").query({ categoryId, owner: "me", pageSize: 50 });

    expect(res.body.pagination.totalCount).toBe(6);
    expect(res.body.data.every((t: any) => t.owner && t.owner.id === staffId)).toBe(true);
  });
});

describe("API-10 · GET /api/staff/tickets (sorting + pagination)", () => {
  it("sorts by ticketNumber ascending and descending", async () => {
    const agent = await login(EMAIL.staff);

    const asc = await agent
      .get("/api/staff/tickets")
      .query({ categoryId, sortBy: "ticketNumber", sortOrder: "asc", pageSize: 50 });
    expect(asc.body.data[0].ticketNumber).toBe(ticketNumber(0));
    expect(asc.body.data[asc.body.data.length - 1].ticketNumber).toBe(ticketNumber(TICKET_COUNT - 1));

    const desc = await agent
      .get("/api/staff/tickets")
      .query({ categoryId, sortBy: "ticketNumber", sortOrder: "desc", pageSize: 50 });
    expect(desc.body.data[0].ticketNumber).toBe(ticketNumber(TICKET_COUNT - 1));
  });

  it("sorts by itPriority when requested", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .get("/api/staff/tickets")
      .query({ categoryId, sortBy: "itPriority", sortOrder: "asc", pageSize: 50 });

    expect(res.body.data[0].itPriority).toBe("LOW");
    expect(res.body.data[res.body.data.length - 1].itPriority).toBe("URGENT");
  });

  it("paginates with page and pageSize (default 10)", async () => {
    const agent = await login(EMAIL.staff);

    const page1 = await agent
      .get("/api/staff/tickets")
      .query({ categoryId, sortBy: "ticketNumber", sortOrder: "asc", page: 1, pageSize: 5 });
    expect(page1.body.data).toHaveLength(5);
    expect(page1.body.pagination).toMatchObject({
      totalCount: TICKET_COUNT,
      page: 1,
      pageSize: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });

    const page3 = await agent
      .get("/api/staff/tickets")
      .query({ categoryId, page: 3, pageSize: 5 });
    expect(page3.body.data).toHaveLength(2);
    expect(page3.body.pagination).toMatchObject({ page: 3, hasNextPage: false, hasPreviousPage: true });
  });

  it("accepts the limit alias and clamps to the 50 max", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.get("/api/staff/tickets").query({ categoryId, limit: 999 });
    expect(res.body.pagination.pageSize).toBe(50);
  });
});

describe("API-11 · GET /api/staff/users (assignment lookup)", () => {
  it("returns active IT Staff and Administrators for Requesters", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.get("/api/staff/users");

    expect(res.status).toBe(200);
    const ids = res.body.map((u: any) => u.id);
    expect(ids).toContain(staffId);
    expect(ids).toContain(adminId);
    expect(ids).not.toContain(requesterId);
    expect(res.body.every((u: any) => u.role === "IT_STAFF" || u.role === "ADMINISTRATOR")).toBe(true);
  });

  it("rejects a Requester with 403 Forbidden", async () => {
    const agent = await login(EMAIL.requester);
    const res = await agent.get("/api/staff/users");
    expect(res.status).toBe(403);
  });
});