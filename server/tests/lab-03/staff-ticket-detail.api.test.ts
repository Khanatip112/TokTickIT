import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const PASSWORD = "DetailPass123!";

const EMAIL = {
  staff: `detail.staff.${STAMP}@toktickit.test`,
  staff2: `detail.staff2.${STAMP}@toktickit.test`,
  admin: `detail.admin.${STAMP}@toktickit.test`,
  requester: `detail.requester.${STAMP}@toktickit.test`,
  otherRequester: `detail.requester2.${STAMP}@toktickit.test`,
  inactiveStaff: `detail.inactive.${STAMP}@toktickit.test`,
};

const createdUserIds: string[] = [];
let staffId = "";
let staff2Id = "";
let requesterId = "";
let otherRequesterUserId = "";
let inactiveStaffId = "";
let categoryId = "";
let systemId = "";

const PREFIX = `D-${STAMP}`;

/** Ticket ids per scenario, cleaned up in afterAll. */
const tid: Record<string, string> = {};

async function createTestUser(
  email: string,
  fullName: string,
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR",
  isActive = true
) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      name: fullName,
      role,
      department: "Detail Test",
      isActive,
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
  data: {
    currentStatus: string;
    assignedToId?: string | null;
    requestedPriority?: string;
    itPriority?: string;
    resolutionSummary?: string | null;
    requesterOwnerId?: string;
  }
) {
  ticketCounter += 1;
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `${PREFIX}-${String(ticketCounter).padStart(3, "0")}`,
      requesterId: data.requesterOwnerId ?? requesterId,
      assignedToId: data.assignedToId ?? null,
      categoryId,
      relatedSystemId: systemId,
      requestedPriority: (data.requestedPriority ?? "MEDIUM") as any,
      itPriority: (data.itPriority ?? data.requestedPriority ?? "MEDIUM") as any,
      currentStatus: data.currentStatus as any,
      resolutionSummary: data.resolutionSummary ?? null,
      summary: `Detail test ticket ${key}`,
      description: `Scenario ${key} for staff ticket detail tests.`,
    },
  });
  tid[key] = ticket.id;
  return ticket.id;
}

async function login(email: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  staffId = await createTestUser(EMAIL.staff, `Detail Staff ${STAMP}`, "IT_STAFF");
  staff2Id = await createTestUser(EMAIL.staff2, `Detail Staff Two ${STAMP}`, "IT_STAFF");
  await createTestUser(EMAIL.admin, `Detail Admin ${STAMP}`, "ADMINISTRATOR");
  requesterId = await createTestUser(EMAIL.requester, `Detail Requester ${STAMP}`, "REQUESTER");
  otherRequesterUserId = await createTestUser(
    EMAIL.otherRequester,
    `Detail Other Requester ${STAMP}`,
    "REQUESTER"
  );
  inactiveStaffId = await createTestUser(
    EMAIL.inactiveStaff,
    `Detail Inactive Staff ${STAMP}`,
    "IT_STAFF",
    false
  );

  const category = await prisma.category.create({
    data: { name: `Detail Category ${STAMP}`, description: "Staff detail tests" },
  });
  const system = await prisma.relatedSystem.create({
    data: { name: `Detail System ${STAMP}`, code: `DSYS-${STAMP}`, description: "Staff detail tests" },
  });
  categoryId = category.id;
  systemId = system.id;

  // Claim scenarios
  await createTicket("claimUnassigned", { currentStatus: "NEW" });
  // Assign scenarios
  await createTicket("assignOpen", { currentStatus: "OPEN" });
  await createTicket("assignNew", { currentStatus: "NEW" });
  // Priority scenario: requested LOW, IT priority LOW
  await createTicket("priority", {
    currentStatus: "OPEN",
    assignedToId: staffId,
    requestedPriority: "LOW",
    itPriority: "LOW",
  });
  // Status scenarios
  await createTicket("statusAdvance", { currentStatus: "OPEN" });
  await createTicket("statusResolve", { currentStatus: "OPEN" });
  await createTicket("statusIllegal", { currentStatus: "OPEN" });
  await createTicket("statusSame", { currentStatus: "OPEN" });
  await createTicket("statusCancelled", { currentStatus: "CANCELLED" });
  await createTicket("statusResolvedBad", {
    currentStatus: "RESOLVED",
    resolutionSummary: "Initial fix applied.",
  });
  await createTicket("statusClosed", {
    currentStatus: "CLOSED",
    resolutionSummary: "Closed after verification.",
  });
  // Resolve-indication scenarios
  await createTicket("indicateActive", { currentStatus: "OPEN" });
  await createTicket("indicateResolved", {
    currentStatus: "RESOLVED",
    resolutionSummary: "Already resolved.",
  });
  await createTicket("indicateOtherOwner", {
    currentStatus: "OPEN",
    requesterOwnerId: otherRequesterUserId,
  });
});

