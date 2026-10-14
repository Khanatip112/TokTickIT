import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * Minimal, dependency-free client router (Issue 4).
 *
 * The project does not ship a routing library, so this small provider keeps the
 * current pathname in React state, syncs it with the browser `History API`, and
 * exposes a `navigate()` helper plus a declarative `<Navigate />` redirect.
 */
interface RouterContextValue {
  path: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

function readPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

export function RouterProvider({
  children,
  initialPath,
}: {
  children: ReactNode;
  initialPath?: string;
}) {
  const [path, setPath] = useState<string>(() => initialPath ?? readPath());

  useEffect(() => {
    const handlePopState = () => setPath(readPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (typeof window !== "undefined") {
      if (options?.replace) window.history.replaceState({}, "", to);
      else window.history.pushState({}, "", to);
    }
    setPath(to);
  }, []);

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return ctx;
}

/** Declarative redirect: navigates to `to` on mount and renders nothing. */
export function Navigate({ to, replace = true }: { to: string; replace?: boolean }) {
  const { navigate } = useRouter();
  useEffect(() => {
    navigate(to, { replace });
  }, [to, replace, navigate]);
  return null;
}
