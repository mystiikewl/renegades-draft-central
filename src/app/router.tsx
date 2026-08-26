import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { AppShell } from '@/app/AppShell';
import { AdminRouteGuard, LeagueRoute, RequireAuth } from '@/app/RouteGuards';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AdminPage } from '@/pages/AdminPage';
import { AdminTradeOverridesPage } from '@/pages/AdminTradeOverridesPage';
import { DraftPage } from '@/pages/DraftPage';
import { LeagueHubPage, MorePage } from '@/pages/HubPages';
import { LoginPage } from '@/pages/LoginPage';
import { MyTeamPage } from '@/pages/MyTeamPage';
import { PlayerPoolPage } from '@/pages/PlayerPoolPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { RankingsPage } from '@/pages/RankingsPage';
import { RostersPage } from '@/pages/RostersPage';
import { TeamBuilderPage } from '@/pages/TeamBuilderPage';
import { TradeCenterPage } from '@/pages/TradeCenterPage';

type AdminSection = 'overview' | 'season' | 'draft' | 'order' | 'keepers';

function DraftRoute() {
  return (
    <LeagueRoute>
      <ErrorBoundary label="draft">
        <DraftPage />
      </ErrorBoundary>
    </LeagueRoute>
  );
}

function AdminPageRoute({ section }: { section?: AdminSection }) {
  return (
    <AdminRouteGuard>
      <AdminPage section={section} />
    </AdminRouteGuard>
  );
}

const rootRoute = createRootRoute({ component: AppShell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DraftRoute,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const myTeamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/my-team',
  component: () => (
    <LeagueRoute>
      <MyTeamPage />
    </LeagueRoute>
  ),
});

const playersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/players',
  beforeLoad: () => {
    throw redirect({ to: '/pool' });
  },
});

const leagueHubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/league',
  component: () => (
    <LeagueRoute>
      <LeagueHubPage />
    </LeagueRoute>
  ),
});

const moreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/more',
  component: () => (
    <LeagueRoute>
      <MorePage />
    </LeagueRoute>
  ),
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: () => <AdminPageRoute />,
});

const adminSeasonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/season',
  component: () => <AdminPageRoute section="season" />,
});

const adminDraftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/draft',
  component: () => <AdminPageRoute section="draft" />,
});

const adminOrderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/order',
  component: () => <AdminPageRoute section="order" />,
});

const adminKeepersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/keepers',
  component: () => <AdminPageRoute section="keepers" />,
});

const adminTradesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/trades',
  component: () => (
    <AdminRouteGuard>
      <AdminTradeOverridesPage />
    </AdminRouteGuard>
  ),
});

const rostersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rosters',
  component: () => (
    <LeagueRoute>
      <RostersPage />
    </LeagueRoute>
  ),
});

const poolRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pool',
  component: () => (
    <LeagueRoute>
      <PlayerPoolPage />
    </LeagueRoute>
  ),
});

const tradesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trades',
  component: () => (
    <LeagueRoute>
      <TradeCenterPage />
    </LeagueRoute>
  ),
});

const rankingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rankings',
  component: () => (
    <LeagueRoute>
      <RankingsPage />
    </LeagueRoute>
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
    <LeagueRoute>
      <TeamBuilderPage />
    </LeagueRoute>
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  myTeamRoute,
  playersRoute,
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

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
