import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const PASSWORD = "CommentsPass123!";

const EMAIL = {
  staff: `comments.staff.${STAMP}@toktickit.test`,
  admin: `comments.admin.${STAMP}@toktickit.test`,
  otherStaff: `comments.otherstaff.${STAMP}@toktickit.test`,
  requester: `comments.requester.${STAMP}@toktickit.test`,
  otherRequester: `comments.requester2.${STAMP}@toktickit.test`,
};

const createdUserIds: string[] = [];
let staffId = "";
let adminId = "";
let otherStaffId = "";
let requesterId = "";
let otherRequesterId = "";
let categoryId = "";
let systemId = "";

const PREFIX = `C-${STAMP}`;

const tid: Record<string, string> = {};

async function createTestUser(email: string, fullName: string, role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR") {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: { email, fullName, name: fullName, role, department: "Comments Test", isActive: true, mustChangePassword: false, passwordHash },
  });
  createdUserIds.push(user.id);
  return user.id;
}

let ticketCounter = 0;
async function createTicket() {
  ticketCounter += 1;
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `${PREFIX}-${String(ticketCounter).padStart(3, "0")}`,
      requesterId,
      categoryId,
      relatedSystemId: systemId,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: "OPEN",
      summary: `Comments test ticket ${ticketCounter}`,
      description: `Scenario for Public Comments and Internal Notes tests.`,
    },
  });
  return ticket.id;
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  staffId = await createTestUser(EMAIL.staff, `Comments Staff ${STAMP}`, "IT_STAFF");
  adminId = await createTestUser(EMAIL.admin, `Comments Admin ${STAMP}`, "ADMINISTRATOR");
  otherStaffId = await createTestUser(EMAIL.otherStaff, `Comments Other Staff ${STAMP}`, "IT_STAFF");
  requesterId = await createTestUser(EMAIL.requester, `Comments Requester ${STAMP}`, "REQUESTER");
  otherRequesterId = await createTestUser(EMAIL.otherRequester, `Comments Other Requester ${STAMP}`, "REQUESTER");

  const category = await prisma.category.create({ data: { name: `Comments Category ${STAMP}`, description: "Comments/notes API tests" } });
  const system = await prisma.relatedSystem.create({ data: { name: `Comments System ${STAMP}`, code: `CSYS-${STAMP}`, description: "Comments/notes API tests" } });
  categoryId = category.id;
  systemId = system.id;
});

afterAll(async () => {
  const allTickets = await prisma.ticket.findMany({ where: { categoryId }, select: { id: true } });
  const ticketIds = allTickets.map((t) => t.id);
  await prisma.internalNote.deleteMany({ where: { ticketId: { in: ticketIds } } });
  await prisma.comment.deleteMany({ where: { ticketId: { in: ticketIds } } });
  await prisma.ticket.deleteMany({ where: { categoryId } });
  if (categoryId) await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
  if (systemId) await prisma.relatedSystem.delete({ where: { id: systemId } }).catch(() => undefined);
  if (createdUserIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("Issue 8 · RBAC and access baseline for comments/notes", () => {
  it("rejects an unauthenticated requester with 401 on public comments", async () => {
    const id = await createTicket();
    const res = await request(app).get(`/api/tickets/${id}/comments`);
    expect(res.status).toBe(401);
  });

  it("rejects a non-owner Requester on public comments with 403", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.otherRequester);
    const res = await agent.get(`/api/tickets/${id}/comments`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows the owning Requester to read public comments (empty list)", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.requester);
    const res = await agent.get(`/api/tickets/${id}/comments`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it("rejects a Requester on internal notes with 403", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.requester);
    const res = await agent.get(`/api/tickets/${id}/notes`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");

    // The denied response must not leak internal note existence or count.
    expect(res.body).not.toHaveProperty("notes");
    expect(res.body).not.toHaveProperty("count");
  });

  it("rejects a Requester on POST internal notes with 403", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.requester);
    const res = await agent.post(`/api/tickets/${id}/notes`).send({ content: "Should not be allowed." });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows an IT Staff member to read and create internal notes", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.staff);
    const created = await agent.post(`/api/tickets/${id}/notes`).send({ content: "Initial internal diagnostic note." });
    expect(created.status).toBe(201);
    expect(created.body.content).toBe("Initial internal diagnostic note.");
    expect(created.body.author).toMatchObject({ id: staffId, role: "IT_STAFF" });

    const listed = await agent.get(`/api/tickets/${id}/notes`);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].content).toBe("Initial internal diagnostic note.");
  });

  it("allows an Administrator to read and create internal notes", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.admin);
    const created = await agent.post(`/api/tickets/${id}/notes`).send({ content: "Admin escalation note." });
    expect(created.status).toBe(201);
    expect(created.body.author.role).toBe("ADMINISTRATOR");

    const listed = await agent.get(`/api/tickets/${id}/internal-notes`);
    expect(listed.status).toBe(200);
    expect(listed.body.some((note: any) => note.content === "Admin escalation note.")).toBe(true);
  });

  it("returns 404 for an unknown ticket on both comments and notes", async () => {
    const agent = await login(EMAIL.staff);
    const comments = await agent.get("/api/tickets/does-not-exist/comments");
    expect(comments.status).toBe(404);

    const notes = await agent.get("/api/tickets/does-not-exist/notes");
    expect(notes.status).toBe(404);
  });
});

