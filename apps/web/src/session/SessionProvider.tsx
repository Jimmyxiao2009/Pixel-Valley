import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { DemoPersona, MeResponse } from "@pixel-valley/domain";
import { demoLogin, fetchMe, logout as logoutRequest } from "../data/api";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type SessionContextValue = {
  status: SessionStatus;
  me: MeResponse | null;
  login: (persona: DemoPersona) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchMe();
      setMe(next);
      setStatus("authenticated");
    } catch {
      setMe(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (persona: DemoPersona) => {
    const next = await demoLogin(persona);
    setMe(next);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setMe(null);
      setStatus("unauthenticated");
    }
  }, []);

  const value = useMemo(
    () => ({ status, me, login, logout, refresh }),
    [status, me, login, logout, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession 必须放在 SessionProvider 里");
  }
  return value;
}

function BootScreen() {
  return (
    <div className="session-boot font-pixel" role="status">
      正在开门…
    </div>
  );
}

export function RequireAuth() {
  const { status } = useSession();
  if (status === "loading") {
    return <BootScreen />;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { status } = useSession();
  if (status === "loading") {
    return <BootScreen />;
  }
  if (status === "authenticated") {
    return <Navigate to="/home" replace />;
  }
  return children;
}
