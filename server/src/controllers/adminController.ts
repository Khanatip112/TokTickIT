import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import type { Role } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { hashPassword, validatePasswordComplexity } from "../utils/password.js";
import { toAdminUser } from "../utils/adminUser.js";

const ROLES: readonly Role[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;

interface FieldError {
  field: string;
  message: string;
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

function errorPayload(code: string, message: string, details?: FieldError[]) {
  return { error: { code, message, ...(details && details.length ? { details } : {}) } };
}

function badRequest(res: Response, message: string, details?: FieldError[]) {
  return res.status(400).json(errorPayload("BAD_REQUEST", message, details));
}

function conflict(res: Response, message: string) {
  return res.status(409).json(errorPayload("CONFLICT", message, [{ field: "email", message }]));
}

function notFound(res: Response, message: string) {
  return res.status(404).json(errorPayload("NOT_FOUND", message));
}

function unprocessable(res: Response, message: string) {
  return res.status(422).json(errorPayload("UNPROCESSABLE_ENTITY", message));
}

function serverError(res: Response, scope: string, error: unknown) {
  console.error(`${scope} error:`, error);
  return res.status(500).json(errorPayload("INTERNAL_SERVER_ERROR", "An unexpected error occurred."));
}

/** Generates a complexity-compliant temporary password (upper, lower, digit, special, >= 8). */
export function generateTemporaryPassword(): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const special = "!@#$%&*";
  const pick = (set: string, count: number) =>
    Array.from({ length: count }, () => set.charAt(Math.floor(Math.random() * set.length))).join("");

  const chars = [
    pick(upper, 1),
    pick(lower, 4),
    pick(digits, 2),
    pick(special, 1),
    pick(lower + upper + digits, 4),
  ]
    .join("")
    .split("");

  // Fisher-Yates shuffle so the guaranteed classes are not position-predictable.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join("");
}

/**
 * GET /api/admin/users
 * User directory with optional case-insensitive search (`search` or `q`),
 * role filter (`role`), status filter (`isActive`) and pagination.
 */
export async function listUsers(req: Request, res: Response): Promise<Response> {
  try {
    const prisma = getPrisma();
    const searchParam = req.query.search ?? req.query.q;
    const roleParam = req.query.role;
    const isActiveParam = req.query.isActive;
    const pageParam = req.query.page;
    const pageSizeParam = req.query.pageSize;

    const where: Prisma.UserWhereInput = {};

    if (typeof searchParam === "string" && searchParam.trim() !== "") {
      const term = searchParam.trim();
      where.OR = [
        { fullName: { contains: term, mode: "insensitive" } },
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ];
    }
    if (isRole(roleParam)) {
      where.role = roleParam;
    }
    if (typeof isActiveParam === "string") {
      const normalized = isActiveParam.toLowerCase();
      if (normalized === "true" || normalized === "1") where.isActive = true;
      else if (normalized === "false" || normalized === "0") where.isActive = false;
    }

    const query: Prisma.UserFindManyArgs = { where, orderBy: [{ createdAt: "desc" }] };
    const page = Number.parseInt(typeof pageParam === "string" ? pageParam : "", 10);
    const pageSize = Number.parseInt(typeof pageSizeParam === "string" ? pageSizeParam : "", 10);
    if (Number.isFinite(page) && Number.isFinite(pageSize) && page > 0 && pageSize > 0) {
      query.skip = (page - 1) * pageSize;
      query.take = pageSize;
    }

    const users = await prisma.user.findMany(query);
    return res.status(200).json(users.map(toAdminUser));
  } catch (error) {
    return serverError(res, "GET /api/admin/users", error);
  }
}

/**
 * POST /api/admin/users
 * Creates a user account. Always flags the account with
 * `requiresPasswordChange = true` (BR-25). A temporary password is generated
 * when `initialPassword` is omitted and returned once in the response.
 */
export async function createUser(req: Request, res: Response): Promise<Response> {
  try {
    const prisma = getPrisma();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const details: FieldError[] = [];

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
      details.push({
        field: "name",
        message: `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.`,
      });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !EMAIL_REGEX.test(email)) {
      details.push({ field: "email", message: "A valid email address is required." });
    }

    const role = isRole(body.role) ? body.role : null;
    if (!role) {
      details.push({ field: "role", message: "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR." });
    }

    let isActive = true;
    if (body.isActive !== undefined) {
      if (typeof body.isActive === "boolean") isActive = body.isActive;
      else details.push({ field: "isActive", message: "isActive must be a boolean." });
    }

    const department =
      typeof body.department === "string" && body.department.trim() !== "" ? body.department.trim() : null;

    let initialPassword = "";
    let generatedPassword: string | null = null;
    if (body.initialPassword === undefined || body.initialPassword === null || body.initialPassword === "") {
      generatedPassword = generateTemporaryPassword();
      initialPassword = generatedPassword;
    } else if (typeof body.initialPassword === "string") {
      const result = validatePasswordComplexity(body.initialPassword);
      if (!result.valid) {
        result.errors.forEach((message) => details.push({ field: "initialPassword", message }));
      }
      initialPassword = body.initialPassword;
    } else {
      details.push({ field: "initialPassword", message: "Initial password must be a string." });
    }

    if (details.length > 0) return badRequest(res, "Validation failed.", details);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return conflict(res, "Email address is already in use");

    const passwordHash = await hashPassword(initialPassword);
    const created = await prisma.user.create({
      data: {
        email,
        fullName: name,
        name,
        role: role as Role,
        department,
        isActive,
        mustChangePassword: true,
        passwordHash,
      },
    });

    const payload: Record<string, unknown> = { ...toAdminUser(created) };
    if (generatedPassword) payload.temporaryPassword = generatedPassword;
    return res.status(201).json(payload);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return conflict(res, "Email address is already in use");
    }
    return serverError(res, "POST /api/admin/users", error);
  }
}

