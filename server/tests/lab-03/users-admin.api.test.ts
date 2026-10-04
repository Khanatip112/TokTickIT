import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const PASSWORD = "AdminPass123!";

const EMAIL = {
  adminActor: `auth.admin.actor.${STAMP}@toktickit.test`,
  adminTarget: `auth.admin.target.${STAMP}@toktickit.test`,
  soloAdmin: `auth.admin.solo.${STAMP}@toktickit.test`,
  staff: `auth.staff.${STAMP}@toktickit.test`,
  requester: `auth.requester.${STAMP}@toktickit.test`,
};

const NAME = {
  adminActor: `Admin Actor ${STAMP}`,
  adminTarget: `Admin Target ${STAMP}`,
  soloAdmin: `Solo Admin ${STAMP}`,
  staff: `Staff Member ${STAMP}`,
  requester: `Requester Person ${STAMP}`,
};

const createdIds: string[] = [];

let adminActorId = "";
let adminTargetId = "";
let soloAdminId = "";
let staffId = "";
let requesterId = "";
let staffPasswordHash = "";

async function createTestUser(opts: {
  email: string;
  name: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive?: boolean;
  mustChangePassword?: boolean;
}): Promise<string> {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: opts.email,
      fullName: opts.name,
      name: opts.name,
      role: opts.role,
      department: "Test",
      isActive: opts.isActive ?? true,
      mustChangePassword: opts.mustChangePassword ?? false,
      passwordHash,
    },
  });
  createdIds.push(user.id);
  return user.id;
}

/** Authenticates via the real login endpoint and returns a cookie-preserving agent. */
async function login(email: string, password: string = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  adminActorId = await createTestUser({ email: EMAIL.adminActor, name: NAME.adminActor, role: "ADMINISTRATOR" });
  adminTargetId = await createTestUser({ email: EMAIL.adminTarget, name: NAME.adminTarget, role: "ADMINISTRATOR" });
  soloAdminId = await createTestUser({ email: EMAIL.soloAdmin, name: NAME.soloAdmin, role: "ADMINISTRATOR" });
  staffId = await createTestUser({ email: EMAIL.staff, name: NAME.staff, role: "IT_STAFF" });
  requesterId = await createTestUser({ email: EMAIL.requester, name: NAME.requester, role: "REQUESTER" });
  staffPasswordHash = (await prisma.user.findUnique({ where: { id: staffId } }))!.passwordHash;
});

afterAll(async () => {
  const ids = [adminActorId, adminTargetId, soloAdminId, staffId, requesterId, ...createdIds].filter(Boolean);
  if (ids.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});

describe("API-26 · RBAC protection on /api/admin/users", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
  });

  it("rejects a Requester with 403 Forbidden", async () => {
    const agent = await login(EMAIL.requester);
    const res = await agent.get("/api/admin/users");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects an IT Staff member with 403 Forbidden", async () => {
    const agent = await login(EMAIL.staff);
    const res = await agent.get("/api/admin/users");
    expect(res.status).toBe(403);
  });

  it("allows an Administrator with 200 OK", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent.get("/api/admin/users");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("API-21 · GET /api/admin/users (listing, search, filters, pagination)", () => {
  it("returns a sanitized directory containing the seeded test users", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent.get("/api/admin/users");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const emails = res.body.map((u: any) => u.email);
    expect(emails).toContain(EMAIL.requester);
    expect(emails).toContain(EMAIL.staff);
    expect(res.body.every((u: any) => u.passwordHash === undefined)).toBe(true);
  });

  it("filters by search term (name and email) and the q alias", async () => {
    const agent = await login(EMAIL.adminActor);

    const byEmail = await agent.get("/api/admin/users").query({ search: EMAIL.requester });
    expect(byEmail.body.some((u: any) => u.email === EMAIL.requester)).toBe(true);

    const byName = await agent.get("/api/admin/users").query({ q: NAME.staff });
    expect(byName.body.some((u: any) => u.email === EMAIL.staff)).toBe(true);
    expect(byName.body.every((u: any) => u.email === EMAIL.staff)).toBe(true);
  });

  it("filters by role and by active status", async () => {
    const agent = await login(EMAIL.adminActor);

    const staffOnly = await agent.get("/api/admin/users").query({ role: "IT_STAFF" });
    expect(staffOnly.body.length).toBeGreaterThan(0);
    expect(staffOnly.body.every((u: any) => u.role === "IT_STAFF")).toBe(true);

    const inactiveOnly = await agent.get("/api/admin/users").query({ isActive: "false" });
    expect(inactiveOnly.body.every((u: any) => u.isActive === false)).toBe(true);
  });

  it("supports pagination via page/pageSize", async () => {
    const agent = await login(EMAIL.adminActor);
    const firstPage = await agent.get("/api/admin/users").query({ page: 1, pageSize: 1 });
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.length).toBe(1);
  });
});

