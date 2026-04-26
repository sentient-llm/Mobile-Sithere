import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { projectId, publicAnonKey } from "/utils/supabase/info";

// ── Types ──────────────────────────────────────────────────────────────────

export type UserRole = "owner" | "walker";

export interface AuthUser {
  id:    string;
  email: string;
  name:  string;
  role:  UserRole;
}

interface AuthContextType {
  session:  Session | null;
  user:     AuthUser | null;
  loading:  boolean;
  signIn:   (email: string, password: string) => Promise<{ error: string | null }>;
  signUp:   (name: string, email: string, password: string, role: UserRole) => Promise<{ error: string | null }>;
  signOut:  () => Promise<void>;
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  function mapUser(supaUser: Session["user"] | null): AuthUser | null {
    if (!supaUser) return null;
    return {
      id:    supaUser.id,
      email: supaUser.email ?? "",
      name:  supaUser.user_metadata?.name ?? supaUser.email?.split("@")[0] ?? "User",
      role:  (supaUser.user_metadata?.role as UserRole) ?? "owner",
    };
  }

  // Restore session on mount & subscribe to auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(mapUser(session?.user ?? null));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(mapUser(session?.user ?? null));
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Sign in with email + password
  async function signIn(
    email: string,
    password: string,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Sign in error:", error.message);
      return { error: error.message };
    }
    return { error: null };
  }

  // Create a new account via the server (needs admin key for email_confirm: true)
  async function signUp(
    name: string,
    email: string,
    password: string,
    role: UserRole,
  ): Promise<{ error: string | null }> {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-f29bc816/signup`,
        {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ name, email, password, role }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        console.error("Signup server error:", data.error);
        return { error: data.error ?? "Signup failed" };
      }

      // Auto sign-in after successful signup
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        console.error("Auto sign-in after signup failed:", signInError.message);
        return { error: signInError.message };
      }

      return { error: null };
    } catch (err) {
      const msg = `Network error during signup: ${err}`;
      console.error(msg);
      return { error: msg };
    }
  }

  // Sign out
  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be called inside <AuthProvider>");
  return ctx;
}
