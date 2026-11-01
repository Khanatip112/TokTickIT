import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import type { Priority, TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  STAFF_ASSIGNED_STATUSES,
  STAFF_INACTIVE_STATUSES,
  STAFF_PRIORITY_KEYS,
  STAFF_RECENT_TICKETS_LIMIT,
  STAFF_STATUS_KEYS,
  STAFF_UNASSIGNED_STATUSES,
} from "../../src/controllers/staffDashboardController.js";

const prisma = getPrisma();
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const PASSWORD = "StaffDashPass123!";

const EMAIL = {
  requester: `staff.dashboard.requester.${STAMP}@toktickit.test`,
  staff: `staff.dashboard.staff.${STAMP}@toktickit.test`,
  admin: `staff.dashboard.admin.${STAMP}@toktickit.test`,
};

const createdUserIds: string[] = [];
const createdTicketIds: string[] = [];

let requesterId = "";
let staffId = "";

let categoryId = "";
let systemId = "";

let staffAgent: ReturnType<typeof request.agent>;
let adminAgent: ReturnType<typeof request.agent>;
let requesterAgent: ReturnType<typeof request.agent>;

interface RecentTicket {
  id: string;
  ticketNumber: string;
  summary: string;
  currentStatus: TicketStatus;
  requestedPriority: Priority;
  itPriority: Priority;
  category: { id: string; name: string };
  requester: { id: string; fullName: string };
  assignedTo: { id: string; fullName: string } | null;
  updatedAt: string;
  createdAt: string;
}

interface UserSummary {
  activeRequestersCount: number;
  activeStaffCount: number;
  totalUsersCount: number;
}

interface UserAccountStats {
  totalUsersCount: number;
  activeUsersCount: number;
  inactiveUsersCount: number;
  byRole: { REQUESTER: number; IT_STAFF: number; ADMINISTRATOR: number };
}

interface StaffDashboardData {
  unassignedCount: number;
  assignedToMeCount: number;
  inProgressCount: number;
  waitingRequesterCount: number;
  urgentPriorityCount: number;
  resolvedTodayCount: number;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  recentTickets: RecentTicket[];
  userSummary: UserSummary | null;
  userAccountStats: UserAccountStats | null;
  unassignedTicketsCount: number;
  myAssignedTicketsCount: number;
  waitingForRequesterCount: number;
  itPriorityBreakdown: Record<string, number>;
  recentlyUpdatedTickets: RecentTicket[];
}

const PRIORITY_RANK: Record<Priority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
};

