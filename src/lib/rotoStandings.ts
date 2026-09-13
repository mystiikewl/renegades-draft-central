import type { PlayerWithStats } from '@/api/types';
import {
  categoryTotals,
  INVERTED_CATEGORIES,
  LEAGUE_CATEGORIES,
  type Category,
} from '@/lib/projections';

export interface RotoTeamRow {
  teamId: string;
  name: string;
  totals: Record<Category, number>;
  /** ROTO standings points per category (best = teams count). */
  points: Record<Category, number>;
  totalPoints: number;
  rank: number;
}

/**
 * Projected 13-category ROTO standings: each team's roster totals translate
 * into per-category standings points (lower-is-better cats inverted), summed
 * into a total and ranked. This used to live inline in PowerRankingsPage's
 * render body, unreachable by tests.
 */
export function rotoStandings(
  teams: { id: string; name: string }[],
  playersByTeam: Map<string, PlayerWithStats[]>,
): RotoTeamRow[] {
  const scored: RotoTeamRow[] = teams.map((team) => ({
    teamId: team.id,
    name: team.name,
    totals: categoryTotals(playersByTeam.get(team.id) ?? [], LEAGUE_CATEGORIES),
    points: {} as Record<Category, number>,
    totalPoints: 0,
    rank: 0,
  }));

  const teamCount = Math.max(scored.length, 1);
  for (const cat of LEAGUE_CATEGORIES) {
    const sorted = [...scored].sort((a, b) =>
      INVERTED_CATEGORIES.has(cat)
        ? a.totals[cat] - b.totals[cat]
        : b.totals[cat] - a.totals[cat],
    );
    sorted.forEach((row, index) => {
      row.points[cat] = teamCount - index;
    });
  }
  for (const row of scored) {
    row.totalPoints = LEAGUE_CATEGORIES.reduce((sum, cat) => sum + row.points[cat], 0);
  }
  [...scored]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .forEach((row, index) => {
      row.rank = index + 1;
    });
  return scored.sort((a, b) => b.totalPoints - a.totalPoints);
}
