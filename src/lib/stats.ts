/** Stat key mapping between our player_seasons.stats JSONB (ESPN keys) and display fields. */
export interface StatLine {
  gp: string | null;
  mpg: string | null;
  pts: string | null;
  reb: string | null;
  ast: string | null;
  stl: string | null;
  blk: string | null;
  tp: string | null;
  to: string | null;
  fgPct: string | null;
  ftPct: string | null;
  rank: string | null;
}

const fmt = (v: unknown, dp = 1): string | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n.toFixed(dp).replace(/\.0$/, '') : String(v);
};

export function parseStats(stats: Record<string, unknown> | undefined | null): StatLine {
  const s = stats ?? {};
  return {
    gp: fmt(s.games_played, 0),
    mpg: fmt(s.minutes_per_game),
    pts: fmt(s.points),
    reb: fmt(s.total_rebounds),
    ast: fmt(s.assists),
    stl: fmt(s.steals),
    blk: fmt(s.blocks),
    tp: fmt(s.three_pointers_made),
    to: fmt(s.turnovers),
    fgPct: fmt(s.field_goal_percentage, 3),
    ftPct: fmt(s.free_throw_percentage, 3),
    rank: fmt(s.rank, 0),
  };
}
