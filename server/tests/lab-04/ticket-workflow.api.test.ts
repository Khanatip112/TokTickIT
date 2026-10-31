import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import type { TicketStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import {
  RESOLUTION_GATE_MESSAGE,
  STATUS_TRANSITIONS,
} from "../../src/controllers/ticketDetailController.js";

const prisma = getPrisma();
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const PASSWORD = "WorkflowPass123!";

const EMAIL = {
  staff: `workflow.staff.${STAMP}@toktickit.test`,
  admin: `workflow.admin.${STAMP}@toktickit.test`,
  requester: `workflow.requester.${STAMP}@toktickit.test`,
};

const createdUserIds: string[] = [];
const createdTicketIds: string[] = [];

let staffId = "";
let requesterId = "";

let categoryId = "";
let systemId = "";

/** Ticket ids per scenario, cleaned up in afterAll. */
const tid: Record<string, string> = {};

const STAFF_RESOLUTION_SUMMARY =
  "Replaced the faulty battery cell and updated the power management driver.";

async function createTestUser(
  email: string,
  fullName: string,
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"
) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      name: fullName,
      role,
      department: "Workflow Test",
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
  key: string,
  currentStatus: string,
  options: { resolutionSummary?: string } = {}
) {
  ticketCounter += 1;
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-WF-${STAMP}-${String(ticketCounter).padStart(3, "0")}`,
      requesterId,
      categoryId,
      relatedSystemId: systemId,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: currentStatus as TicketStatus,
      resolutionSummary: options.resolutionSummary ?? null,
      summary: `Workflow test ticket ${key}`,
      description: `Scenario ${key} for the Lab 4 status transition matrix tests.`,
    },
  });
  tid[key] = ticket.id;
  createdTicketIds.push(ticket.id);
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

  staffId = await createTestUser(EMAIL.staff, `Workflow Staff ${STAMP}`, "IT_STAFF");
  await createTestUser(EMAIL.admin, `Workflow Admin ${STAMP}`, "ADMINISTRATOR");
  requesterId = await createTestUser(
    EMAIL.requester,
    `Workflow Requester ${STAMP}`,
    "REQUESTER"
  );

  // Scenario fixtures.
  await createTicket("chain", "NEW");
  await createTicket("gateInProgress", "IN_PROGRESS");
  await createTicket("gateWaiting", "WAITING_FOR_REQUESTER");
  await createTicket("gateResolved", "RESOLVED", {
    resolutionSummary: "Resolved previously but without a recorded action.",
  });
  await createTicket("gatePass", "IN_PROGRESS");
  await createTicket("illegalNewResolved", "NEW");
  await createTicket("illegalNewClosed", "NEW");
  await createTicket("illegalCancelled", "CANCELLED");
  await createTicket("illegalResolved", "RESOLVED", {
    resolutionSummary: "Already resolved before the transition attempt.",
  });
  await createTicket("illegalInProgress", "IN_PROGRESS");
  await createTicket("noop", "OPEN");
  await createTicket("rbac", "NEW");
  await createTicket("advisory", "OPEN");
  await createTicket("matrixNew", "NEW");
  await createTicket("matrixCancelled", "CANCELLED");
  await createTicket("closed", "CLOSED", {
    resolutionSummary: "Closed after verification by the Administrator.",
  });
});

afterAll(async () => {
  if (createdTicketIds.length > 0) {
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
    await prisma.comment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

describe("BR-08 · Strict status transition matrix", () => {
  it("UNIT-03 · exports exactly the Issue 5 transition matrix", () => {
    expect(STATUS_TRANSITIONS.NEW).toEqual(["OPEN", "CANCELLED"]);
    expect(STATUS_TRANSITIONS.OPEN).toEqual([
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "CANCELLED",
    ]);
    expect(STATUS_TRANSITIONS.IN_PROGRESS).toEqual([
      "WAITING_FOR_REQUESTER",
      "RESOLVED",
      "CANCELLED",
    ]);
    expect(STATUS_TRANSITIONS.WAITING_FOR_REQUESTER).toEqual([
      "IN_PROGRESS",
      "RESOLVED",
      "CANCELLED",
    ]);
    expect(STATUS_TRANSITIONS.RESOLVED).toEqual(["CLOSED", "REOPENED"]);
    expect(STATUS_TRANSITIONS.CLOSED).toEqual(["REOPENED"]);
    expect(STATUS_TRANSITIONS.REOPENED).toEqual(["IN_PROGRESS", "RESOLVED"]);
    expect(STATUS_TRANSITIONS.CANCELLED).toEqual([]);
    expect(STATUS_TRANSITIONS.PENDING).toEqual([]);
  });

  it("API-11 · walks NEW → OPEN → IN_PROGRESS → RESOLVED → CLOSED in order", async () => {
    const staffAgent = await login(EMAIL.staff);
    const id = tid.chain;

    const opened = await staffAgent
      .patch(`/api/tickets/${id}/status`)
      .send({ currentStatus: "OPEN" });
    expect(opened.status).toBe(200);
    expect(opened.body.currentStatus).toBe("OPEN");

    const started = await staffAgent
      .patch(`/api/tickets/${id}/status`)
      .send({ currentStatus: "IN_PROGRESS" });
    expect(started.status).toBe(200);
    expect(started.body.currentStatus).toBe("IN_PROGRESS");

    // The Resolution Gate blocks formal resolution until work is documented.
    const blocked = await staffAgent
      .patch(`/api/tickets/${id}/status`)
      .send({ currentStatus: "RESOLVED", resolutionSummary: STAFF_RESOLUTION_SUMMARY });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe("UNPROCESSABLE_ENTITY");
    expect(blocked.body.error.message).toBe(RESOLUTION_GATE_MESSAGE);

    const action = await staffAgent.post(`/api/tickets/${id}/actions-taken`).send({
      description: "Replaced the battery cell and re-ran the power diagnostics.",
      result: "SUCCESS",
    });
    expect(action.status).toBe(201);

    const resolved = await staffAgent
      .patch(`/api/tickets/${id}/status`)
      .send({ currentStatus: "RESOLVED", resolutionSummary: STAFF_RESOLUTION_SUMMARY });
    expect(resolved.status).toBe(200);
    expect(resolved.body.currentStatus).toBe("RESOLVED");
    expect(resolved.body.resolutionSummary).toBe(STAFF_RESOLUTION_SUMMARY);

    const closed = await staffAgent
      .patch(`/api/tickets/${id}/status`)
      .send({ currentStatus: "CLOSED", resolutionSummary: STAFF_RESOLUTION_SUMMARY });
    expect(closed.status).toBe(200);
    expect(closed.body.currentStatus).toBe("CLOSED");

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row?.currentStatus).toBe("CLOSED");
  });

  it("API-09 · rejects an illegal NEW → RESOLVED jump with 422 and no mutation", async () => {
    const staffAgent = await login(EMAIL.staff);
    const id = tid.illegalNewResolved;

    const res = await staffAgent
      .patch(`/api/tickets/${id}/status`)
      .send({ currentStatus: "RESOLVED", resolutionSummary: STAFF_RESOLUTION_SUMMARY });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("UNPROCESSABLE_ENTITY");
    expect(res.body.error.message).toMatch(/from NEW to RESOLVED is not permitted/);

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row?.currentStatus).toBe("NEW");
    expect(row?.resolutionSummary).toBeNull();
  });

  it("API-10 · rejects an illegal NEW → CLOSED jump with 422", async () => {
    const staffAgent = await login(EMAIL.staff);
    const res = await staffAgent
      .patch(`/api/tickets/${tid.illegalNewClosed}/status`)
      .send({ currentStatus: "CLOSED", resolutionSummary: STAFF_RESOLUTION_SUMMARY });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/from NEW to CLOSED is not permitted/);
  });

  it("API-10 · treats CANCELLED as terminal (CANCELLED → OPEN is 422)", async () => {
    const staffAgent = await login(EMAIL.staff);
    const res = await staffAgent
      .patch(`/api/tickets/${tid.illegalCancelled}/status`)
      .send({ currentStatus: "OPEN" });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/from CANCELLED to OPEN is not permitted/);

    const row = await prisma.ticket.findUnique({ where: { id: tid.illegalCancelled } });
    expect(row?.currentStatus).toBe("CANCELLED");
  });

  it("API-10 · rejects backwards moves RESOLVED → IN_PROGRESS and IN_PROGRESS → OPEN", async () => {
    const staffAgent = await login(EMAIL.staff);

    const resolvedBack = await staffAgent
      .patch(`/api/tickets/${tid.illegalResolved}/status`)
      .send({ currentStatus: "IN_PROGRESS" });
    expect(resolvedBack.status).toBe(422);
    expect(resolvedBack.body.error.message).toMatch(
      /from RESOLVED to IN_PROGRESS is not permitted/
    );

    const inProgressBack = await staffAgent
      .patch(`/api/tickets/${tid.illegalInProgress}/status`)
      .send({ currentStatus: "OPEN" });
    expect(inProgressBack.status).toBe(422);
    expect(inProgressBack.body.error.message).toMatch(
      /from IN_PROGRESS to OPEN is not permitted/
    );

    const resolvedRow = await prisma.ticket.findUnique({ where: { id: tid.illegalResolved } });
    const inProgressRow = await prisma.ticket.findUnique({
      where: { id: tid.illegalInProgress },
    });
    expect(resolvedRow?.currentStatus).toBe("RESOLVED");
    expect(inProgressRow?.currentStatus).toBe("IN_PROGRESS");
  });

  it("rejects a no-op transition to the same status with 422", async () => {
    const staffAgent = await login(EMAIL.staff);
    const res = await staffAgent
      .patch(`/api/tickets/${tid.noop}/status`)
      .send({ currentStatus: "OPEN" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("UNPROCESSABLE_ENTITY");
  });
});

describe("BR-09 · Resolution Gate (>= 1 Action Taken required)", () => {
  it("API-09 · blocks RESOLVED from IN_PROGRESS when 0 Actions Taken exist", async () => {
    const staffAgent = await login(EMAIL.staff);
    const res = await staffAgent
      .patch(`/api/tickets/${tid.gateInProgress}/status`)
      .send({ currentStatus: "RESOLVED", resolutionSummary: STAFF_RESOLUTION_SUMMARY });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("UNPROCESSABLE_ENTITY");
    expect(res.body.error.message).toBe(
      "Cannot resolve or close a ticket without at least one recorded Action Taken."
    );

    const row = await prisma.ticket.findUnique({ where: { id: tid.gateInProgress } });
    expect(row?.currentStatus).toBe("IN_PROGRESS");
  });

  it("API-09 · blocks RESOLVED from WAITING_FOR_REQUESTER when 0 Actions Taken exist", async () => {
    const staffAgent = await login(EMAIL.staff);
    const res = await staffAgent
      .patch(`/api/tickets/${tid.gateWaiting}/status`)
      .send({ currentStatus: "RESOLVED", resolutionSummary: STAFF_RESOLUTION_SUMMARY });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe(RESOLUTION_GATE_MESSAGE);
  });

  it("API-10 · blocks CLOSED when the resolved ticket has no Actions Taken", async () => {
    const staffAgent = await login(EMAIL.staff);
    const res = await staffAgent
      .patch(`/api/tickets/${tid.gateResolved}/status`)
      .send({ currentStatus: "CLOSED", resolutionSummary: STAFF_RESOLUTION_SUMMARY });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("UNPROCESSABLE_ENTITY");
    expect(res.body.error.message).toBe(RESOLUTION_GATE_MESSAGE);

    const row = await prisma.ticket.findUnique({ where: { id: tid.gateResolved } });
    expect(row?.currentStatus).toBe("RESOLVED");
  });

  it("API-11 · allows RESOLVED once at least one Action Taken is recorded", async () => {
    const staffAgent = await login(EMAIL.staff);
    const id = tid.gatePass;

    const action = await staffAgent.post(`/api/tickets/${id}/actions-taken`).send({
      description: "Re-imaged the workstation and restored the user profile.",
      result: "SUCCESS",
    });
    expect(action.status).toBe(201);

    const res = await staffAgent
      .patch(`/api/tickets/${id}/status`)
      .send({ currentStatus: "RESOLVED", resolutionSummary: STAFF_RESOLUTION_SUMMARY });

    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("RESOLVED");

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row?.currentStatus).toBe("RESOLVED");
    expect(row?.resolutionSummary).toBe(STAFF_RESOLUTION_SUMMARY);
  });

  it("exposes actionsTakenCount and matrix-derived permittedTransitions on the detail endpoint", async () => {
    const staffAgent = await login(EMAIL.staff);

    const fresh = await staffAgent.get(`/api/staff/tickets/${tid.matrixNew}`);
    expect(fresh.status).toBe(200);
    expect(fresh.body.actionsTakenCount).toBe(0);
    expect(fresh.body.permittedTransitions.sort()).toEqual(["CANCELLED", "OPEN"].sort());

    const terminal = await staffAgent.get(`/api/staff/tickets/${tid.matrixCancelled}`);
    expect(terminal.status).toBe(200);
    expect(terminal.body.permittedTransitions).toEqual([]);
  });

  it("limits CLOSED → REOPENED to Administrators", async () => {
    const staffAgent = await login(EMAIL.staff);
    const staffAttempt = await staffAgent
      .patch(`/api/tickets/${tid.closed}/status`)
      .send({ currentStatus: "REOPENED" });
    expect(staffAttempt.status).toBe(403);

    const adminAgent = await login(EMAIL.admin);
    const adminAttempt = await adminAgent
      .patch(`/api/tickets/${tid.closed}/status`)
      .send({ currentStatus: "REOPENED" });
    expect(adminAttempt.status).toBe(200);
    expect(adminAttempt.body.currentStatus).toBe("REOPENED");
  });
});

describe("RBAC · only IT Staff and Administrators may transition status", () => {
  it("rejects a Requester on both status endpoints with 403 Forbidden", async () => {
    const requesterAgent = await login(EMAIL.requester);
    const id = tid.rbac;

    const canonical = await requesterAgent
      .patch(`/api/staff/tickets/${id}/status`)
      .send({ currentStatus: "OPEN" });
    expect(canonical.status).toBe(403);
    expect(canonical.body.error.code).toBe("FORBIDDEN");

    const alias = await requesterAgent
      .patch(`/api/tickets/${id}/status`)
      .send({ currentStatus: "OPEN" });
    expect(alias.status).toBe(403);
    expect(alias.body.error.code).toBe("FORBIDDEN");

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row?.currentStatus).toBe("NEW");
  });

  it("rejects a Requester attempting to change the owner or IT Priority", async () => {
    const requesterAgent = await login(EMAIL.requester);
    const id = tid.rbac;

    const assign = await requesterAgent
      .patch(`/api/tickets/${id}/assign`)
      .send({ ownerId: staffId });
    expect(assign.status).toBe(403);

    const priority = await requesterAgent
      .patch(`/api/tickets/${id}/priority`)
      .send({ itPriority: "URGENT" });
    expect(priority.status).toBe(403);

    const row = await prisma.ticket.findUnique({ where: { id } });
    expect(row?.assignedToId).toBeNull();
    expect(row?.itPriority).toBe("MEDIUM");
  });

  it("rejects an unauthenticated status update with 401", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${tid.rbac}/status`)
      .send({ currentStatus: "OPEN" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("BR-10 · Requester advisory indication", () => {
  it("records the indication without changing status and is Requester-only", async () => {
    const requesterAgent = await login(EMAIL.requester);
    const res = await requesterAgent
      .post(`/api/tickets/${tid.advisory}/resolve-indication`)
      .send({ note: "The printer is working again." });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Resolution indication recorded successfully");

    const row = await prisma.ticket.findUnique({ where: { id: tid.advisory } });
    // Advisory only — IT Staff still performs the formal transition (BR-10).
    expect(row?.currentStatus).toBe("OPEN");

    const staffAgent = await login(EMAIL.staff);
    const staffAttempt = await staffAgent
      .post(`/api/tickets/${tid.advisory}/resolve-indication`)
      .send({});
    expect(staffAttempt.status).toBe(403);
  });
});
