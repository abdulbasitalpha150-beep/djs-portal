import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiFetch } from "./api-client";
import type { Role } from "./roles";

type Session = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: string;
  isTemporaryPassword?: boolean;
};

type SessionMonitorStatus = "active" | "paused" | "expired";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  clockedIn: boolean;
  sessionStatus: SessionMonitorStatus;
  sessionTimeRemainingMs: number | null;
  lastActivityAt: number | null;
  signIn: (email: string, password: string) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => Promise<void>;
  signOut: (force?: boolean) => Promise<void>;
  setRole: (role: Role) => void;
  setClockedIn: (value: boolean) => void;
};

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const CLOCKED_IN_STORAGE_KEY = "portal-clocked-in";
const LAST_ACTIVITY_STORAGE_KEY = "portal-last-activity";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roleOverride, setRoleOverride] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockedIn, setClockedInState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CLOCKED_IN_STORAGE_KEY) === "true";
  });
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
    return raw ? Number(raw) : null;
  });
  const [sessionTimeRemainingMs, setSessionTimeRemainingMs] = useState<number | null>(null);

  const updateLastActivity = () => {
    const now = Date.now();
    setLastActivityAt(now);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
    }
  };

  const clearClientSession = () => {
    setRoleOverride(null);
    setSession(null);
    setClockedInState(false);
    setLastActivityAt(null);
    setSessionTimeRemainingMs(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CLOCKED_IN_STORAGE_KEY);
      window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
    }
  };

  const sendLogoutSignal = async (reason: "manual" | "timeout" | "unload" = "manual") => {
    if (typeof window === "undefined") return;

    try {
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const payload = JSON.stringify({ reason });
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/auth/logout", blob);
        return;
      }

      await apiFetch<{ message: string }>('/api/auth/logout', { method: "POST", keepalive: true });
    } catch {
      // Ignore logout errors; the local session will still be cleared.
    }
  };

  const handleSignOut = async (force = false) => {
    if (!force && clockedIn) {
      toast.error("You must Clock Out before logging out.");
      throw new Error("You must Clock Out before logging out.");
    }

    try {
      await apiFetch<{ message: string }>("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore logout errors, clear local session anyway
    }
    clearClientSession();
  };

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const payload = await apiFetch<{ user: Session }>("/api/auth/session", { method: "GET" });
        if (active) {
          setSession(payload.data.user);
          updateLastActivity();
        }
      } catch {
        if (active) {
          setSession(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session || loading) return;
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    const handleActivity = () => updateLastActivity();

    events.forEach((eventName) =>
      window.addEventListener(eventName, handleActivity, { passive: true }),
    );
    updateLastActivity();

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
    };
  }, [session, loading]);

  useEffect(() => {
    if (!session || loading || clockedIn) {
      setSessionTimeRemainingMs(null);
      return;
    }

    const updateRemaining = () => {
      const now = Date.now();
      const last = lastActivityAt ?? now;
      const remaining = Math.max(0, SESSION_TIMEOUT_MS - (now - last));
      setSessionTimeRemainingMs(remaining);

      if (remaining <= 0) {
        void sendLogoutSignal("timeout");
        void handleSignOut(true);
      }
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(intervalId);
  }, [session, loading, clockedIn, lastActivityAt]);

  const effectiveSession = useMemo(() => {
    if (!session) return null;
    return roleOverride ? { ...session, role: roleOverride } : session;
  }, [session, roleOverride]);

  const sessionStatus: SessionMonitorStatus = !effectiveSession
    ? "expired"
    : clockedIn
      ? "paused"
      : sessionTimeRemainingMs === 0
        ? "expired"
        : "active";

  const value = useMemo<AuthContextValue>(
    () => ({
      session: effectiveSession,
      loading,
      clockedIn,
      sessionStatus,
      sessionTimeRemainingMs,
      lastActivityAt,
      signIn: async (email: string, password: string) => {
        const payload = await apiFetch<{ user: Session }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setRoleOverride(null);
        setSession(payload.data.user);
        setClockedInState(false);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(CLOCKED_IN_STORAGE_KEY);
        }
        updateLastActivity();
      },
      changePassword: async (
        currentPassword: string,
        newPassword: string,
        confirmPassword: string,
      ) => {
        const payload = await apiFetch<{ user: Session }>("/api/auth/change-password", {
          method: "POST",
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });
        setSession(payload.data.user);
      },
      signOut: handleSignOut,
      setRole: (role: Role) => {
        setRoleOverride(role);
      },
      setClockedIn: (value: boolean) => {
        setClockedInState(value);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(CLOCKED_IN_STORAGE_KEY, String(value));
        }
        updateLastActivity();
      },
    }),
    [effectiveSession, loading, clockedIn, sessionStatus, sessionTimeRemainingMs, lastActivityAt, handleSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
