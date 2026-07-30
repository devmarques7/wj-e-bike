import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type MemberTier = "light" | "plus" | "black";
export type UserRole = "guest" | "customer" | "admin" | "staff";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tier?: MemberTier;
  bikeId?: string;
  bikeName?: string;
  purchaseDate?: string;
  estimatedDailyKm?: number;
  totalKm?: number;
  avatar?: string;
  isDemo?: boolean;
  mustCompleteProfile?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    remember?: boolean
  ) => Promise<{ success: boolean; code?: string; message?: string }>;
  logout: () => Promise<void>;
  updateAvatar: (url: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Build a real user from a Supabase session by reading profile + user_roles
  const hydrateFromSession = async (session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    const authUser = session.user;
    setIsLoading(true);
    // Defer DB calls so onAuthStateChange stays sync-safe
    setTimeout(async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, avatar_url, must_complete_profile")
          .eq("user_id", authUser.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authUser.id),
      ]);

      const roleNames = (roles ?? []).map((r: any) => r.role);
      const role: UserRole = roleNames.includes("admin")
        ? "admin"
        : roleNames.includes("staff")
        ? "staff"
        : roleNames.includes("customer")
        ? "customer"
        : "customer";

      const next: User = {
        id: authUser.id,
        name: profile?.full_name || authUser.email?.split("@")[0] || "Member",
        email: profile?.email || authUser.email || "",
        role,
        avatar: profile?.avatar_url || undefined,
        isDemo: false,
        mustCompleteProfile: !!(profile as any)?.must_complete_profile,
      };
      setUser(next);
      setIsLoading(false);
    }, 0);
  };

  useEffect(() => {
    // 1. Subscribe FIRST, then 2. fetch existing session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateFromSession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        hydrateFromSession(session);
      } else {
        setIsLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (
    email: string,
    password: string,
    _remember: boolean = false
  ) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.session) {
      return {
        success: false,
        code: (error as any)?.code,
        message: error?.message,
      };
    }
    return { success: true };
  };

  const logout = async () => {
    // Sign out of Supabase (no-op if there is no session)
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — still clear local state below
    }
    setUser(null);
    // Wipe any lingering Supabase tokens from session/local storage
    try {
      const wipe = (storage: Storage) => {
        const keys: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && (k.startsWith("sb-") || k.includes("supabase.auth"))) keys.push(k);
        }
        keys.forEach((k) => storage.removeItem(k));
      };
      wipe(localStorage);
      wipe(sessionStorage);
    } catch {
      // ignore
    }
  };

  const updateAvatar = (url: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, avatar: url };
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
