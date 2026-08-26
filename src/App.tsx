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
import { TradeAnnouncementBanner } from '@/components/trades/TradeAnnouncementBanner';
import { ClipboardList, ListChecks, Settings, UserCircle, Users } from 'lucide-react';
import { DraftPage } from '@/pages/DraftPage';
import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { AdminPage } from '@/pages/AdminPage';
import { AdminTradeOverridesPage } from '@/pages/AdminTradeOverridesPage';
import { RostersPage } from '@/pages/RostersPage';
import { PlayerPoolPage } from '@/pages/PlayerPoolPage';
import { RankingsPage } from '@/pages/RankingsPage';
import { TeamBuilderPage } from '@/pages/TeamBuilderPage';
import { TradeCenterPage } from '@/pages/TradeCenterPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { MyTeamPage } from '@/pages/MyTeamPage';
import { LeagueHubPage, MorePage, PlayersHubPage } from '@/pages/HubPages';
import { useMobileViewportInsets } from '@/hooks/useMobileViewportInsets';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  if (!session) return <LoginPage />;
  return <>{children}</>;
}

function RequireTeam({ children }: { children: React.ReactNode }) {
  const { profile, profileLoading } = useAuth();
  if (profileLoading)
    return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  if (!profile || profile.team_id === null) return <OnboardingPage />;
  return <>{children}</>;
}

const primaryNav = [
  { to: '/my-team', label: 'My Team', short: 'My Team', icon: UserCircle, matches: ['/my-team'] },
  { to: '/', label: 'Draft', short: 'Draft', icon: ClipboardList, matches: ['/'] },
  { to: '/players', label: 'Players', short: 'Players', icon: Users, matches: ['/players', '/pool', '/rankings'] },
  { to: '/league', label: 'League', short: 'League', icon: ListChecks, matches: ['/league', '/rosters', '/trades'] },
  { to: '/more', label: 'More', short: 'More', icon: Settings, matches: ['/more', '/profile', '/team-builder', '/admin'] },
] as const;

function RootLayout() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const { browserBottom, keyboardOpen } = useMobileViewportInsets();

  const isActive = (matches: readonly string[]) =>
    matches.some((path) => (path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)));
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
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
          <div className="flex min-w-0 items-center gap-6">
            <span className="shrink-0 font-bold tracking-tight">Renegades Draft Central</span>
            {profile?.team_id && (
              <nav className="hidden items-center gap-1 text-sm sm:flex">
                {primaryNav.map((item) => {
                  const active = isActive(item.matches);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`rounded-lg px-3 py-2 font-medium transition-colors ${
                        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
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
            <Link
              to="/more"
              aria-label="More, profile and settings"
              className="hidden min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
            >
              <span className="max-w-44 truncate">{profile.display_name ?? profile.email}</span>
              {profile.is_admin && <span className="text-[10px] font-bold uppercase tracking-wide text-primary">admin</span>}
            </Link>
          )}
        </div>
      </header>

      {profile?.team_id && (
        <nav
          aria-label="Primary navigation"
          aria-hidden={keyboardOpen || undefined}
          className={`fixed inset-x-0 z-40 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-20px_hsl(var(--foreground))] backdrop-blur transition-[bottom,transform,opacity] duration-200 sm:hidden ${
            keyboardOpen ? 'pointer-events-none translate-y-full opacity-0' : 'translate-y-0 opacity-100'
          }`}
          style={{ bottom: 'var(--browser-bottom)' }}
        >
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.matches);
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

      {profile?.team_id && <TradeAnnouncementBanner />}
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

function AdminRoute({ section }: { section?: 'overview' | 'season' | 'draft' | 'order' | 'keepers' }) {
  return (
    <RequireAuth>
      <RequireTeam>
        <RequireAdmin><AdminPage section={section} /></RequireAdmin>
      </RequireTeam>
    </RequireAuth>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <RequireAuth>
      <RequireTeam>
        <ErrorBoundary label="draft"><DraftPage /></ErrorBoundary>
      </RequireTeam>
    </RequireAuth>
  ),
});

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage });

const myTeamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/my-team',
  component: () => <RequireAuth><RequireTeam><MyTeamPage /></RequireTeam></RequireAuth>,
});

const playersHubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/players',
  component: () => <RequireAuth><RequireTeam><PlayersHubPage /></RequireTeam></RequireAuth>,
});

const leagueHubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/league',
  component: () => <RequireAuth><RequireTeam><LeagueHubPage /></RequireTeam></RequireAuth>,
});

const moreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/more',
  component: () => <RequireAuth><RequireTeam><MorePage /></RequireTeam></RequireAuth>,
});

const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: () => <AdminRoute /> });
const adminSeasonRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/season', component: () => <AdminRoute section="season" /> });
const adminDraftRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/draft', component: () => <AdminRoute section="draft" /> });
const adminOrderRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/order', component: () => <AdminRoute section="order" /> });
const adminKeepersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin/keepers', component: () => <AdminRoute section="keepers" /> });
const adminTradesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/trades',
  component: () => <RequireAuth><RequireTeam><RequireAdmin><AdminTradeOverridesPage /></RequireAdmin></RequireTeam></RequireAuth>,
});

const rostersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rosters',
  component: () => <RequireAuth><RequireTeam><RostersPage /></RequireTeam></RequireAuth>,
});

const poolRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pool',
  component: () => <RequireAuth><RequireTeam><PlayerPoolPage /></RequireTeam></RequireAuth>,
});

const tradesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trades',
  component: () => <RequireAuth><RequireTeam><TradeCenterPage /></RequireTeam></RequireAuth>,
});

const rankingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rankings',
  component: () => <RequireAuth><RequireTeam><RankingsPage /></RequireTeam></RequireAuth>,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: () => <RequireAuth><ProfilePage /></RequireAuth>,
});

const teamBuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/team-builder',
  component: () => <RequireAuth><RequireTeam><TeamBuilderPage /></RequireTeam></RequireAuth>,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  myTeamRoute,
  playersHubRoute,
  leagueHubRoute,
  moreRoute,
  adminRoute,
  adminSeasonRoute,
  adminDraftRoute,
  adminOrderRoute,
  adminKeepersRoute,
  adminTradesRoute,
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
