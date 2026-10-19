import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { VALID_ACTION_RESULTS } from "../../src/controllers/actionsTakenController.js";

const prisma = getPrisma();
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const PASSWORD = "ActionsPass123!";

const EMAIL = {
  staff: `actions.staff.${STAMP}@toktickit.test`,
  otherStaff: `actions.otherstaff.${STAMP}@toktickit.test`,
  admin: `actions.admin.${STAMP}@toktickit.test`,
  requester: `actions.requester.${STAMP}@toktickit.test`,
  otherRequester: `actions.requester2.${STAMP}@toktickit.test`,
};

const createdUserIds: string[] = [];
const createdTicketIds: string[] = [];

let staffId = "";
let otherStaffId = "";
let adminId = "";
let requesterId = "";
let otherRequesterId = "";

let categoryId = "";
let systemId = "";

let ticketAId = ""; // Owned by requester
let ticketBId = ""; // Owned by otherRequester

let staffAgent: ReturnType<typeof request.agent>;
let otherStaffAgent: ReturnType<typeof request.agent>;
let adminAgent: ReturnType<typeof request.agent>;
let requesterAgent: ReturnType<typeof request.agent>;
let otherRequesterAgent: ReturnType<typeof request.agent>;

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
      department: "Actions Taken Test Dept",
      isActive: true,
      mustChangePassword: false,
      passwordHash,
    },
  });
  createdUserIds.push(user.id);
  return user.id;
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

  staffId = await createTestUser(EMAIL.staff, "Michael ActionStaff", "IT_STAFF");
  otherStaffId = await createTestUser(EMAIL.otherStaff, "Lisa OtherStaff", "IT_STAFF");
  adminId = await createTestUser(EMAIL.admin, "Admin ActionUser", "ADMINISTRATOR");
  requesterId = await createTestUser(EMAIL.requester, "Jennifer ActionRequester", "REQUESTER");
  otherRequesterId = await createTestUser(EMAIL.otherRequester, "David OtherRequester", "REQUESTER");

  staffAgent = await login(EMAIL.staff);
  otherStaffAgent = await login(EMAIL.otherStaff);
  adminAgent = await login(EMAIL.admin);
  requesterAgent = await login(EMAIL.requester);
  otherRequesterAgent = await login(EMAIL.otherRequester);

  // Ticket A owned by requester
  const ticketA = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-ACT-A-${STAMP}`,
      requesterId,
      categoryId,
      relatedSystemId: systemId,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      currentStatus: "IN_PROGRESS",
      summary: "Actions Taken Test Ticket A",
      description: "Testing actions taken creation and retrieval.",
    },
  });
  ticketAId = ticketA.id;
  createdTicketIds.push(ticketA.id);

  // Ticket B owned by otherRequester
  const ticketB = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-ACT-B-${STAMP}`,
      requesterId: otherRequesterId,
      categoryId,
      relatedSystemId: systemId,
      requestedPriority: "HIGH",
      itPriority: "HIGH",
      currentStatus: "OPEN",
      summary: "Actions Taken Test Ticket B",
      description: "Testing cross-requester access isolation.",
    },
  });
  ticketBId = ticketB.id;
  createdTicketIds.push(ticketB.id);
});