describe("Issue 8 · Public Comments flow", () => {
  it("creates a public comment for the owning Requester and returns 201", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.requester);
    const created = await agent.post(`/api/tickets/${id}/comments`).send({ content: "Please check this ticket when possible." });
    expect(created.status).toBe(201);
    expect(created.body.content).toBe("Please check this ticket when possible.");
    expect(created.body.ticketId).toBe(id);
    expect(created.body.author).toMatchObject({ id: requesterId, role: "REQUESTER" });
  });

  it("allows IT Staff to append a public comment to the same ticket", async () => {
    const id = await createTicket();
    const staffAgent = await login(EMAIL.staff);
    const requesterAgent = await login(EMAIL.requester);
    await requesterAgent.post(`/api/tickets/${id}/comments`).send({ content: "First requester comment." });
    const staffComment = await staffAgent.post(`/api/tickets/${id}/comments`).send({ content: "We are looking into it." });
    expect(staffComment.status).toBe(201);
    expect(staffComment.body.author.role).toBe("IT_STAFF");
  });

  it("lists public comments newest-first is not required; server returns chronological order", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.staff);
    await agent.post(`/api/tickets/${id}/comments`).send({ content: "A" });
    await agent.post(`/api/tickets/${id}/comments`).send({ content: "B" });
    const listed = await agent.get(`/api/tickets/${id}/comments`);
    expect(listed.status).toBe(200);
    expect(listed.body.map((c: any) => c.content)).toEqual(["A", "B"]);
  });

  it("rejects empty content with 400", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.staff);
    const res = await agent.post(`/api/tickets/${id}/comments`).send({ content: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("rejects content longer than 2,000 characters with 400", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.staff);
    const longContent = "x".repeat(2001);
    const res = await agent.post(`/api/tickets/${id}/comments`).send({ content: longContent });
    expect(res.status).toBe(400);
  });

  it("returns 403 when a Requester comments on another requester's ticket", async () => {
    const id = await createTicket();
    const otherAgent = await login(EMAIL.otherRequester);
    const res = await otherAgent.post(`/api/tickets/${id}/comments`).send({ content: "Intruding." });
    expect(res.status).toBe(403);
  });
});

describe("Issue 8 · Internal Notes flow", () => {
  it("creates an internal note and returns 201 for an IT Staff member", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.staff);
    const created = await agent.post(`/api/tickets/${id}/notes`).send({ content: "Replacement part ordered." });
    expect(created.status).toBe(201);
    expect(created.body.ticketId).toBe(id);
    expect(created.body.author).toMatchObject({ id: staffId, role: "IT_STAFF" });
  });

  it("lists only internal notes for the ticket, not public comments", async () => {
    const id = await createTicket();
    const staffAgent = await login(EMAIL.staff);
    const requesterAgent = await login(EMAIL.requester);
    await requesterAgent.post(`/api/tickets/${id}/comments`).send({ content: "Public comment." });
    await staffAgent.post(`/api/tickets/${id}/notes`).send({ content: "Internal note." });
    const listed = await staffAgent.get(`/api/tickets/${id}/notes`);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].content).toBe("Internal note.");
  });

  it("rejects empty internal note content with 400", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.staff);
    const res = await agent.post(`/api/tickets/${id}/notes`).send({ content: "\t\n  " });
    expect(res.status).toBe(400);
  });

  it("rejects an internal note that is too long with 400", async () => {
    const id = await createTicket();
    const agent = await login(EMAIL.staff);
    const res = await agent.post(`/api/tickets/${id}/notes`).send({ content: "y".repeat(2001) });
    expect(res.status).toBe(400);
  });

  it("allows an IT Staff member to read internal notes on a ticket they did not create", async () => {
    const id = await createTicket();
    await login(EMAIL.staff).then((agent) => agent.post(`/api/tickets/${id}/notes`).send({ content: "Staff note A." }));
    const secondStaffAgent = await login(EMAIL.otherStaff);
    const listed = await secondStaffAgent.get(`/api/tickets/${id}/notes`);
    expect(listed.status).toBe(200);
    expect(listed.body.some((note: any) => note.content === "Staff note A.")).toBe(true);
  });
});
