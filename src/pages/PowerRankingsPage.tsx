import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { useActiveSeason, useDraftSettings, useRosters, useTeams } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  categoryTotals,
  INVERTED_CATEGORIES,
  LEAGUE_CATEGORIES,
  type Category,
} from '@/lib/projections';
import type { PlayerWithStats } from '@/api/types';

const CAT_LABEL: Record<Category, string> = {
  fgm: 'FGM', fgPct: 'FG%', ftPct: 'FT%', tp: '3PM', tpPct: '3P%', reb: 'REB', ast: 'AST',
  stl: 'STL', blk: 'BLK', to: 'TO', dd: 'DD', td: 'TD', pts: 'PTS',
};

interface TeamRow {
  teamId: string;
  name: string;
  totals: Record<Category, number>;
  /** ROTO standings points per category (best = teams count). */
  points: Record<Category, number>;
  totalPoints: number;
  rank: number;
}

export function PowerRankingsPage() {
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  const { profile } = useAuth();
  const { data: settings } = useDraftSettings(seasonId);
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: rosters, isLoading: rostersLoading } = useRosters(seasonId);

  const rows = useMemo<TeamRow[]>(() => {
    if (!teams || !rosters) return [];
    // ponytail: rosters carry player_seasons stats via useRosters; players not
    // linked to a rostered entry are skipped.
    const byTeam = new Map<string, PlayerWithStats[]>();
    for (const entry of rosters) {
      if (!entry.player_id || !entry.players) continue;
      const list = byTeam.get(entry.team_id) ?? [];
      list.push({
        id: entry.player_id,
        name: entry.players.name,
        position: entry.players.position,
        nba_team: entry.players.nba_team ?? null,
        espn_id: entry.players.espn_id ?? null,
        image_url: null,
        created_at: '',
        player_seasons: (entry.players.player_seasons ?? []) as PlayerWithStats['player_seasons'],
      });
      byTeam.set(entry.team_id, list);
    }

    const cats = LEAGUE_CATEGORIES;
    const scored: TeamRow[] = teams.map((team) => {
      const players = byTeam.get(team.id) ?? [];
      return {
        teamId: team.id,
        name: team.name,
        totals: categoryTotals(players, cats),
        points: {} as Record<Category, number>,
        totalPoints: 0,
        rank: 0,
      };
    });

    // Rank each category: best value gets highest points (inverted cats reversed).
    const n = Math.max(scored.length, 1);
    for (const cat of cats) {
      const sorted = [...scored].sort((a, b) =>
        INVERTED_CATEGORIES.has(cat)
          ? a.totals[cat] - b.totals[cat]
          : b.totals[cat] - a.totals[cat],
      );
      sorted.forEach((row, i) => {
        row.points[cat] = n - i;
      });
    }
    for (const row of scored) {
      row.totalPoints = LEAGUE_CATEGORIES.reduce((sum, cat) => sum + row.points[cat], 0);
    }
    [...scored]
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .forEach((row, i) => {
        row.rank = i + 1;
      });
    return scored.sort((a, b) => b.totalPoints - a.totalPoints);
  }, [teams, rosters]);

  if (teamsLoading || rostersLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-3 px-4 py-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const mine = rows.find((row) => row.teamId === profile?.team_id);
  const leader = rows[0];

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Power Rankings</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Category standings points across all {rows.length} teams — higher is stronger.
          </p>
        </div>
        <Link
          to="/team-builder"
          className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted/40"
        >
          <Sparkles className="size-4" /> Test a change
        </Link>
      </header>

      {mine && leader && (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Your rank</div>
            <div className="mt-1 text-2xl font-black">
              #{mine.rank}
              <span className="text-sm font-medium text-muted-foreground"> / {rows.length}</span>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Standings points</div>
            <div className="mt-1 text-2xl font-black">
              {mine.totalPoints}
              <span className="text-sm font-medium text-muted-foreground">
                {' '}· leader {leader.totalPoints} ({leader.name})
              </span>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Your strongest / weakest</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">{CAT_LABEL[bestCat(mine)]}</Badge>
              <Badge variant="outline" className="text-[10px]">{CAT_LABEL[worstCat(mine)]}</Badge>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[52rem] text-xs tabular-nums">
          <thead>
            <tr className="border-b bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted/30 px-3 py-2 text-left">#</th>
              <th className="sticky left-8 z-10 bg-muted/30 px-3 py-2 text-left">Team</th>
              <th className="px-3 py-2 text-right">Pts</th>
              {LEAGUE_CATEGORIES.map((cat) => (
                <th key={cat} className="px-2 py-2 text-right">{CAT_LABEL[cat]}{INVERTED_CATEGORIES.has(cat) ? ' ↓' : ''}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId} className={`border-b last:border-b-0 ${row.teamId === profile?.team_id ? 'bg-primary/5' : ''}`}>
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-bold">{row.rank}</td>
                <td className="sticky left-8 z-10 max-w-40 truncate bg-card px-3 py-2 font-semibold">{row.name}</td>
                <td className="px-3 py-2 text-right font-black">{row.totalPoints}</td>
                {LEAGUE_CATEGORIES.map((cat) => (
                  <td key={cat} className={`px-2 py-2 text-right ${row.points[cat] >= rows.length - 1 ? 'font-bold text-primary' : row.points[cat] <= 2 ? 'text-muted-foreground' : ''}`}>
                    {Math.round(row.totals[cat]).toLocaleString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {settings && (
        <p className="text-[11px] text-muted-foreground">
          Totals are season projections per roster ({settings.roster_size} spots); percentage categories are games-weighted averages.
        </p>
      )}
    </div>
  );
}

function bestCat(row: TeamRow): Category {
  return LEAGUE_CATEGORIES.reduce((a, b) => (row.points[b] > row.points[a] ? b : a));
}

function worstCat(row: TeamRow): Category {
  return LEAGUE_CATEGORIES.reduce((a, b) => (row.points[b] < row.points[a] ? b : a));
}
