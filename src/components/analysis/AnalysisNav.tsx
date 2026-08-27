import { Link, useLocation } from '@tanstack/react-router';
import { BarChart3, BrainCircuit, Radar, Sparkles, TrendingUp } from 'lucide-react';

const analysisRoutes = ['/analysis', '/rankings', '/player-lab', '/team-builder', '/power-rankings'] as const;

const items = [
  { to: '/analysis', label: 'Decision Board', icon: BrainCircuit },
  { to: '/rankings', label: 'Rankings', icon: BarChart3 },
  { to: '/player-lab', label: 'Player Lab', icon: Radar },
  { to: '/team-builder', label: 'Team Builder', icon: Sparkles },
  { to: '/power-rankings', label: 'League Forecast', icon: TrendingUp },
] as const;

export function isAnalysisRoute(pathname: string): boolean {
  return analysisRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function AnalysisNav() {
  const { pathname } = useLocation();
  if (!isAnalysisRoute(pathname)) return null;

  return (
    <nav
      aria-label="Draft analysis tools"
      className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur"
    >
      <div className="mx-auto max-w-7xl overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-4">
        <div className="flex min-w-max items-center gap-1 py-2">
          {items.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                  active
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
