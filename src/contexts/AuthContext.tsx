import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { clearStoredAuthTokens, readStoredSession, shouldClearStoredSession } from '@/lib/auth-storage';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    const persistedSession = readStoredSession();
    if (persistedSession) {
      applySession(persistedSession);
    }

    // Set up listener FIRST (synchronous handler — never put async work here)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    // THEN check existing session, with stale-token recovery
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        applySession(session);
      })
      .catch((err) => {
        console.warn('[Auth] getSession failed:', err?.message);
        if (shouldClearStoredSession(err)) clearStoredAuthTokens();
        applySession(null);
      })
      .finally(() => {
        if (!persistedSession) applySession(null);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    // Check if account is active and not expired
    if (signInData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active, expires_at')
        .eq('user_id', signInData.user.id)
        .single();

      if (profile) {
        if (!profile.is_active) {
          await supabase.auth.signOut();
          return { error: { message: 'تم تعطيل حسابك. تواصل مع المدير.' } };
        }
        if (profile.expires_at && new Date(profile.expires_at) < new Date()) {
          await supabase.auth.signOut();
          return { error: { message: 'انتهت صلاحية حسابك. تواصل مع المدير لتمديد المدة.' } };
        }
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
