import type { Role, User } from "@prisma/client";

/**
 * Sanitized user representation returned by the Administrator User Management
 * APIs (docs/lab-03/api-spec.md §3.5). Never includes `passwordHash`.
 * Exposes `requiresPasswordChange` (the contract field name) plus a
 * `mustChangePassword` mirror for clients that use the underlying column name.
 */
export interface AdminUserPayload {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  isActive: boolean;
  requiresPasswordChange: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}

/** Maps a persisted `User` row to the sanitized administrator payload. */
export function toAdminUser(user: User): AdminUserPayload {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    department: user.department ?? null,
    isActive: user.isActive,
    requiresPasswordChange: user.mustChangePassword,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}
