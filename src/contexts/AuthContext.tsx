import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "instructor";

interface UserRoleInfo {
  role: AppRole;
  instructor_id: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  roleInfo: UserRoleInfo | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roleInfo, setRoleInfo] = useState<UserRoleInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (uid: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role, instructor_id")
      .eq("user_id", uid)
      .order("role", { ascending: true }) // admin sorts before instructor
      .limit(1)
      .maybeSingle();
    if (data) {
      setRoleInfo({ role: data.role as AppRole, instructor_id: data.instructor_id ?? null });
    } else {
      setRoleInfo(null);
    }
  };

  useEffect(() => {
    // 1) Listener first
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // defer to avoid recursion inside auth callback
        setTimeout(() => fetchRole(newSession.user.id), 0);
      } else {
        setRoleInfo(null);
      }
    });

    // 2) Then existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchRole(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoleInfo(null);
  };

  const refreshRole = async () => {
    if (user) await fetchRole(user.id);
  };

  return (
    <AuthContext.Provider value={{ session, user, roleInfo, loading, signIn, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