afterAll(async () => {
  const ticketIds = Object.values(tid);
  await prisma.comment.deleteMany({ where: { ticketId: { in: ticketIds } } });
  await prisma.ticket.deleteMany({ where: { categoryId } });
  if (categoryId) await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
  if (systemId) await prisma.relatedSystem.delete({ where: { id: systemId } }).catch(() => undefined);
  if (createdUserIds.length > 0)
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("API-13 · RBAC guards on ticket detail operations", () => {
  it("rejects unauthenticated detail reads and claim attempts with 401", async () => {
    const detail = await request(app).get(`/api/staff/tickets/${tid.claimUnassigned}`);
    expect(detail.status).toBe(401);

    const claim = await request(app)
      .patch(`/api/staff/tickets/${tid.claimUnassigned}/claim`)
      .send({});
    expect(claim.status).toBe(401);
  });

  it("rejects a Requester on every staff operation with 403 Forbidden", async () => {
    const agent = await login(EMAIL.requester);
    const id = tid.claimUnassigned;

    const detail = await agent.get(`/api/staff/tickets/${id}`);
    expect(detail.status).toBe(403);
    expect(detail.body.error.code).toBe("FORBIDDEN");

    expect((await agent.patch(`/api/staff/tickets/${id}/claim`).send({})).status).toBe(403);
    expect(
      (await agent.patch(`/api/staff/tickets/${id}/assign`).send({ ownerId: staffId })).status
    ).toBe(403);
    expect(
      (await agent.patch(`/api/staff/tickets/${id}/priority`).send({ itPriority: "HIGH" })).status
    ).toBe(403);
    expect(
      (await agent.patch(`/api/staff/tickets/${id}/status`).send({ currentStatus: "OPEN" })).status
    ).toBe(403);
    // Issue-task alias paths are guarded identically.
    expect(
      (await agent.patch(`/api/tickets/${id}/it-priority`).send({ itPriority: "HIGH" })).status
    ).toBe(403);
  });

  it("allows an Administrator to read the staff detail view", async () => {
    const agent = await login(EMAIL.admin);
    const res = await agent.get(`/api/staff/tickets/${tid.claimUnassigned}`);
    expect(res.status).toBe(200);
  });
});

describe("API-13 · GET /api/staff/tickets/:id", () => {
  it("returns full operational detail including permittedTransitions", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.get(`/api/staff/tickets/${tid.statusResolve}`);

    expect(res.status).toBe(200);
    expect(res.body.ticketNumber).toBe(`${PREFIX}-${String(6).padStart(3, "0")}`);
    expect(res.body.requester.name).toBe(`Detail Requester ${STAMP}`);
    expect(res.body.category.name).toBe(`Detail Category ${STAMP}`);
    expect(res.body.owner).toBeNull();
    expect(res.body.resolutionSummary).toBeNull();
    expect(res.body.publicCommentsCount).toBe(0);
    // OPEN permits only BR-15 targets (never the current status or CLOSED).
    expect([...res.body.permittedTransitions].sort()).toEqual(
      ["CANCELLED", "IN_PROGRESS", "RESOLVED", "WAITING_FOR_REQUESTER"].sort()
    );
  });

  it("returns 404 for an unknown ticket id", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.get("/api/staff/tickets/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("API-13 · PATCH claim (Assign to Me)", () => {
  it("claims an unassigned NEW ticket and auto-moves it to OPEN", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.claimUnassigned}/claim`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(staffId);
    expect(res.body.currentStatus).toBe("OPEN");
    expect(res.body.owner).toMatchObject({ id: staffId, name: `Detail Staff ${STAMP}` });
  });

  it("supports the issue alias path PATCH /api/tickets/:id/claim", async () => {
    const agent = await login(EMAIL.staff2);
    const res = await agent.patch(`/api/tickets/${tid.claimUnassigned}/claim`).send({});

    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(staff2Id);
    expect(res.body.currentStatus).toBe("OPEN");
  });

  it("returns 404 for an unknown ticket", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.patch("/api/staff/tickets/does-not-exist/claim").send({});
    expect(res.status).toBe(404);
  });
});

describe("API-14 · PATCH assign / reassign", () => {
  it("reassigns an unassigned ticket to another active IT Staff member", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.assignOpen}/assign`)
      .send({ ownerId: staff2Id });

    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(staff2Id);
    expect(res.body.owner).toMatchObject({ id: staff2Id, name: `Detail Staff Two ${STAMP}` });
  });

  it("moves a NEW ticket to OPEN when an owner is assigned (BR-14)", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.assignNew}/assign`)
      .send({ ownerId: staffId });

    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("OPEN");
    expect(res.body.ownerId).toBe(staffId);
  });

  it("rejects a Requester as target owner with 400 Bad Request", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.assignOpen}/assign`)
      .send({ ownerId: requesterId });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/active IT Staff or Administrator/);
  });

  it("rejects an inactive staff member with 400 Bad Request", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.assignOpen}/assign`)
      .send({ ownerId: inactiveStaffId });

    expect(res.status).toBe(400);
  });

  it("rejects a missing ownerId with 400 Bad Request", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.patch(`/api/staff/tickets/${tid.assignOpen}/assign`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/ownerId is required/);
  });

  it("unassigns a ticket when ownerId is null (BR-13)", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.assignOpen}/assign`)
      .send({ ownerId: null });

    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBeNull();
    expect(res.body.owner).toBeNull();
  });

  it("returns 404 for an unknown ticket", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch("/api/staff/tickets/does-not-exist/assign")
      .send({ ownerId: staffId });
    expect(res.status).toBe(404);
  });
});

