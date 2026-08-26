import type { ReactNode } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { LeagueAccessPage } from '@/pages/LeagueAccessPage';
import { LoginPage } from '@/pages/LoginPage';

function FullscreenLoading() {
  return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullscreenLoading />;
  if (!session) return <LoginPage />;
  return <>{children}</>;
}

export function RequireTeam({ children }: { children: ReactNode }) {
  const { profile, profileLoading } = useAuth();
  if (profileLoading) return <FullscreenLoading />;
  if (!profile || profile.team_id === null) return <LeagueAccessPage />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.is_admin) {
    return <div className="p-8 text-center text-muted-foreground">Admins only.</div>;
  }
  return <>{children}</>;
}

export function LeagueRoute({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireTeam>{children}</RequireTeam>
    </RequireAuth>
  );
}

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  return (
    <LeagueRoute>
      <RequireAdmin>{children}</RequireAdmin>
    </LeagueRoute>
  );
}
