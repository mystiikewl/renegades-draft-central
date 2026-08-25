import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Link,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DraftPage } from '@/pages/DraftPage';
import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { AdminPage } from '@/pages/AdminPage';
import { RostersPage } from '@/pages/RostersPage';
import { PlayerPoolPage } from '@/pages/PlayerPoolPage';
import { RankingsPage } from '@/pages/RankingsPage';
import { TeamBuilderPage } from '@/pages/TeamBuilderPage';

/** Declarative auth guard — no navigate-in-effect, no blank frames. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  if (!session) return <LoginPage />;
  return <>{children}</>;
}

/** Profiles without a team must claim one before touching league pages. */
function RequireTeam({ children }: { children: React.ReactNode }) {
  const { profile, profileLoading } = useAuth();
  if (profileLoading)
    return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  if (!profile || profile.team_id === null) return <OnboardingPage />;
  return <>{children}</>;
}

function RootLayout() {
  const { profile, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <span className="shrink-0 font-bold">Renegades Draft Central</span>
            {profile?.team_id && (
              <nav className="flex min-w-0 gap-4 overflow-x-auto text-sm text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[
                  { to: '/', label: 'Draft' },
                  { to: '/pool', label: 'Player Pool' },
                  { to: '/rankings', label: 'Rankings' },
                  { to: '/rosters', label: 'Rosters' },
                  ...(profile.is_admin ? [{ to: '/admin', label: 'Admin' }] : []),
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="whitespace-nowrap transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          {profile && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{profile.display_name ?? profile.email}</span>
              {profile.is_admin && <span className="text-primary">admin</span>}
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            </div>
          )}
        </div>
      </header>
      <Outlet />
      <Toaster />
    </div>
  );
}

/** Admin-only pages. */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile?.is_admin)
    return <div className="p-8 text-center text-muted-foreground">Admins only.</div>;
  return <>{children}</>;
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <RequireAuth>
      <RequireTeam>
        <ErrorBoundary label="draft">
          <DraftPage />
        </ErrorBoundary>
      </RequireTeam>
    </RequireAuth>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: () => (
    <RequireAuth>
      <RequireTeam>
        <RequireAdmin>
          <AdminPage />
        </RequireAdmin>
      </RequireTeam>
    </RequireAuth>
  ),
});

const rostersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rosters',
  component: () => (
    <RequireAuth>
      <RequireTeam>
        <RostersPage />
      </RequireTeam>
    </RequireAuth>
  ),
});

const poolRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pool',
  component: () => (
    <RequireAuth>
      <RequireTeam>
        <PlayerPoolPage />
      </RequireTeam>
    </RequireAuth>
  ),
});

const rankingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rankings',
  component: () => (
    <RequireAuth>
      <RequireTeam>
        <RankingsPage />
      </RequireTeam>
    </RequireAuth>
  ),
});

const teamBuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/team-builder',
  component: () => (
    <RequireAuth>
      <RequireTeam>
        <TeamBuilderPage />
      </RequireTeam>
    </RequireAuth>
  ),
});

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, adminRoute, rostersRoute, poolRoute, rankingsRoute, teamBuilderRoute]);
const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
