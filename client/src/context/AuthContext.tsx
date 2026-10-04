import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AuthUser,
  changePassword as apiChangePassword,
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
} from "../api.js";

interface AuthContextValue {
  /** The authenticated user, or `null` when signed out. */
  user: AuthUser | null;
  /** `true` while the initial `GET /api/auth/me` session check is in flight. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ) => Promise<AuthUser>;
  /** Re-fetches the current session (used after external state changes). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Application-wide authentication state (Issue 4).
 * Initializes the session from `GET /api/auth/me` and exposes login/logout/
 * change-password actions. The session cookie is handled by the browser
 * (`credentials: "include"` in the API layer), so no token is stored in JS.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const current = await getCurrentUser();
        if (isMounted) setUser(current);
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      setUser(await getCurrentUser());
    } catch {
      setUser(null);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const loggedIn = await apiLogin(email, password);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string, confirmPassword: string) => {
      const updated = await apiChangePassword(currentPassword, newPassword, confirmPassword);
      setUser(updated);
      return updated;
    },
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout, changePassword, refresh }),
    [user, isLoading, login, logout, changePassword, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/** `true` when the user is authenticated and still must change their password. */
export function needsPasswordChange(user: AuthUser | null): boolean {
  return !!user && user.requiresPasswordChange === true;
}

/** Role-specific landing route used after a successful login / password change. */
export function landingPathFor(user: AuthUser | null): string {
  if (!user) return "/login";
  if (user.role === "ADMINISTRATOR") return "/admin/users";
  if (user.role === "IT_STAFF") return "/staff/queue";
  return "/my-tickets";
}