/**
 * PATCH /api/admin/users/:id  (also exposed as PUT per the Issue 5 task wording)
 * Updates name / email / role / department / active status, enforcing the
 * self-deactivation and last-active-administrator safety invariants.
 */
export async function updateUser(req: Request, res: Response): Promise<Response> {
  try {
    const prisma = getPrisma();
    const actor = req.user;
    if (!actor) {
      return res.status(401).json(errorPayload("UNAUTHORIZED", "Authentication required."));
    }

    const { id } = req.params;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return notFound(res, "User not found");

    const details: FieldError[] = [];

    let nextFullName = target.fullName;
    if (body.name !== undefined) {
      const value = typeof body.name === "string" ? body.name.trim() : "";
      if (value.length < NAME_MIN_LENGTH || value.length > NAME_MAX_LENGTH) {
        details.push({
          field: "name",
          message: `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.`,
        });
      } else {
        nextFullName = value;
      }
    }

    let nextEmail = target.email;
    if (body.email !== undefined) {
      const value = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!value || !EMAIL_REGEX.test(value)) {
        details.push({ field: "email", message: "A valid email address is required." });
      } else {
        nextEmail = value;
      }
    }

    let nextRole: Role = target.role;
    if (body.role !== undefined) {
      if (isRole(body.role)) nextRole = body.role;
      else details.push({ field: "role", message: "Role must be REQUESTER, IT_STAFF, or ADMINISTRATOR." });
    }

    let nextIsActive = target.isActive;
    if (body.isActive !== undefined) {
      if (typeof body.isActive === "boolean") nextIsActive = body.isActive;
      else details.push({ field: "isActive", message: "isActive must be a boolean." });
    }

    let nextDepartment = target.department;
    if (body.department !== undefined) {
      nextDepartment =
        typeof body.department === "string" && body.department.trim() !== "" ? body.department.trim() : null;
    }

    if (details.length > 0) return badRequest(res, "Validation failed.", details);

    const demoting = target.role === "ADMINISTRATOR" && nextRole !== "ADMINISTRATOR";
    const deactivating = nextIsActive === false;
    const removingActiveAdmin = target.role === "ADMINISTRATOR" && target.isActive && (demoting || deactivating);

    // BR-23: never allow the last active Administrator to be removed or demoted.
    if (removingActiveAdmin) {
      const otherActiveAdmins = await prisma.user.count({
        where: { role: "ADMINISTRATOR", isActive: true, id: { not: id } },
      });
      if (otherActiveAdmins === 0) {
        return unprocessable(res, "Cannot deactivate or demote the last active Administrator");
      }
    }

    // BR-22: an Administrator cannot deactivate their own account.
    if (id === actor.id && deactivating) {
      return unprocessable(res, "Cannot deactivate your own administrator account");
    }

    // FR-28: an Administrator cannot demote their own account.
    if (id === actor.id && demoting) {
      return unprocessable(res, "Cannot change your own administrator role");
    }

    if (nextEmail !== target.email) {
      const clash = await prisma.user.findUnique({ where: { email: nextEmail } });
      if (clash && clash.id !== id) return conflict(res, "Email address is already in use");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        fullName: nextFullName,
        name: nextFullName,
        email: nextEmail,
        role: nextRole,
        isActive: nextIsActive,
        department: nextDepartment,
      },
    });

    return res.status(200).json(toAdminUser(updated));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return conflict(res, "Email address is already in use");
    }
    return serverError(res, "PATCH /api/admin/users/:id", error);
  }
}

/**
 * POST /api/admin/users/:id/reset-password
 * Sets a new temporary password and forces a change on next login (BR-25).
 */
export async function resetPassword(req: Request, res: Response): Promise<Response> {
  try {
    const prisma = getPrisma();
    const { id } = req.params;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return notFound(res, "User not found");

    if (typeof body.initialPassword !== "string" || body.initialPassword === "") {
      return badRequest(res, "Initial password is required.", [
        { field: "initialPassword", message: "Initial password is required." },
      ]);
    }

    const result = validatePasswordComplexity(body.initialPassword);
    if (!result.valid) {
      return badRequest(
        res,
        "Password does not meet the complexity requirements.",
        result.errors.map((message) => ({ field: "initialPassword", message }))
      );
    }

    const passwordHash = await hashPassword(body.initialPassword);
    await prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });

    return res.status(200).json({
      message: "Initial password set successfully. User will be required to change password on next login.",
      userId: id,
    });
  } catch (error) {
    return serverError(res, "POST /api/admin/users/:id/reset-password", error);
  }
}
