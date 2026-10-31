import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import type { TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  OPEN_TICKET_STATUSES,
  RECENT_TICKETS_LIMIT,
} from "../../src/controllers/dashboardController.js";

const prisma = getPrisma();
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const PASSWORD = "DashboardPass123!";

const EMAIL = {
  requesterA: `dashboard.requester.a.${STAMP}@toktickit.test`,
  requesterB: `dashboard.requester.b.${STAMP}@toktickit.test`,
};

const createdUserIds: string[] = [];
const createdTicketIds: string[] = [];

let requesterAId = "";
let requesterBId = "";

let categoryId = "";
let systemId = "";

/** Ticket ids owned by Requester A. */
const requesterATicketIds: string[] = [];
/** Ticket ids owned by Requester B. */
const requesterBTicketIds: string[] = [];

let agentA: ReturnType<typeof request.agent>;
let agentB: ReturnType<typeof request.agent>;

async function createTestUser(email: string, fullName: string, role: "REQUESTER") {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      name: fullName,
      role,
      department: "Dashboard Test Dept",
      isActive: true,
      mustChangePassword: false,
      passwordHash,
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

let ticketCounter = 0;
async function createTicket(
  ownerId: string,
  status: TicketStatus,
  bucket: string[]
): Promise<string> {
  ticketCounter += 1;
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-DASH-${STAMP}-${String(ticketCounter).padStart(3, "0")}`,
      requesterId: ownerId,
      categoryId,
      relatedSystemId: systemId,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: status,
      summary: `Dashboard metric ticket ${status} ${ticketCounter}`,
      description: `Fixture for requester dashboard metric calculation (${status}).`,
    },
  });
  createdTicketIds.push(ticket.id);
  bucket.push(ticket.id);
  return ticket.id;
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  const category = await prisma.category.findFirst();
  const system = await prisma.relatedSystem.findFirst();
  if (!category || !system) {
    throw new Error("Seed categories and systems required before running tests.");
  }
  categoryId = category.id;
  systemId = system.id;

  requesterAId = await createTestUser(EMAIL.requesterA, "Dashboard Requester A", "REQUESTER");
  requesterBId = await createTestUser(EMAIL.requesterB, "Dashboard Requester B", "REQUESTER");

  agentA = await login(EMAIL.requesterA);
  agentB = await login(EMAIL.requesterB);

  // Requester A: 5 open-ish, 1 resolved, 1 closed, 1 cancelled = 8 tickets.
  await createTicket(requesterAId, "NEW", requesterATicketIds);
  await createTicket(requesterAId, "OPEN", requesterATicketIds);
  await createTicket(requesterAId, "IN_PROGRESS", requesterATicketIds);
  await createTicket(requesterAId, "WAITING_FOR_REQUESTER", requesterATicketIds);
  await createTicket(requesterAId, "REOPENED", requesterATicketIds);
  await createTicket(requesterAId, "RESOLVED", requesterATicketIds);
  await createTicket(requesterAId, "CLOSED", requesterATicketIds);
  await createTicket(requesterAId, "CANCELLED", requesterATicketIds);

  // Requester B: 2 open-ish, 1 resolved, 1 closed = 4 tickets.
  await createTicket(requesterBId, "NEW", requesterBTicketIds);
  await createTicket(requesterBId, "IN_PROGRESS", requesterBTicketIds);
  await createTicket(requesterBId, "RESOLVED", requesterBTicketIds);
  await createTicket(requesterBId, "CLOSED", requesterBTicketIds);
});

afterAll(async () => {
  if (createdTicketIds.length > 0) {
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

describe("Lab 4 — GET /api/dashboards/requester", () => {
  it("API-12 · returns accurate metrics for the authenticated Requester", async () => {
    const res = await agentA.get("/api/dashboards/requester");

    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data).toBeDefined();
    expect(data.totalOpenTickets).toBe(5);
    expect(data.inProgressCount).toBe(1);
    expect(data.waitingForRequesterCount).toBe(1);
    expect(data.recentlyResolvedCount).toBe(1);
    expect(data.closedTicketsCount).toBe(1);
    expect(data.recentlyUpdatedCount).toBe(8);

    // Mission-facing aliases mirror the authoritative counts.
    expect(data.ticketsWaitingForRequester).toBe(data.waitingForRequesterCount);
    expect(data.recentlyResolvedTickets).toBe(data.recentlyResolvedCount);
    expect(data.recentlyUpdatedTickets).toBe(data.recentlyUpdatedCount);
  });

  it("API-13 · recentTickets is limited to 5, ordered by updatedAt DESC, and shape-complete", async () => {
    const res = await agentA.get("/api/dashboards/requester");

    expect(res.status).toBe(200);
    const tickets = res.body.data.recentTickets as Array<Record<string, unknown>>;

    expect(Array.isArray(tickets)).toBe(true);
    expect(tickets).toHaveLength(RECENT_TICKETS_LIMIT);

    for (const ticket of tickets) {
      expect(typeof ticket.id).toBe("string");
      expect(typeof ticket.ticketNumber).toBe("string");
      expect(typeof ticket.summary).toBe("string");
      expect(typeof ticket.currentStatus).toBe("string");
      expect(typeof ticket.requestedPriority).toBe("string");
      expect(ticket.category).toBeTruthy();
      expect(ticket).toHaveProperty("assignedTo");
      expect(typeof ticket.updatedAt).toBe("string");
      expect(typeof ticket.createdAt).toBe("string");
      expect(requesterATicketIds).toContain(ticket.id);
    }

    const timestamps = tickets.map((ticket) => new Date(ticket.updatedAt as string).getTime());
    const sortedDesc = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sortedDesc);
  });

  it("AC-08 · isolates metrics and recent tickets to the authenticated Requester", async () => {
    const resA = await agentA.get("/api/dashboards/requester");
    const resB = await agentB.get("/api/dashboards/requester");

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const dataA = resA.body.data;
    const dataB = resB.body.data;

    expect(dataA.totalOpenTickets).toBe(5);
    expect(dataB.totalOpenTickets).toBe(2);
    expect(dataB.inProgressCount).toBe(1);
    expect(dataB.waitingForRequesterCount).toBe(0);
    expect(dataB.recentlyResolvedCount).toBe(1);
    expect(dataB.closedTicketsCount).toBe(1);
    expect(dataB.recentlyUpdatedCount).toBe(4);

    const recentAIds = (dataA.recentTickets as Array<{ id: string }>).map((t) => t.id);
    const recentBIds = (dataB.recentTickets as Array<{ id: string }>).map((t) => t.id);

    expect(recentAIds.every((id) => requesterATicketIds.includes(id))).toBe(true);
    expect(recentAIds.some((id) => requesterBTicketIds.includes(id))).toBe(false);

    expect(recentBIds.every((id) => requesterBTicketIds.includes(id))).toBe(true);
    expect(recentBIds.some((id) => requesterATicketIds.includes(id))).toBe(false);
  });

  it("ignores a spoofed requesterId query parameter and uses the session identity", async () => {
    const res = await agentA.get(
      `/api/dashboards/requester?requesterId=${encodeURIComponent(requesterBId)}`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.totalOpenTickets).toBe(5);
    const recentIds = (res.body.data.recentTickets as Array<{ id: string }>).map((t) => t.id);
    expect(recentIds.some((id) => requesterBTicketIds.includes(id))).toBe(false);
  });

  it("returns 401 Unauthorized when unauthenticated", async () => {
    const res = await request(app).get("/api/dashboards/requester");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("UNIT-04 · exports the documented open-status set", () => {
    expect([...OPEN_TICKET_STATUSES]).toEqual([
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "REOPENED",
    ]);
  });
});