describe("API-15 · PATCH priority (independent IT Priority, BR-12)", () => {
  it("updates itPriority to URGENT while requestedPriority stays LOW", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.priority}/priority`)
      .send({ itPriority: "URGENT" });

    expect(res.status).toBe(200);
    expect(res.body.itPriority).toBe("URGENT");
    expect(res.body.requestedPriority).toBe("LOW");

    // Verify directly in the database that the Requester's value is untouched.
    const row = await prisma.ticket.findUnique({ where: { id: tid.priority } });
    expect(row?.itPriority).toBe("URGENT");
    expect(row?.requestedPriority).toBe("LOW");
  });

  it("supports the issue alias path PATCH /api/tickets/:id/it-priority", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/tickets/${tid.priority}/it-priority`)
      .send({ itPriority: "HIGH" });

    expect(res.status).toBe(200);
    expect(res.body.itPriority).toBe("HIGH");
    expect(res.body.requestedPriority).toBe("LOW");
  });

  it("rejects an invalid priority value with 400 Bad Request", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.priority}/priority`)
      .send({ itPriority: "CRITICAL" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/LOW, MEDIUM, HIGH, URGENT/);
  });

  it("rejects a missing itPriority with 400 Bad Request", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.patch(`/api/staff/tickets/${tid.priority}/priority`).send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown ticket", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch("/api/staff/tickets/does-not-exist/priority")
      .send({ itPriority: "LOW" });
    expect(res.status).toBe(404);
  });
});

describe("API-16 / API-17 · PATCH status (BR-15 transition matrix)", () => {
  it("advances OPEN → IN_PROGRESS", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.statusAdvance}/status`)
      .send({ currentStatus: "IN_PROGRESS" });

    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("IN_PROGRESS");
  });

  it("rejects resolving without a resolution summary (BR-17)", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.statusResolve}/status`)
      .send({ currentStatus: "RESOLVED" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/resolutionSummary/);
  });

  it("rejects a summary shorter than 5 characters (BR-17)", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.statusResolve}/status`)
      .send({ currentStatus: "RESOLVED", resolutionSummary: "ok" });

    expect(res.status).toBe(400);
  });

  it("resolves a ticket when a valid resolution summary is provided", async () => {
    const agent = await login(EMAIL.staff);
    const summary = "Replaced faulty battery cell and updated power management driver to v2.1.";
    const res = await agent
      .patch(`/api/staff/tickets/${tid.statusResolve}/status`)
      .send({ currentStatus: "RESOLVED", resolutionSummary: summary });

    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("RESOLVED");
    expect(res.body.resolutionSummary).toBe(summary);

    const row = await prisma.ticket.findUnique({ where: { id: tid.statusResolve } });
    expect(row?.currentStatus).toBe("RESOLVED");
    expect(row?.resolutionSummary).toBe(summary);
  });

  it("rejects an illegal transition (OPEN → CLOSED) with 422 Unprocessable", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.statusIllegal}/status`)
      .send({ currentStatus: "CLOSED", resolutionSummary: "Trying to skip resolution." });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("UNPROCESSABLE_ENTITY");
    expect(res.body.error.message).toMatch(/not permitted/);

    const row = await prisma.ticket.findUnique({ where: { id: tid.statusIllegal } });
    expect(row?.currentStatus).toBe("OPEN");
  });

  it("rejects a no-op transition to the same status with 422", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.statusSame}/status`)
      .send({ currentStatus: "OPEN" });
    expect(res.status).toBe(422);
  });

  it("rejects transitions out of the terminal CANCELLED state with 422", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.statusCancelled}/status`)
      .send({ currentStatus: "OPEN" });
    expect(res.status).toBe(422);
  });

  it("rejects RESOLVED → OPEN with 422 (only CLOSED/REOPENED allowed)", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.statusResolvedBad}/status`)
      .send({ currentStatus: "OPEN" });
    expect(res.status).toBe(422);
  });

  it("rejects an unknown status value with 400 Bad Request", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.statusAdvance}/status`)
      .send({ currentStatus: "ARCHIVED" });
    expect(res.status).toBe(400);
  });

  it("forbids an IT Staff member from reopening a CLOSED ticket (BR-15 roles)", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.statusClosed}/status`)
      .send({ currentStatus: "REOPENED" });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/Administrator/);
  });

  it("allows an Administrator to reopen a CLOSED ticket", async () => {
    const agent = await login(EMAIL.admin);
    const res = await agent
      .patch(`/api/staff/tickets/${tid.statusClosed}/status`)
      .send({ currentStatus: "REOPENED" });

    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("REOPENED");
  });

  it("supports the issue alias path PATCH /api/tickets/:id/status", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch(`/api/tickets/${tid.statusAdvance}/status`)
      .send({ currentStatus: "WAITING_FOR_REQUESTER" });

    expect(res.status).toBe(200);
    expect(res.body.currentStatus).toBe("WAITING_FOR_REQUESTER");
  });

  it("returns 404 for an unknown ticket", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent
      .patch("/api/staff/tickets/does-not-exist/status")
      .send({ currentStatus: "OPEN" });
    expect(res.status).toBe(404);
  });
});

