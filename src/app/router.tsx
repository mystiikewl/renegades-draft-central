/* eslint-disable react-refresh/only-export-components -- route components and router must share one route tree */
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router';
import type { AsyncRouteComponent } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AppShell } from '@/app/AppShell';
import { AdminRouteGuard, LeagueRoute, RequireAuth } from '@/app/RouteGuards';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoginPage } from '@/pages/LoginPage';

const AdminPage = lazyRouteComponent(() => import('@/pages/AdminPage'), 'AdminPage');
const AdminTradeOverridesPage = lazyRouteComponent(
  () => import('@/pages/AdminTradeOverridesPage'),
  'AdminTradeOverridesPage',
);
const AnalysisPage = lazyRouteComponent(() => import('@/pages/AnalysisPage'), 'AnalysisPage');
const DraftPage = lazyRouteComponent(() => import('@/pages/DraftPage'), 'DraftPage');
const LeagueHubPage = lazyRouteComponent(() => import('@/pages/HubPages'), 'LeagueHubPage');
const MorePage = lazyRouteComponent(() => import('@/pages/HubPages'), 'MorePage');
const MyTeamPage = lazyRouteComponent(() => import('@/pages/MyTeamPage'), 'MyTeamPage');
const PlayerLabPage = lazyRouteComponent(() => import('@/pages/PlayerLabPage'), 'PlayerLabPage');
const PlayerPoolPage = lazyRouteComponent(() => import('@/pages/PlayerPoolPage'), 'PlayerPoolPage');
const PowerRankingsPage = lazyRouteComponent(
  () => import('@/pages/PowerRankingsPage'),
  'PowerRankingsPage',
);
const PracticeDraftPage = lazyRouteComponent(
  () => import('@/pages/PracticeDraftPage'),
  'PracticeDraftPage',
);
const ProfilePage = lazyRouteComponent(() => import('@/pages/ProfilePage'), 'ProfilePage');
const RankingsPage = lazyRouteComponent(() => import('@/pages/RankingsPage'), 'RankingsPage');
const RostersPage = lazyRouteComponent(() => import('@/pages/RostersPage'), 'RostersPage');
const TeamBuilderPage = lazyRouteComponent(() => import('@/pages/TeamBuilderPage'), 'TeamBuilderPage');
const TradeCenterPage = lazyRouteComponent(() => import('@/pages/TradeCenterPage'), 'TradeCenterPage');

type AdminSection = 'overview' | 'season' | 'draft' | 'order' | 'keepers';

function preloadableRoute(Page: AsyncRouteComponent<unknown>, render: (page: ReactNode) => ReactNode) {
  function RouteComponent() {
    return render(<Page />);
  }
  RouteComponent.preload = Page.preload;
  return RouteComponent;
}

const DraftRoute = preloadableRoute(DraftPage, (page) => (
  <LeagueRoute>
    <ErrorBoundary label="draft">{page}</ErrorBoundary>
  </LeagueRoute>
));

const MyTeamRoute = preloadableRoute(MyTeamPage, (page) => <LeagueRoute>{page}</LeagueRoute>);
const LeagueHubRoute = preloadableRoute(LeagueHubPage, (page) => <LeagueRoute>{page}</LeagueRoute>);
const MoreRoute = preloadableRoute(MorePage, (page) => <LeagueRoute>{page}</LeagueRoute>);
const RostersRoute = preloadableRoute(RostersPage, (page) => <LeagueRoute>{page}</LeagueRoute>);
const PoolRoute = preloadableRoute(PlayerPoolPage, (page) => <LeagueRoute>{page}</LeagueRoute>);
const AnalysisRoute = preloadableRoute(AnalysisPage, (page) => (
  <LeagueRoute>
    <ErrorBoundary label="draft intelligence">{page}</ErrorBoundary>
  </LeagueRoute>
));
const PlayerLabRoute = preloadableRoute(PlayerLabPage, (page) => (
  <LeagueRoute>
    <ErrorBoundary label="player lab">{page}</ErrorBoundary>
  </LeagueRoute>
));
const PracticeDraftRoute = preloadableRoute(PracticeDraftPage, (page) => (
  <LeagueRoute>
    <ErrorBoundary label="practice draft">{page}</ErrorBoundary>
  </LeagueRoute>
));
const TradesRoute = preloadableRoute(TradeCenterPage, (page) => <LeagueRoute>{page}</LeagueRoute>);
const RankingsRoute = preloadableRoute(RankingsPage, (page) => <LeagueRoute>{page}</LeagueRoute>);
const PowerRankingsRoute = preloadableRoute(PowerRankingsPage, (page) => <LeagueRoute>{page}</LeagueRoute>);
const ProfileRoute = preloadableRoute(ProfilePage, (page) => <RequireAuth>{page}</RequireAuth>);
const TeamBuilderRoute = preloadableRoute(TeamBuilderPage, (page) => <LeagueRoute>{page}</LeagueRoute>);
const AdminTradesRoute = preloadableRoute(AdminTradeOverridesPage, (page) => (
  <AdminRouteGuard>{page}</AdminRouteGuard>
));

function AdminPageRoute({ section }: { section?: AdminSection }) {
  return (
    <AdminRouteGuard>
      <AdminPage section={section} />
    </AdminRouteGuard>
  );
}
AdminPageRoute.preload = AdminPage.preload;

function RoutePending() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground">
      Loading page…
    </div>
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
  component: MyTeamRoute,
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
  component: LeagueHubRoute,
});

const moreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/more',
  component: MoreRoute,
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
  component: AdminTradesRoute,
});

const rostersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rosters',
  component: RostersRoute,
});

const poolRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pool',
  component: PoolRoute,
});

const analysisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analysis',
  component: AnalysisRoute,
});

const playerLabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/player-lab',
  component: PlayerLabRoute,
});

const practiceDraftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice-draft',
  component: PracticeDraftRoute,
});

const tradesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trades',
  component: TradesRoute,
});

const rankingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rankings',
  component: RankingsRoute,
});

const powerRankingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/power-rankings',
  component: PowerRankingsRoute,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfileRoute,
});

const teamBuilderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/team-builder',
  component: TeamBuilderRoute,
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
  analysisRoute,
  playerLabRoute,
  practiceDraftRoute,
  tradesRoute,
  rankingsRoute,
  powerRankingsRoute,
  teamBuilderRoute,
  profileRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPendingComponent: RoutePending,
  defaultPendingMs: 150,
  defaultPendingMinMs: 200,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
