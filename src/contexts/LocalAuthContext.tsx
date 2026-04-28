import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export type LocalRole = "admin" | "co-admin" | "instructor";

export interface LocalSession {
  role: LocalRole;
  username?: string;       // for instructors
  displayName?: string;    // for instructors
}

interface LocalAuthContextValue {
  session: LocalSession | null;
  loading: boolean;
  setSession: (s: LocalSession | null) => void;
  signOut: () => void;
}

const STORAGE_KEY = "fairfeedback.session.v1";

const LocalAuthContext = createContext<LocalAuthContextValue | undefined>(undefined);

export const LocalAuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSessionState] = useState<LocalSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSessionState(JSON.parse(raw) as LocalSession);
    } catch {
      // ignore corrupt storage
    }
    setLoading(false);
  }, []);

  const setSession = useCallback((s: LocalSession | null) => {
    setSessionState(s);
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const signOut = useCallback(() => {
    setSessionState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <LocalAuthContext.Provider value={{ session, loading, setSession, signOut }}>
      {children}
    </LocalAuthContext.Provider>
  );
};

export const useLocalAuth = () => {
  const ctx = useContext(LocalAuthContext);
  if (!ctx) throw new Error("useLocalAuth must be used inside LocalAuthProvider");
  return ctx;
};
