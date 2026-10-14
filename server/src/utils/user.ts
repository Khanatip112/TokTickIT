import type { Role, User } from "@prisma/client";
import type { SessionUser } from "../types/session.js";

/**
 * Public, sanitized shape returned by the authentication endpoints.
 * The API exposes `requiresPasswordChange` (per docs/lab-03/api-spec.md) and a
 * `mustChangePassword` mirror for clients that use the underlying column name.
 * `passwordHash` is never included.
 */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  isActive: boolean;
  requiresPasswordChange: boolean;
  mustChangePassword: boolean;
}

/** Maps a persisted `User` row to the sanitized session representation. */
export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    department: user.department ?? null,
    isActive: user.isActive,
    requiresPasswordChange: user.mustChangePassword,
  };
}

/** Maps a persisted `User` row to the sanitized public payload. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    department: user.department ?? null,
    isActive: user.isActive,
    requiresPasswordChange: user.mustChangePassword,
    mustChangePassword: user.mustChangePassword,
  };
}

/** Maps the request-scoped `SessionUser` to the sanitized public payload. */
export function sessionUserToPublicUser(user: SessionUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    isActive: user.isActive,
    requiresPasswordChange: user.requiresPasswordChange,
    mustChangePassword: user.requiresPasswordChange,
  };
}
