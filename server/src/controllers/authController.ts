import type { Request, Response } from "express";
import { getPrisma } from "../prisma.js";
import { hashPassword, validatePasswordComplexity, verifyPassword } from "../utils/password.js";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookieOptions,
  createSessionToken,
  sessionCookieOptions,
} from "../utils/session.js";
import { sessionUserToPublicUser, toPublicUser } from "../utils/user.js";

// Uniform, safe authentication failure message (prevents account enumeration).
const INVALID_CREDENTIALS = "Invalid email or password.";

/**
 * POST /api/auth/login
 * Authenticates a user and establishes a signed, HTTP-only session.
 */
export async function login(req: Request, res: Response): Promise<Response> {
  try {
    const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };

    if (typeof email !== "string" || email.trim() === "" || typeof password !== "string" || password === "") {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Email and password are required.",
          details: [
            ...(typeof email !== "string" || email.trim() === ""
              ? [{ field: "email", message: "Email is required." }]
              : []),
            ...(typeof password !== "string" || password === ""
              ? [{ field: "password", message: "Password is required." }]
              : []),
          ],
        },
      });
    }

    const user = await getPrisma().user.findUnique({ where: { email: email.trim().toLowerCase() } });

    // Unknown email and deactivated accounts share the identical safe response
    // so no account metadata is leaked (BR-01 / FR-02).
    if (!user || !user.isActive) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: INVALID_CREDENTIALS } });
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: INVALID_CREDENTIALS } });
    }

    const token = createSessionToken({
      userId: user.id,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
    res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions);

    return res.status(200).json({ user: toPublicUser(user) });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Login failed." } });
  }
}

/**
 * POST /api/auth/logout
 * Clears the session cookie so the browser no longer presents it.
 */
export async function logout(_req: Request, res: Response): Promise<Response> {
  try {
    res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions);
    return res.status(200).json({ message: "Successfully logged out" });
  } catch (error) {
    console.error("POST /api/auth/logout error:", error);
    return res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Logout failed." } });
  }
}

/**
 * GET /api/auth/me
 * Returns the authenticated user's sanitized profile.
 */
export async function me(req: Request, res: Response): Promise<Response> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "No active session." } });
    }
    return res.status(200).json({ user: sessionUserToPublicUser(req.user) });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to load profile." } });
  }
}

/**
 * POST /api/auth/change-password
 * Validates the current password, enforces the complexity policy, persists the
 * new hash and clears the `requiresPasswordChange` flag (FR-03 / FR-04 / BR-03).
 */
export async function changePassword(req: Request, res: Response): Promise<Response> {
  try {
    if (!req.user) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
    }

    const { currentPassword, newPassword, confirmPassword } = (req.body ?? {}) as {
      currentPassword?: unknown;
      newPassword?: unknown;
      confirmPassword?: unknown;
    };

    if (typeof currentPassword !== "string" || currentPassword === "") {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "Current password is required.",
          details: [{ field: "currentPassword", message: "Current password is required." }],
        },
      });
    }

    const user = await getPrisma().user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
    }

    const currentMatches = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentMatches) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Current password is incorrect." },
      });
    }

    const complexity = validatePasswordComplexity(newPassword);
    if (!complexity.valid) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "New password does not meet the complexity requirements.",
          details: complexity.errors.map((message) => ({ field: "newPassword", message })),
        },
      });
    }

    if (typeof confirmPassword !== "string" || confirmPassword !== newPassword) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "New password and confirmation do not match.",
          details: [{ field: "confirmPassword", message: "Passwords do not match." }],
        },
      });
    }

    const passwordHash = await hashPassword(newPassword as string);
    const updatedUser = await getPrisma().user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    // Re-issue the session so the cleared password-change flag is reflected.
    const token = createSessionToken({
      userId: updatedUser.id,
      role: updatedUser.role,
      mustChangePassword: updatedUser.mustChangePassword,
    });
    res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions);

    return res.status(200).json({
      message: "Password updated successfully",
      user: toPublicUser(updatedUser),
    });
  } catch (error) {
    console.error("POST /api/auth/change-password error:", error);
    return res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to change password." } });
  }
}