describe("API-20 · POST /api/tickets/:id/resolve-indication (BR-16 / FR-12)", () => {
  it("records the indication for the owning Requester without changing status", async () => {
    const agent = await login(EMAIL.requester);
    const res = await agent
      .post(`/api/tickets/${tid.indicateActive}/resolve-indication`)
      .send({ note: "Battery life looks normal again." });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: "Resolution indication recorded successfully",
      ticketId: tid.indicateActive,
    });

    const ticket = await prisma.ticket.findUnique({
      where: { id: tid.indicateActive },
      include: { comments: true },
    });
    // BR-16: the formal status is untouched.
    expect(ticket?.currentStatus).toBe("OPEN");
    expect(ticket?.comments).toHaveLength(1);
    expect(ticket?.comments[0].authorId).toBe(requesterId);
    expect(ticket?.comments[0].content).toMatch(
      /Requester indicated that the problem appears resolved\./
    );
    expect(ticket?.comments[0].content).toContain("Battery life looks normal again.");
  });

  it("works without a request body", async () => {
    const agent = await login(EMAIL.requester);
    const res = await agent.post(`/api/tickets/${tid.indicateActive}/resolve-indication`).send({});

    expect(res.status).toBe(200);
    const ticket = await prisma.ticket.findUnique({
      where: { id: tid.indicateActive },
      include: { comments: true },
    });
    expect(ticket?.currentStatus).toBe("OPEN");
    expect(ticket?.comments).toHaveLength(2);
  });

  it("rejects a non-owner Requester with 403 Forbidden", async () => {
    const agent = await login(EMAIL.otherRequester);
    const res = await agent.post(`/api/tickets/${tid.indicateActive}/resolve-indication`).send({});

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/do not own/);
  });

  it("rejects an IT Staff member with 403 Forbidden", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.post(`/api/tickets/${tid.indicateActive}/resolve-indication`).send({});
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app)
      .post(`/api/tickets/${tid.indicateActive}/resolve-indication`)
      .send({});
    expect(res.status).toBe(401);
  });

  it("rejects an already RESOLVED ticket with 422 Unprocessable", async () => {
    const agent = await login(EMAIL.requester);
    const res = await agent
      .post(`/api/tickets/${tid.indicateResolved}/resolve-indication`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("UNPROCESSABLE_ENTITY");

    const ticket = await prisma.ticket.findUnique({
      where: { id: tid.indicateResolved },
      include: { comments: true },
    });
    expect(ticket?.comments).toHaveLength(0);
  });

  it("returns 404 for an unknown ticket", async () => {
    const agent = await login(EMAIL.requester);
    const res = await agent.post("/api/tickets/does-not-exist/resolve-indication").send({});
    expect(res.status).toBe(404);
  });
});