describe("API-22 / API-23 · POST /api/admin/users (create + duplicate email)", () => {
  it("creates a user flagged with requiresPasswordChange = true", async () => {
    const agent = await login(EMAIL.adminActor);
    const email = `created.user.${STAMP}@toktickit.test`;

    const res = await agent.post("/api/admin/users").send({
      name: "Created User",
      email,
      role: "IT_STAFF",
      department: "Infrastructure",
      isActive: true,
      initialPassword: "InitialPass123!",
    });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
    expect(res.body.role).toBe("IT_STAFF");
    expect(res.body.requiresPasswordChange).toBe(true);
    expect(res.body).not.toHaveProperty("passwordHash");
    createdIds.push(res.body.id);
  });

  it("generates a compliant temporary password when initialPassword is omitted", async () => {
    const agent = await login(EMAIL.adminActor);
    const email = `auto.user.${STAMP}@toktickit.test`;

    const res = await agent.post("/api/admin/users").send({
      name: "Auto Generated",
      email,
      role: "REQUESTER",
    });

    expect(res.status).toBe(201);
    expect(res.body.requiresPasswordChange).toBe(true);
    expect(typeof res.body.temporaryPassword).toBe("string");
    expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(8);
    createdIds.push(res.body.id);
  });

  it("returns 409 Conflict for a duplicate email", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent.post("/api/admin/users").send({
      name: "Duplicate Person",
      email: EMAIL.requester,
      role: "REQUESTER",
      initialPassword: "InitialPass123!",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Email address is already in use");
  });

  it("returns 400 Bad Request for an invalid payload", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent.post("/api/admin/users").send({
      name: "X",
      email: "not-an-email",
      role: "WIZARD",
      initialPassword: "weak",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });
});

describe("API-24 / API-25 · PATCH /api/admin/users/:id (updates + safety guards)", () => {
  it("updates a user's name and role", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent
      .patch(`/api/admin/users/${requesterId}`)
      .send({ name: "Renamed Requester", role: "IT_STAFF" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed Requester");
    expect(res.body.role).toBe("IT_STAFF");

    await prisma.user.update({
      where: { id: requesterId },
      data: { fullName: NAME.requester, name: NAME.requester, role: "REQUESTER" },
    });
  });

  it("accepts PUT as an alias for PATCH", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent.put(`/api/admin/users/${staffId}`).send({ department: "Alias Department" });
    expect(res.status).toBe(200);
    expect(res.body.department).toBe("Alias Department");
  });

  it("returns 409 Conflict when updating to a duplicate email", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent.patch(`/api/admin/users/${staffId}`).send({ email: EMAIL.requester });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Email address is already in use");
  });

  it("returns 404 Not Found for an unknown user", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent.patch("/api/admin/users/does-not-exist").send({ name: "Ghost User" });
    expect(res.status).toBe(404);
  });

  it("allows deactivating another administrator when other admins remain", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent.patch(`/api/admin/users/${adminTargetId}`).send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);

    await prisma.user.update({ where: { id: adminTargetId }, data: { isActive: true } });
  });

  it("blocks an administrator from deactivating their own account (BR-22)", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent.patch(`/api/admin/users/${adminActorId}`).send({ isActive: false });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Cannot deactivate your own administrator account");
  });

  it("blocks deactivating or demoting the last active Administrator (BR-23)", async () => {
    const agent = await login(EMAIL.soloAdmin);

    // Make soloAdmin the only active Administrator for the duration of this test.
    const others = await prisma.user.findMany({
      where: { role: "ADMINISTRATOR", isActive: true, id: { not: soloAdminId } },
      select: { id: true },
    });
    const otherIds = others.map((o) => o.id);
    await prisma.user.updateMany({ where: { id: { in: otherIds } }, data: { isActive: false } });

    try {
      const deactivate = await agent.patch(`/api/admin/users/${soloAdminId}`).send({ isActive: false });
      expect(deactivate.status).toBe(422);
      expect(deactivate.body.error.message).toBe(
        "Cannot deactivate or demote the last active Administrator"
      );

      const demote = await agent.patch(`/api/admin/users/${soloAdminId}`).send({ role: "IT_STAFF" });
      expect(demote.status).toBe(422);
      expect(demote.body.error.message).toBe(
        "Cannot deactivate or demote the last active Administrator"
      );
    } finally {
      await prisma.user.updateMany({ where: { id: { in: otherIds } }, data: { isActive: true } });
    }
  });
});

describe("API-27 · POST /api/admin/users/:id/reset-password", () => {
  it("resets the password, forces a change, and enables login with the new password", async () => {
    const agent = await login(EMAIL.adminActor);

    const res = await agent
      .post(`/api/admin/users/${staffId}/reset-password`)
      .send({ initialPassword: "TempPass999!" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Initial password set successfully/i);
    expect(res.body.userId).toBe(staffId);

    const dbUser = await prisma.user.findUnique({ where: { id: staffId } });
    expect(dbUser?.mustChangePassword).toBe(true);

    const relogin = await request(app)
      .post("/api/auth/login")
      .send({ email: EMAIL.staff, password: "TempPass999!" });
    expect(relogin.status).toBe(200);

    // Restore the original credential/flag for idempotent re-runs.
    await prisma.user.update({
      where: { id: staffId },
      data: { passwordHash: staffPasswordHash, mustChangePassword: false },
    });
  });

  it("returns 400 Bad Request when the password fails complexity", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent
      .post(`/api/admin/users/${staffId}/reset-password`)
      .send({ initialPassword: "weak" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 400 Bad Request when the password is missing", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent.post(`/api/admin/users/${staffId}/reset-password`).send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 Not Found for an unknown user", async () => {
    const agent = await login(EMAIL.adminActor);
    const res = await agent
      .post("/api/admin/users/does-not-exist/reset-password")
      .send({ initialPassword: "TempPass999!" });
    expect(res.status).toBe(404);
  });
});
