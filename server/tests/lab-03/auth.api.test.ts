import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword, validatePasswordComplexity, verifyPassword } from "../../src/utils/password.js";

const prisma = getPrisma();
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const PASSWORD = "Password123!";
const NEW_PASSWORD = "NewSecure456!";

const EMAIL = {
  active: `auth.test.${STAMP}.active@toktickit.test`,
  inactive: `auth.test.${STAMP}.inactive@toktickit.test`,
  wall: `auth.test.${STAMP}.wall@toktickit.test`,
  change: `auth.test.${STAMP}.change@toktickit.test`,
};

const createdUserIds: string[] = [];

async function createUser(opts: {
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive: boolean;
  mustChangePassword: boolean;
}): Promise<string> {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      fullName: "Auth Test User",
      name: "Auth Test User",
      role: opts.role,
      department: "Quality Assurance",
      isActive: opts.isActive,
      mustChangePassword: opts.mustChangePassword,
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

let activeUserId: string;
let inactiveUserId: string;
let wallUserId: string;
let changeUserId: string;

beforeAll(async () => {
  activeUserId = await createUser({ email: EMAIL.active, role: "REQUESTER", isActive: true, mustChangePassword: false });
  inactiveUserId = await createUser({
    email: EMAIL.inactive,
    role: "REQUESTER",
    isActive: false,
    mustChangePassword: false,
  });
  wallUserId = await createUser({ email: EMAIL.wall, role: "IT_STAFF", isActive: true, mustChangePassword: true });
  changeUserId = await createUser({ email: EMAIL.change, role: "REQUESTER", isActive: true, mustChangePassword: true });
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

describe("UNIT-01 · password complexity validator", () => {
  it("accepts a password satisfying every policy rule", () => {
    expect(validatePasswordComplexity(NEW_PASSWORD).valid).toBe(true);
  });

  it("rejects passwords that violate any policy rule", () => {
    for (const weak of ["Short1!", "alllower1!", "ALLUPPER1!", "NoNumberHere!", "NoSpecial1"]) {
      expect(validatePasswordComplexity(weak).valid).toBe(false);
    }
    expect(validatePasswordComplexity("").valid).toBe(false);
    expect(validatePasswordComplexity(undefined).valid).toBe(false);
  });

  it("hashes with bcrypt and verifies with constant-time compare", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).not.toBe(PASSWORD);
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword("DefinitelyWrong1!", hash)).toBe(false);
  });
});

describe("API-01 · POST /api/auth/login (valid credentials)", () => {
  it("returns 200, a sanitized profile, and an HTTP-only session cookie", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: EMAIL.active, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: activeUserId,
      email: EMAIL.active,
      role: "REQUESTER",
      requiresPasswordChange: false,
      isActive: true,
    });
    expect(res.body.user).not.toHaveProperty("passwordHash");

    const setCookie = res.headers["set-cookie"] as unknown as string[];
    expect(Array.isArray(setCookie)).toBe(true);
    const sessionCookie = setCookie.find((c) => c.startsWith("toktickit_session="));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
  });

  it("matches the email address case-insensitively", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: EMAIL.active.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(activeUserId);
  });
});

describe("API-02 · POST /api/auth/login (invalid credentials)", () => {
  it("rejects a wrong password with 401 and the uniform safe message", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: EMAIL.active, password: "WrongPass1!" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toBe("Invalid email or password.");
  });

  it("rejects an unknown email with the identical message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: `ghost.${STAMP}@toktickit.test`, password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password.");
  });

  it("returns 400 when email or password is missing", async () => {
    const missingPassword = await request(app).post("/api/auth/login").send({ email: EMAIL.active });
    expect(missingPassword.status).toBe(400);
    expect(missingPassword.body.error.code).toBe("BAD_REQUEST");

    const emptyBody = await request(app).post("/api/auth/login").send({});
    expect(emptyBody.status).toBe(400);
  });
});

