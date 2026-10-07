"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthenticatedPrincipal } from "@/server/platform/types";

interface AuthContextValue {
  mode: "LOCAL_DEMO" | "SERVER";
  user?: AuthenticatedPrincipal;
  loading: boolean;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const mode = process.env.NEXT_PUBLIC_APP_MODE === "SERVER" ? "SERVER" : "LOCAL_DEMO";
  const [user, setUser] = useState<AuthenticatedPrincipal>();
  const [loading, setLoading] = useState(mode === "SERVER" && pathname !== "/login");

  useEffect(() => {
    if (mode !== "SERVER") return;
    if (pathname === "/login") return;
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => response.ok ? (await response.json() as { user: AuthenticatedPrincipal }).user : undefined)
      .then((loaded) => {
        if (!active) return;
        setUser(loaded);
        if (!loaded) router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, pathname, router]);

  const value = useMemo<AuthContextValue>(() => ({
    mode,
    user,
    loading,
    logout: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(undefined);
      router.push("/login");
    },
  }), [loading, mode, router, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
