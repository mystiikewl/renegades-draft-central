import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Link,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { useState, type CSSProperties } from 'react';
import { useLocation } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ArrowRightLeft, BarChart3, ClipboardList, Shield, UserCircle, Users, ListChecks } from 'lucide-react';
import { DraftPage } from '@/pages/DraftPage';
import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { AdminPage } from '@/pages/AdminPage';
import { RostersPage } from '@/pages/RostersPage';
import { PlayerPoolPage } from '@/pages/PlayerPoolPage';
import { RankingsPage } from '@/pages/RankingsPage';
import { TeamBuilderPage } from '@/pages/TeamBuilderPage';
import { TradeCenterPage } from '@/pages/TradeCenterPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { useMobileViewportInsets } from '@/hooks/useMobileViewportInsets';

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
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const { browserBottom, keyboardOpen } = useMobileViewportInsets();

  const navItems = [
    { to: '/', label: 'Draft', short: 'Draft', icon: ClipboardList },
    { to: '/pool', label: 'Player Pool', short: 'Pool', icon: Users },
    { to: '/trades', label: 'Trades', short: 'Trades', icon: ArrowRightLeft },
    { to: '/rankings', label: 'Rankings', short: 'Ranks', icon: BarChart3 },
    { to: '/rosters', label: 'Rosters', short: 'Roster', icon: ListChecks },
    ...(profile?.is_admin ? [{ to: '/admin', label: 'Admin', short: 'Admin', icon: Shield }] : []),
  ];
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));
  const shellStyle = {
    '--browser-bottom': `${browserBottom}px`,
  } as CSSProperties;

  return (
    <div
      style={shellStyle}
      className={`min-h-screen bg-background text-foreground ${
        profile?.team_id
          ? 'pb-[calc(4rem+env(safe-area-inset-bottom)+var(--browser-bottom))] sm:pb-0'
          : ''
      }`}
    >
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <span className="shrink-0 font-bold">Renegades Draft Central</span>
            {profile?.team_id && (
              <nav className="hidden min-w-0 gap-4 overflow-x-auto text-sm text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex">
                {navItems.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`whitespace-nowrap transition-colors hover:text-foreground ${
                        active ? 'font-medium text-foreground' : ''
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
          {profile && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="hidden md:inline">{profile.display_name ?? profile.email}</span>
              {profile.is_admin && <span className="hidden text-primary md:inline">admin</span>}
              <Link
                to="/profile"
                aria-label="Profile and settings"
                aria-current={pathname === '/profile' ? 'page' : undefined}
                className={`rounded-md p-2 transition-colors hover:bg-muted hover:text-foreground ${
                  pathname === '/profile' ? 'bg-muted text-foreground' : ''
                }`}
              >
                <UserCircle className="size-5" />
              </Link>
            </div>
          )}
        </div>
      </header>

      {profile?.team_id && (
        <nav
          aria-hidden={keyboardOpen || undefined}
          className={`fixed inset-x-0 z-40 grid auto-cols-fr grid-flow-col border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-20px_hsl(var(--foreground))] backdrop-blur transition-[bottom,transform,opacity] duration-200 sm:hidden ${
            keyboardOpen ? 'pointer-events-none translate-y-full opacity-0' : 'translate-y-0 opacity-100'
          }`}
          style={{ bottom: 'var(--browser-bottom)' }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                tabIndex={keyboardOpen ? -1 : undefined}
                className={`relative flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-all active:scale-[0.98] ${
                  active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary transition-opacity ${
                    active ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <Icon className={`size-5 transition-transform ${active ? '-translate-y-0.5' : ''}`} />
                <span className="max-w-full truncate">{item.short}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <Outlet />
      <Toaster />
    </div>
  );
}

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

const tradesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trades',
  component: () => (
    <RequireAuth>
      <RequireTeam>
        <TradeCenterPage />
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

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: () => (
    <RequireAuth>
      <ProfilePage />
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

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  adminRoute,
  rostersRoute,
  poolRoute,
  tradesRoute,
  rankingsRoute,
  teamBuilderRoute,
  profileRoute,
]);
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