describe("API-03 · POST /api/auth/login (inactive account)", () => {
  it("blocks deactivated accounts with 401 without leaking account existence", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: EMAIL.inactive, password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toBe("Invalid email or password.");
  });
});


describe("API-06 · GET /api/auth/me & POST /api/auth/logout", () => {
  it("returns the current user for an authenticated cookie session", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: EMAIL.active, password: PASSWORD }).expect(200);

    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: activeUserId, email: EMAIL.active, role: "REQUESTER" });
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 401 for /me without a session", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("supports the Authorization: Bearer <token> alternative", async () => {
    const login = await request(app).post("/api/auth/login").send({ email: EMAIL.active, password: PASSWORD });
    const setCookie = login.headers["set-cookie"] as unknown as string[];
    const cookieValue = setCookie.find((c) => c.startsWith("toktickit_session="))!.split(";")[0];
    const token = cookieValue.slice("toktickit_session=".length);

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(activeUserId);

    const tampered = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}tampered`);
    expect(tampered.status).toBe(401);
  });

  it("logs out by clearing the cookie and revoking access", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: EMAIL.active, password: PASSWORD }).expect(200);

    const res = await agent.post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Successfully logged out");
    const setCookie = res.headers["set-cookie"] as unknown as string[];
    expect(setCookie.some((c) => c.startsWith("toktickit_session=;"))).toBe(true);

    const after = await agent.get("/api/auth/me");
    expect(after.status).toBe(401);
  });

  it("returns 401 when logging out without a session", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(401);
  });
});

describe("API-04 · first-login password wall enforcement", () => {
  it("blocks operational endpoints (403 PASSWORD_CHANGE_REQUIRED) but allows /me and logout", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: EMAIL.wall, password: PASSWORD }).expect(200);

    const login = await request(app).post("/api/auth/login").send({ email: EMAIL.wall, password: PASSWORD });
    expect(login.body.user.requiresPasswordChange).toBe(true);

    const blocked = await agent.get("/api/tickets");
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.requiresPasswordChange).toBe(true);

    const out = await agent.post("/api/auth/logout");
    expect(out.status).toBe(200);
  });
});

describe("API-05 · POST /api/auth/change-password", () => {
  it("returns 400 for a new password that fails complexity", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: EMAIL.change, password: PASSWORD }).expect(200);

    const res = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: "weak", confirmPassword: "weak" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 400 when confirmation does not match", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: EMAIL.change, password: PASSWORD }).expect(200);

    const res = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: "Different456!" });
    expect(res.status).toBe(400);
  });

  it("returns 401 when the current password is incorrect", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: EMAIL.change, password: PASSWORD }).expect(200);

    const res = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: "WrongCurrent1!", newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 without an authenticated session", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
  });

  it("updates the password, clears the flag, and removes the password wall", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: EMAIL.change, password: PASSWORD }).expect(200);

    const res = await agent
      .post("/api/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password updated successfully");
    expect(res.body.user.requiresPasswordChange).toBe(false);
    expect(res.body.user).not.toHaveProperty("passwordHash");

    const persisted = await prisma.user.findUnique({ where: { id: changeUserId } });
    expect(persisted?.mustChangePassword).toBe(false);
    expect(await bcrypt.compare(NEW_PASSWORD, persisted!.passwordHash)).toBe(true);

    // The wall is lifted for the same session...
    const unblocked = await agent.get("/api/tickets");
    expect(unblocked.status).toBe(200);

    // ...and new credentials work while the old password no longer does.
    const relogin = await request(app).post("/api/auth/login").send({ email: EMAIL.change, password: NEW_PASSWORD });
    expect(relogin.status).toBe(200);
    const oldLogin = await request(app).post("/api/auth/login").send({ email: EMAIL.change, password: PASSWORD });
    expect(oldLogin.status).toBe(401);
  });
});


