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
          <div className="flex items-center gap-6">
            <span className="font-bold">Renegades Draft Central</span>
            {profile?.team_id && (
              <nav className="hidden gap-4 text-sm text-muted-foreground sm:flex">
                <Link to="/" className="hover:text-foreground">
                  Draft
                </Link>
                <Link to="/rosters" className="hover:text-foreground">
                  Rosters
                </Link>
                {profile.is_admin && (
                  <Link to="/admin" className="hover:text-foreground">
                    Admin
                  </Link>
                )}
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

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, adminRoute, rostersRoute]);
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