afterAll(async () => {
  if (createdTicketIds.length > 0) {
    await prisma.actionTaken.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

describe("Lab 4 — Actions Taken REST API", () => {
  // -------------------------------------------------------------------------
  // UNIT-01 & UNIT-02: Unit Validations
  // -------------------------------------------------------------------------
  describe("Unit & Validation Rules", () => {
    it("UNIT-02 · recognizes valid action result enum values", () => {
      expect(VALID_ACTION_RESULTS).toContain("SUCCESS");
      expect(VALID_ACTION_RESULTS).toContain("PARTIAL");
      expect(VALID_ACTION_RESULTS).toContain("PENDING");
      expect(VALID_ACTION_RESULTS).toContain("FAILED");
      // @ts-expect-error Testing invalid enum value
      expect(VALID_ACTION_RESULTS.includes("UNKNOWN")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/tickets/:id/actions-taken
  // -------------------------------------------------------------------------
  describe("POST /api/tickets/:id/actions-taken", () => {
    it("API-01 · creates an ActionTaken record with valid inputs as IT Staff (201 Created)", async () => {
      const payload = {
        description: "Replaced faulty RAM module in slot 2.",
        result: "SUCCESS",
        followUpRequired: false,
        attachmentNotes: "ram-diagnostic.txt",
      };

      const res = await staffAgent.post(`/api/tickets/${ticketAId}/actions-taken`).send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.ticketId).toBe(ticketAId);
      expect(res.body.data.description).toBe(payload.description);
      expect(res.body.data.result).toBe("SUCCESS");
      expect(res.body.data.followUpRequired).toBe(false);
      expect(res.body.data.followUpNote).toBeNull();
      expect(res.body.data.attachmentNotes).toBe("ram-diagnostic.txt");
      expect(res.body.data.performedBy).toBeDefined();
      expect(res.body.data.performedBy.id).toBe(staffId);
      expect(res.body.data.performedBy.fullName).toBe("Michael ActionStaff");
      expect(res.body.data.performedBy.role).toBe("IT_STAFF");
      expect(res.body.data.createdAt).toBeDefined();
    });

    it("API-02 · auto-derives performedById from session, ignoring spoofed client value", async () => {
      const payload = {
        description: "Ran memory stress test utility.",
        result: "PARTIAL",
        performedById: otherStaffId, // Attempted spoof
        followUpRequired: false,
      };

      const res = await staffAgent.post(`/api/tickets/${ticketAId}/actions-taken`).send(payload);

      expect(res.status).toBe(201);
      // Must attribute to authenticated staffId, not spoofed otherStaffId
      expect(res.body.data.performedBy.id).toBe(staffId);
      expect(res.body.data.performedBy.fullName).toBe("Michael ActionStaff");
    });

    it("API-03 · rejects followUpRequired: true when followUpNote is missing or empty (400 Bad Request)", async () => {
      const resMissing = await staffAgent.post(`/api/tickets/${ticketAId}/actions-taken`).send({
        description: "Checked network drop latency.",
        result: "PARTIAL",
        followUpRequired: true,
        // followUpNote omitted
      });

      expect(resMissing.status).toBe(400);
      expect(resMissing.body.error).toBeDefined();
      expect(resMissing.body.error.code).toBe("BAD_REQUEST");
      expect(resMissing.body.error.message).toMatch(/follow-up note is required/i);

      const resEmpty = await staffAgent.post(`/api/tickets/${ticketAId}/actions-taken`).send({
        description: "Checked network drop latency.",
        result: "PARTIAL",
        followUpRequired: true,
        followUpNote: "   ", // Blank string
      });

      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.error.code).toBe("BAD_REQUEST");
    });

    it("UNIT-01 / API-03 · accepts followUpRequired: true when followUpNote is provided", async () => {
      const res = await staffAgent.post(`/api/tickets/${ticketAId}/actions-taken`).send({
        description: "Configured static IP on switch port.",
        result: "PARTIAL",
        followUpRequired: true,
        followUpNote: "Verify VLAN tagging tomorrow morning.",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.followUpRequired).toBe(true);
      expect(res.body.data.followUpNote).toBe("Verify VLAN tagging tomorrow morning.");
    });

    it("API-04 · rejects Requester attempt to create ActionTaken (403 Forbidden)", async () => {
      const res = await requesterAgent.post(`/api/tickets/${ticketAId}/actions-taken`).send({
        description: "Requester trying to record an action.",
        result: "SUCCESS",
        followUpRequired: false,
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("API-18 · rejects description exceeding 1000 characters (400 Bad Request)", async () => {
      const res = await staffAgent.post(`/api/tickets/${ticketAId}/actions-taken`).send({
        description: "A".repeat(1001),
        result: "SUCCESS",
        followUpRequired: false,
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(res.body.error.message).toMatch(/1000 characters/i);
    });

    it("rejects empty or missing description (400 Bad Request)", async () => {
      const res = await staffAgent.post(`/api/tickets/${ticketAId}/actions-taken`).send({
        description: "   ",
        result: "SUCCESS",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });

    it("rejects invalid result value (400 Bad Request)", async () => {
      const res = await staffAgent.post(`/api/tickets/${ticketAId}/actions-taken`).send({
        description: "Valid description",
        result: "INVALID_RESULT",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });

    it("API-19 · rejects attachmentNotes exceeding 500 characters (400 Bad Request)", async () => {
      const res = await staffAgent.post(`/api/tickets/${ticketAId}/actions-taken`).send({
        description: "Valid description",
        result: "SUCCESS",
        attachmentNotes: "X".repeat(501),
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });

    it("rejects future actionDateTime (400 Bad Request)", async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const res = await staffAgent.post(`/api/tickets/${ticketAId}/actions-taken`).send({
        description: "Valid description",
        result: "SUCCESS",
        actionDateTime: futureDate,
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
      expect(res.body.error.message).toMatch(/future/i);
    });

    it("returns 404 Not Found when ticket does not exist", async () => {
      const res = await staffAgent.post("/api/tickets/non-existent-ticket-id/actions-taken").send({
        description: "Action on ghost ticket",
        result: "SUCCESS",
      });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 Unauthorized when unauthenticated", async () => {
      const res = await request(app).post(`/api/tickets/${ticketAId}/actions-taken`).send({
        description: "Unauthenticated action",
        result: "SUCCESS",
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("allows Administrator to create an ActionTaken record (201 Created)", async () => {
      const res = await adminAgent.post(`/api/tickets/${ticketAId}/actions-taken`).send({
        description: "Admin intervention: forced cache flush on server cluster.",
        result: "SUCCESS",
        followUpRequired: false,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.performedBy.id).toBe(adminId);
      expect(res.body.data.performedBy.role).toBe("ADMINISTRATOR");
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/tickets/:id/actions-taken
  // -------------------------------------------------------------------------
  describe("GET /api/tickets/:id/actions-taken", () => {
    it("API-05 · Requester views Actions Taken list for owned ticket (200 OK)", async () => {
      const res = await requesterAgent.get(`/api/tickets/${ticketAId}/actions-taken`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.ticketId).toBe(ticketAId);
      expect(res.body.meta.total).toBe(res.body.data.length);

      const firstAction = res.body.data[0];
      expect(firstAction.id).toBeDefined();
      expect(firstAction.description).toBeDefined();
      expect(firstAction.result).toBeDefined();
      expect(firstAction.performedBy).toBeDefined();
      expect(firstAction.performedBy.fullName).toBeDefined();

      // otherRequester views actions on their own ticketB
      const resB = await otherRequesterAgent.get(`/api/tickets/${ticketBId}/actions-taken`);
      expect(resB.status).toBe(200);
      expect(resB.body.meta.ticketId).toBe(ticketBId);
    });

    it("API-06 · Requester blocked from viewing Actions Taken on non-owned ticket (403 Forbidden)", async () => {
      // requesterAgent attempts to access ticketB (owned by otherRequester)
      const res = await requesterAgent.get(`/api/tickets/${ticketBId}/actions-taken`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("IT Staff can view Actions Taken on any ticket (200 OK)", async () => {
      const resA = await staffAgent.get(`/api/tickets/${ticketAId}/actions-taken`);
      expect(resA.status).toBe(200);

      const resB = await staffAgent.get(`/api/tickets/${ticketBId}/actions-taken`);
      expect(resB.status).toBe(200);
    });

    it("Administrator can view Actions Taken on any ticket (200 OK)", async () => {
      const res = await adminAgent.get(`/api/tickets/${ticketBId}/actions-taken`);
      expect(res.status).toBe(200);
    });

    it("returns 404 Not Found when ticket does not exist", async () => {
      const res = await staffAgent.get("/api/tickets/missing-ticket-cuid/actions-taken");
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 Unauthorized when unauthenticated", async () => {
      const res = await request(app).get(`/api/tickets/${ticketAId}/actions-taken`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/actions-taken/:actionId
  // -------------------------------------------------------------------------
  describe("PUT /api/actions-taken/:actionId", () => {
    let createdActionId = "";

    beforeAll(async () => {
      // Create an action performed by staffUser
      const action = await prisma.actionTaken.create({
        data: {
          ticketId: ticketAId,
          description: "Initial action by Michael Staff",
          result: "PENDING",
          performedById: staffId,
          followUpRequired: true,
          followUpNote: "Initial follow-up note.",
          attachmentNotes: "initial-log.txt",
        },
      });
      createdActionId = action.id;
    });

    it("API-07 · IT Staff updates own ActionTaken record (200 OK)", async () => {
      const updatePayload = {
        description: "Updated description after second bench test.",
        result: "SUCCESS",
        followUpRequired: false,
        attachmentNotes: "final-log.txt",
      };

      const res = await staffAgent
        .put(`/api/actions-taken/${createdActionId}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdActionId);
      expect(res.body.data.description).toBe(updatePayload.description);
      expect(res.body.data.result).toBe("SUCCESS");
      expect(res.body.data.followUpRequired).toBe(false);
      expect(res.body.data.followUpNote).toBeNull();
      expect(res.body.data.attachmentNotes).toBe("final-log.txt");
      // performedById must remain unchanged
      expect(res.body.data.performedBy.id).toBe(staffId);
    });

    it("API-08 · IT Staff is blocked from updating another staff member's ActionTaken (403 Forbidden)", async () => {
      // otherStaffAgent attempts to update action created by staffId
      const res = await otherStaffAgent
        .put(`/api/actions-taken/${createdActionId}`)
        .send({ description: "Unauthorized edit attempt" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("Administrator CAN update any staff member's ActionTaken (200 OK)", async () => {
      const res = await adminAgent
        .put(`/api/actions-taken/${createdActionId}`)
        .send({ description: "Admin override update." });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe("Admin override update.");
      // Original performer remains staffId
      expect(res.body.data.performedBy.id).toBe(staffId);
    });

    it("Requester is blocked from updating ActionTaken (403 Forbidden)", async () => {
      const res = await requesterAgent
        .put(`/api/actions-taken/${createdActionId}`)
        .send({ description: "Requester edit attempt" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects update when followUpRequired is set to true without a note (400 Bad Request)", async () => {
      const res = await staffAgent.put(`/api/actions-taken/${createdActionId}`).send({
        followUpRequired: true,
        followUpNote: "   ",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });

    it("returns 404 Not Found when actionId does not exist", async () => {
      const res = await staffAgent
        .put("/api/actions-taken/non-existent-action-uuid")
        .send({ description: "Ghost update" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 Unauthorized when unauthenticated", async () => {
      const res = await request(app)
        .put(`/api/actions-taken/${createdActionId}`)
        .send({ description: "Unauthenticated update" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
