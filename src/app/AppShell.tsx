import { Link, Outlet, useLocation } from '@tanstack/react-router';
import type { CSSProperties } from 'react';
import { Bot, ClipboardList, ListChecks, Settings, UserCircle, Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AnalysisNav } from '@/components/analysis/AnalysisNav';
import { DraftTurnBanner } from '@/components/draft/DraftTurnBanner';
import { PracticeDraftSessionController } from '@/components/draft/PracticeDraftSessionController';
import { TradeAnnouncementBanner } from '@/components/trades/TradeAnnouncementBanner';
import { Toaster } from '@/components/ui/sonner';
import { useMobileViewportInsets } from '@/hooks/useMobileViewportInsets';
import { usePracticeDraftSession } from '@/stores/practiceDraftSession';

const primaryNav = [
  { to: '/my-team', label: 'My Team', short: 'My Team', icon: UserCircle, matches: ['/my-team'] },
  { to: '/', label: 'Draft', short: 'Draft', icon: ClipboardList, matches: ['/'] },
  { to: '/pool', label: 'Pool', short: 'Pool', icon: Users, matches: ['/pool'] },
  {
    to: '/league',
    label: 'League',
    short: 'League',
    icon: ListChecks,
    matches: [
      '/league',
      '/rosters',
      '/trades',
      '/analysis',
      '/rankings',
      '/player-lab',
      '/team-builder',
      '/power-rankings',
    ],
  },
  {
    to: '/more',
    label: 'More',
    short: 'More',
    icon: Settings,
    matches: ['/more', '/profile', '/practice-draft', '/admin'],
  },
] as const;

/** League-wide application chrome. Page routing lives separately in app/router.tsx. */
export function AppShell() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const { browserBottom, keyboardOpen } = useMobileViewportInsets();
  const hasLeagueShell = Boolean(profile?.team_id);
  const inPracticeDraft = pathname === '/practice-draft';
  const practiceActive = usePracticeDraftSession((state) => state.active);

  const isActive = (matches: readonly string[]) =>
    matches.some((path) =>
      path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`),
    );

  const shellStyle = {
    '--browser-bottom': `${browserBottom}px`,
  } as CSSProperties;

  return (
    <div
      style={shellStyle}
      className={`min-h-screen bg-background text-foreground ${
        hasLeagueShell
          ? 'pb-[calc(4rem+env(safe-area-inset-bottom)+var(--browser-bottom))] sm:pb-0'
          : ''
      }`}
    >
      {hasLeagueShell && (
        <header className="border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
            <div className="flex min-w-0 items-center gap-6">
              {/* ponytail: brand mark keeps the header left side from being empty on mobile (nav hides below sm) */}
              <Link to="/" className="flex items-center gap-2 text-sm font-black uppercase tracking-tight sm:hidden">
                <ClipboardList className="size-4 text-primary" />
                RDC
              </Link>
              <nav className="hidden items-center gap-1 text-sm sm:flex">
                {primaryNav.map((item) => {
                  const active = isActive(item.matches);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`rounded-lg px-3 py-2 font-medium transition-colors ${
                        active
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              {pathname === '/' && (
                <Link
                  to="/practice-draft"
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3 sm:text-sm"
                >
                  <Bot className="size-4" />
                  {practiceActive ? 'Practice Active' : 'Practice'}
                </Link>
              )}
              {profile && (
                <Link
                  to="/more"
                  aria-label="More, profile and settings"
                  className="hidden min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
                >
                  <span className="max-w-44 truncate">{profile.display_name ?? profile.email}</span>
                  {profile.is_admin && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary">admin</span>
                  )}
                </Link>
              )}
            </div>
          </div>
        </header>
      )}

      {hasLeagueShell && <AnalysisNav />}

      {hasLeagueShell && (
        <nav
          aria-label="Primary navigation"
          aria-hidden={keyboardOpen || undefined}
          className={`fixed inset-x-0 z-40 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-20px_hsl(var(--foreground))] backdrop-blur transition-[bottom,transform,opacity] duration-200 sm:hidden ${
            keyboardOpen
              ? 'pointer-events-none translate-y-full opacity-0'
              : 'translate-y-0 opacity-100'
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
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
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

      {profile?.team_id && <PracticeDraftSessionController />}
      {profile?.team_id && !inPracticeDraft && !practiceActive && <DraftTurnBanner />}
      {profile?.team_id && !inPracticeDraft && <TradeAnnouncementBanner />}
      <Outlet />
      <Toaster />
    </div>
  );
}
