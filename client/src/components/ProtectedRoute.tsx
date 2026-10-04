import React, { ReactNode } from "react";
import { needsPasswordChange, useAuth } from "../context/AuthContext.js";
import { Navigate, useRouter } from "../router.js";

/**
 * Route guard (Issue 4).
 * - Unauthenticated users are redirected to `/login`.
 * - Users flagged with `requiresPasswordChange` are forced to `/change-password`
 *   and blocked from every other feature route until they comply.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { path } = useRouter();

  if (isLoading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <div className="spinner-border text-zen-primary" role="status">
            <span className="visually-hidden">Loading…</span>
          </div>
          <p className="mt-3 text-muted">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (needsPasswordChange(user) && path !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}