async function createTestUser(
  email: string,
  fullName: string,
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"
): Promise<string> {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      name: fullName,
      role,
      department: "Staff Dashboard Test Dept",
      isActive: true,
      mustChangePassword: false,
      passwordHash,
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

let ticketCounter = 0;
async function createTicket(options: {
  status: TicketStatus;
  itPriority?: Priority;
  requestedPriority?: Priority;
  assignedToId?: string | null;
}): Promise<string> {
  ticketCounter += 1;
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-STAFFDASH-${STAMP}-${String(ticketCounter).padStart(3, "0")}`,
      requesterId,
      categoryId,
      relatedSystemId: systemId,
      requestedPriority: options.requestedPriority ?? "MEDIUM",
      itPriority: options.itPriority ?? "MEDIUM",
      currentStatus: options.status,
      assignedToId: options.assignedToId ?? null,
      summary: `Staff dashboard fixture ${options.status} ${ticketCounter}`,
      description: `Fixture for the IT Staff dashboard metric calculation (${options.status}).`,
    },
  });
  createdTicketIds.push(ticket.id);
  return ticket.id;
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

async function getDashboard(agent: ReturnType<typeof request.agent>) {
  const res = await agent.get("/api/dashboards/staff");
  expect(res.status).toBe(200);
  return res.body.data as StaffDashboardData;
}

beforeAll(async () => {
  const category = await prisma.category.findFirst();
  const system = await prisma.relatedSystem.findFirst();
  if (!category || !system) {
    throw new Error("Seed categories and systems required before running tests.");
  }
  categoryId = category.id;
  systemId = system.id;

  requesterId = await createTestUser(EMAIL.requester, "Staff Dashboard Requester", "REQUESTER");
  staffId = await createTestUser(EMAIL.staff, "Staff Dashboard Technician", "IT_STAFF");
  await createTestUser(EMAIL.admin, "Staff Dashboard Administrator", "ADMINISTRATOR");

  staffAgent = await login(EMAIL.staff);
  adminAgent = await login(EMAIL.admin);
  requesterAgent = await login(EMAIL.requester);

  // Unassigned + open/active (4 tickets).
  await createTicket({ status: "NEW" });
  await createTicket({ status: "OPEN", itPriority: "HIGH" });
  await createTicket({ status: "IN_PROGRESS", itPriority: "URGENT" });
  await createTicket({ status: "REOPENED", itPriority: "LOW" });

  // Assigned to the logged-in IT Staff member (4 active + 1 resolved).
  await createTicket({ status: "OPEN", assignedToId: staffId });
  await createTicket({ status: "IN_PROGRESS", itPriority: "URGENT", assignedToId: staffId });
  await createTicket({ status: "WAITING_FOR_REQUESTER", itPriority: "HIGH", assignedToId: staffId });
  await createTicket({ status: "REOPENED", itPriority: "LOW", assignedToId: staffId });
  await createTicket({ status: "RESOLVED", itPriority: "URGENT", assignedToId: staffId });

  // Inactive / non-counted statuses (3 tickets).
  await createTicket({ status: "CLOSED", itPriority: "URGENT" });
  await createTicket({ status: "CANCELLED", itPriority: "URGENT" });
  await createTicket({ status: "PENDING" });
});

afterAll(async () => {
  if (createdTicketIds.length > 0) {
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

describe("Lab 4 — GET /api/dashboards/staff", () => {
  it("API-14 · returns accurate operational metrics for IT_STAFF", async () => {
    const data = await getDashboard(staffAgent);

    // "Assigned to me" is scoped to this test's unique staff identity, so it is
    // deterministic even when other suites share the database: 4 active tickets
    // are assigned to the technician (the RESOLVED one is excluded).
    expect(data.assignedToMeCount).toBe(4);
    expect(data.myAssignedTicketsCount).toBe(4);

    // Globally-scoped metrics include this suite's fixtures. Exact totals are
    // intentionally not asserted because sibling suites mutate the same tables
    // in parallel.
    expect(data.unassignedCount).toBeGreaterThanOrEqual(4);
    expect(data.inProgressCount).toBeGreaterThanOrEqual(2);
    expect(data.waitingRequesterCount).toBeGreaterThanOrEqual(1);
    expect(data.urgentPriorityCount).toBeGreaterThanOrEqual(2);
    expect(data.resolvedTodayCount).toBeGreaterThanOrEqual(1);

    // Every status key is present with a stable numeric shape.
    for (const status of STAFF_STATUS_KEYS) {
      expect(typeof data.statusBreakdown[status]).toBe("number");
    }
    expect(data.statusBreakdown.NEW).toBeGreaterThanOrEqual(1);
    expect(data.statusBreakdown.OPEN).toBeGreaterThanOrEqual(2);
    expect(data.statusBreakdown.IN_PROGRESS).toBeGreaterThanOrEqual(2);
    expect(data.statusBreakdown.WAITING_FOR_REQUESTER).toBeGreaterThanOrEqual(1);
    expect(data.statusBreakdown.REOPENED).toBeGreaterThanOrEqual(2);
    expect(data.statusBreakdown.RESOLVED).toBeGreaterThanOrEqual(1);
    expect(data.statusBreakdown.CLOSED).toBeGreaterThanOrEqual(1);
    expect(data.statusBreakdown.CANCELLED).toBeGreaterThanOrEqual(1);
    expect(data.statusBreakdown.PENDING).toBeGreaterThanOrEqual(1);

    // Every IT priority key is present with a stable numeric shape.
    for (const priority of STAFF_PRIORITY_KEYS) {
      expect(typeof data.priorityBreakdown[priority]).toBe("number");
    }
    expect(data.priorityBreakdown.LOW).toBeGreaterThanOrEqual(2);
    expect(data.priorityBreakdown.MEDIUM).toBeGreaterThanOrEqual(3);
    expect(data.priorityBreakdown.HIGH).toBeGreaterThanOrEqual(2);
    expect(data.priorityBreakdown.URGENT).toBeGreaterThanOrEqual(5);

    // Mission-facing aliases mirror the authoritative values.
    expect(data.unassignedTicketsCount).toBe(data.unassignedCount);
    expect(data.myAssignedTicketsCount).toBe(data.assignedToMeCount);
    expect(data.waitingForRequesterCount).toBe(data.waitingRequesterCount);
    expect(data.itPriorityBreakdown).toEqual(data.priorityBreakdown);
    expect(data.recentlyUpdatedTickets).toEqual(data.recentTickets);
  });

  it("API-15 · recentTickets is limited, shape-complete, and ordered by IT priority then recency", async () => {
    const data = await getDashboard(staffAgent);
    const tickets = data.recentTickets;

    expect(Array.isArray(tickets)).toBe(true);
    expect(tickets.length).toBeLessThanOrEqual(STAFF_RECENT_TICKETS_LIMIT);
    expect(tickets.length).toBeGreaterThan(0);

    for (const ticket of tickets) {
      expect(typeof ticket.id).toBe("string");
      expect(typeof ticket.ticketNumber).toBe("string");
      expect(typeof ticket.summary).toBe("string");
      expect(typeof ticket.currentStatus).toBe("string");
      expect(typeof ticket.itPriority).toBe("string");
      expect(ticket.category).toBeTruthy();
      expect(ticket.requester).toBeTruthy();
      expect(ticket).toHaveProperty("assignedTo");
      expect(typeof ticket.updatedAt).toBe("string");
      expect(typeof ticket.createdAt).toBe("string");
    }

    const ranks = tickets.map((ticket) => PRIORITY_RANK[ticket.itPriority]);
    const sortedDesc = [...ranks].sort((a, b) => b - a);
    expect(ranks).toEqual(sortedDesc);
  });

  it("API-16 · ADMINISTRATOR receives user account statistics", async () => {
    const data = await getDashboard(adminAgent);

    expect(data.userSummary).not.toBeNull();
    expect(data.userAccountStats).not.toBeNull();

    const summary = data.userSummary;
    const stats = data.userAccountStats;
    if (!summary || !stats) throw new Error("Administrator account statistics are required.");

    // Both representations are derived from the same authoritative count.
    expect(summary.totalUsersCount).toBe(stats.totalUsersCount);
    expect(stats.activeUsersCount + stats.inactiveUsersCount).toBe(stats.totalUsersCount);

    // This suite's requester, technician, and administrator are represented.
    expect(stats.totalUsersCount).toBeGreaterThanOrEqual(3);
    expect(stats.activeUsersCount).toBeGreaterThanOrEqual(3);
    expect(stats.byRole.REQUESTER).toBeGreaterThanOrEqual(1);
    expect(stats.byRole.IT_STAFF).toBeGreaterThanOrEqual(1);
    expect(stats.byRole.ADMINISTRATOR).toBeGreaterThanOrEqual(1);
    expect(summary.activeRequestersCount).toBeGreaterThanOrEqual(1);
    expect(summary.activeStaffCount).toBeGreaterThanOrEqual(1);
  });

  it("API-17 · IT_STAFF does not receive administrator account statistics", async () => {
    const data = await getDashboard(staffAgent);

    expect(data.userSummary).toBeNull();
    expect(data.userAccountStats).toBeNull();
  });

  it("AC-22 · rejects REQUESTER access with 403 Forbidden", async () => {
    const res = await requesterAgent.get("/api/dashboards/staff");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 Unauthorized when unauthenticated", async () => {
    const res = await request(app).get("/api/dashboards/staff");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("UNIT-05 · exports the documented metric status sets", () => {
    expect([...STAFF_UNASSIGNED_STATUSES]).toEqual([
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "REOPENED",
    ]);
    expect([...STAFF_ASSIGNED_STATUSES]).toEqual([
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "REOPENED",
    ]);
    expect([...STAFF_INACTIVE_STATUSES]).toEqual(["RESOLVED", "CLOSED", "CANCELLED"]);
  });
});
