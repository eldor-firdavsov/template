import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Barber } from "../lib/types";

interface BarberAuthContextType {
  user: any | null;
  barber: Barber | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshBarber: () => Promise<void>;
}

const BarberAuthContext = createContext<BarberAuthContextType | undefined>(undefined);

export const BarberAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBarberRecord = async (authUser: any) => {
    if (!authUser) {
      setBarber(null);
      return;
    }

    try {
      // Look up by auth_user_id first, then fallback to email
      let { data } = await supabase
        .from("barbers")
        .select("*, location:locations(*)")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();

      if (!data && authUser.email) {
        const cleanEmail = authUser.email.trim().toLowerCase();
        const { data: emailData } = await supabase
          .from("barbers")
          .select("*, location:locations(*)")
          .ilike("email", cleanEmail)
          .maybeSingle();
        
        if (emailData) {
          data = emailData;
          // Auto-link auth_user_id if not linked yet
          if (!emailData.auth_user_id) {
            await supabase.from("barbers").update({ auth_user_id: authUser.id }).eq("id", emailData.id);
            data = { ...emailData, auth_user_id: authUser.id };
          }
        }
      }

      setBarber(data || null);
    } catch (err) {
      console.error("Error fetching barber profile:", err);
      setBarber(null);
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const authUser = session?.user ?? null;
      setUser(authUser);
      if (authUser) {
        fetchBarberRecord(authUser).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);
      if (authUser) {
        fetchBarberRecord(authUser);
      } else {
        setBarber(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (data.user) {
      await fetchBarberRecord(data.user);
    }
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setBarber(null);
  };

  const refreshBarber = async () => {
    if (user) {
      await fetchBarberRecord(user);
    }
  };

  return (
    <BarberAuthContext.Provider
      value={{
        user,
        barber,
        loading,
        signIn,
        signOut,
        refreshBarber,
      }}
    >
      {children}
    </BarberAuthContext.Provider>
  );
};

export const useBarberAuth = () => {
  const context = useContext(BarberAuthContext);
  if (!context) {
    throw new Error("useBarberAuth must be used within a BarberAuthProvider");
  }
  return context;
};
