import crypto from "node:crypto";
import type { CookieOptions } from "express";

/**
 * Dependency-free, signed session tokens (Lab 3, BR-05).
 *
 * The session is a compact `payload.signature` token where the payload is a
 * base64url-encoded JSON object and the signature is an HMAC-SHA256 over that
 * payload using a server secret. It is delivered through the HTTP-only
 * `toktickit_session` cookie and may alternatively be presented as an
 * `Authorization: Bearer <token>` header for REST clients and integration tests.
 */
export const SESSION_COOKIE_NAME = "toktickit_session";

// Sessions expire after 8 hours by default (configurable via env).
export const SESSION_TTL_MS =
  Number(process.env.SESSION_TTL_MS) > 0 ? Number(process.env.SESSION_TTL_MS) : 8 * 60 * 60 * 1000;

const SESSION_SECRET = process.env.SESSION_SECRET || "toktickit-dev-session-secret";

export interface SessionTokenPayload {
  /** Authenticated user id. */
  uid: string;
  /** User role at the time of login. */
  role: string;
  /** Whether the user must still change their password. */
  mustChangePassword: boolean;
  /** Issued-at (epoch ms). */
  iat: number;
  /** Expiry (epoch ms). */
  exp: number;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

/** Creates a signed session token for the given user. */
export function createSessionToken(params: {
  userId: string;
  role: string;
  mustChangePassword: boolean;
  now?: number;
}): string {
  const iat = params.now ?? Date.now();
  const payload: SessionTokenPayload = {
    uid: params.userId,
    role: params.role,
    mustChangePassword: params.mustChangePassword,
    iat,
    exp: iat + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

/** Verifies a signed session token and returns its payload, or `null`. */
export function verifySessionToken(token: string, now: number = Date.now()): SessionTokenPayload | null {
  if (typeof token !== "string" || !token.includes(".")) return null;

  const separatorIndex = token.lastIndexOf(".");
  const encoded = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionTokenPayload;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Parses a raw `Cookie` request header into a key/value map. */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(part.slice(eqIndex + 1).trim());
  }
  return cookies;
}

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export const sessionCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  maxAge: SESSION_TTL_MS,
};

export const clearSessionCookieOptions: CookieOptions = { ...baseCookieOptions };
