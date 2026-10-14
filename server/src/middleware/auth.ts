import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { SESSION_COOKIE_NAME, parseCookies, verifySessionToken } from "../utils/session.js";
import { toSessionUser } from "../utils/user.js";

/**
 * Extracts the raw session token from the request, preferring an
 * `Authorization: Bearer <token>` header and falling back to the
 * `toktickit_session` HTTP-only cookie.
 */
export function extractSessionToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (authorization && authorization.startsWith("Bearer ")) {
    const bearerToken = authorization.slice("Bearer ".length).trim();
    if (bearerToken) return bearerToken;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] ?? null;
}

/**
 * Hydrates `req.user` from a valid session token. This middleware never blocks
 * a request on its own: when no valid session is present it simply calls
 * `next()`, letting `requireAuth` (or the legacy compatibility bridge) decide.
 */
export async function loadSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractSessionToken(req);
    if (!token) return next();

    const payload = verifySessionToken(token);
    if (!payload) return next();

    const user = await getPrisma().user.findUnique({ where: { id: payload.uid } });
    // Deactivated accounts lose access immediately, even mid-session.
    if (!user || !user.isActive) return next();

    req.user = toSessionUser(user);
    return next();
  } catch (error) {
    console.error("loadSession error:", error);
    return next();
  }
}

/** Rejects unauthenticated requests with HTTP 401 using the standard envelope. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required. Please log in." },
    });
    return;
  }
  next();
}

/**
 * Enforces the first-login password wall (BR-02). Authenticated users flagged
 * with `requiresPasswordChange` are blocked (HTTP 403 / `PASSWORD_CHANGE_REQUIRED`)
 * from every operational endpoint. Unauthenticated / legacy-header requests are
 * passed through untouched so the Lab 2 compatibility bridge keeps working.
 */
export function enforcePasswordChange(req: Request, res: Response, next: NextFunction): void {
  if (req.user && req.user.requiresPasswordChange) {
    res.status(403).json({
      error: {
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "You must change your password before accessing this resource.",
      },
    });
    return;
  }
  next();
}

/** Restricts a route to the given roles (server-side RBAC enforcement). */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required. Please log in." },
      });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied." } });
      return;
    }
    next();
  };
}
