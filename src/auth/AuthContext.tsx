import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useProfile } from '@/api/queries';
import type { Profile } from '@/api/types';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

interface AuthState {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  profileLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => subscription.unsubscribe();
  }, []);

  // Clear implicit/shared state when the signed-in account changes, so a
  // previous user's cached queries and persisted stores cannot leak into the
  // next session on a shared browser.
  useEffect(() => {
    const userId = session?.user.id ?? null;
    if (previousUserId.current !== null && previousUserId.current !== userId) {
      qc.clear();
      try {
        const prefixes = ['renegades-', 'tbuilder:', 'rankings:', 'draft-intelligence:'];
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (key && prefixes.some((prefix) => key.startsWith(prefix))) toRemove.push(key);
        }
        toRemove.forEach((key) => localStorage.removeItem(key));
      } catch {
        // localStorage may be unavailable (private mode); ignore.
      }
    }
    previousUserId.current = userId;
  }, [session?.user.id, qc]);

  const profileQuery = useProfile(session?.user.id);

  const value: AuthState = {
    session,
    loading,
    profile: profileQuery.data ?? null,
    profileLoading: profileQuery.isLoading,
    signOut: async () => {
      await supabase.auth.signOut();
      qc.clear();
      try {
        const prefixes = ['renegades-', 'tbuilder:', 'rankings:', 'draft-intelligence:'];
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (key && prefixes.some((prefix) => key.startsWith(prefix))) toRemove.push(key);
        }
        toRemove.forEach((key) => localStorage.removeItem(key));
      } catch {
        // ignore
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
