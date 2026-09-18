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

export interface StandingsSwing {
  /** The team's row without the candidate. */
  before: RotoTeamRow;
  /** The team's row with the candidate added (and `droppedPlayerId` removed). */
  after: RotoTeamRow;
  /** Per-category standings-points change for the team (after − before). */
  pointsByCategory: Record<Category, number>;
}

/**
 * How much one player moves one team's projected ROTO standings: re-run the
 * league table with `candidate` appended to the team's roster (optionally
 * after removing `droppedPlayerId`) and diff that team's row. Standings
 * points depend only on per-category ordering, so a full recompute is the
 * correct way to capture swings in categories where other teams sit between.
 */
export function standingsSwing(
  teams: { id: string; name: string }[],
  playersByTeam: Map<string, PlayerWithStats[]>,
  teamId: string,
  candidate: PlayerWithStats,
  droppedPlayerId?: string,
): StandingsSwing | null {
  const mine = playersByTeam.get(teamId);
  const before = rotoStandings(teams, playersByTeam).find((row) => row.teamId === teamId);
  if (!mine || !before) return null;

  const context = droppedPlayerId
    ? mine.filter((player) => player.id !== droppedPlayerId)
    : mine;
  const boosted = new Map(playersByTeam);
  boosted.set(teamId, [...context, candidate]);
  const after = rotoStandings(teams, boosted).find((row) => row.teamId === teamId);
  if (!after) return null;

  const pointsByCategory = {} as Record<Category, number>;
  for (const cat of LEAGUE_CATEGORIES) {
    pointsByCategory[cat] = after.points[cat] - before.points[cat];
  }
  return { before, after, pointsByCategory };
}
