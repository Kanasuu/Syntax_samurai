import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "admin" | "student" | null;

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role;
  fullName: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: "admin" | "student") => Promise<{ error: Error | null; confirmEmail?: boolean }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadRole(uid: string) {
    const [{ data: roleRow }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
    ]);
    setRole((roleRow?.role as Role) ?? null);
    setFullName(profile?.full_name ?? null);
  }

  useEffect(() => {
    // Set up listener BEFORE getSession (per Supabase docs)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer role fetch to avoid deadlock
        setTimeout(() => loadRole(sess.user.id), 0);
      } else {
        setRole(null);
        setFullName(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadRole(sess.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, full_name: string, role: "admin" | "student") => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name, role },
      },
    });

    // Supabase returns a fake user with empty identities when the email already exists
    // (security feature to prevent user enumeration)
    if (!error && data?.user && data.user.identities?.length === 0) {
      return { error: new Error("An account with this email already exists. Please sign in instead.") };
    }

    // If signup succeeded but no session, email confirmation is required
    if (!error && data?.user && !data.session) {
      return { error: null, confirmEmail: true };
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setFullName(null);
  };

  const refreshRole = async () => {
    if (user) await loadRole(user.id);
  };

  return (
    <Ctx.Provider value={{ user, session, role, fullName, loading, signIn, signUp, signOut, refreshRole }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
