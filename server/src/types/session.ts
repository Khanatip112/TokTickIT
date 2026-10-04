import type { Role } from "@prisma/client";

/**
 * Sanitized representation of the authenticated user stored on the request by
 * the `loadSession` middleware. It intentionally mirrors the public API naming
 * (`requiresPasswordChange`) instead of the database column name
 * (`mustChangePassword`) and NEVER carries `passwordHash`.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  isActive: boolean;
  requiresPasswordChange: boolean;
}
