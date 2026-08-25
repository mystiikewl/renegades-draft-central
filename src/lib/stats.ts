/** ESPN years-of-experience; 0 = rookie. */
export function isRookie(p: { experience?: number | null }): boolean {
  return p.experience === 0;
}

export interface StatsSeasonRow {
  season_id: string;
  stats: Record<string, number | string | null> | null;
  seasons?: { label: string } | null;
}

/**
 * Which player_seasons row to read stats from: the active season's row when it
 * actually carries numbers, otherwise the most recent labeled season that does.
 * (A fresh season row before the ESPN import runs is empty JSONB.)
 */
export function pickStatsSeason(rows: StatsSeasonRow[], activeSeasonId: string): StatsSeasonRow | null {
  const hasStats = (s: StatsSeasonRow) => !!s.stats && Object.keys(s.stats).length > 0;
  const candidates = rows.filter(hasStats);
  if (candidates.length === 0) return null;
  const labelOf = (s: StatsSeasonRow) => s.seasons?.label ?? '';
  // active-with-stats first, then most recent labeled season
  const sorted = candidates.sort((a, b) => {
    if (a.season_id === activeSeasonId) return -1;
    if (b.season_id === activeSeasonId) return 1;
    return labelOf(b).localeCompare(labelOf(a));
  });
  return sorted[0];
}

/** Ordered stat-column config shared by the Player Pool and Rankings tables. */
import type { Category } from '@/lib/projections';

export type StatColumnKey = 'gp' | Category;

export const STAT_COLUMNS: { key: StatColumnKey; label: string }[] = [
  { key: 'gp', label: 'GP' },
  { key: 'fgm', label: 'FGM' },
  { key: 'fgPct', label: 'FG%' },
  { key: 'ftPct', label: 'FT%' },
  { key: 'tp', label: '3PM' },
  { key: 'tpPct', label: '3P%' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'to', label: 'TO' },
  { key: 'dd', label: 'DD' },
  { key: 'td', label: 'TD' },
  { key: 'pts', label: 'PTS' },
];

const PCT_KEYS: ReadonlySet<StatColumnKey> = new Set(['fgPct', 'ftPct', 'tpPct']);

/** Display value for a stat column under the given basis (averages|totals). */
export function statColumnValue(
  p: { player_seasons: { stats: Record<string, number | string | null> | null }[] },
  key: StatColumnKey,
  basis: 'averages' | 'totals',
): number {
  const s = p.player_seasons[0]?.stats;
  if (!s) return 0;
  if (key === 'gp') {
    const gp = Number(s.games_played);
    return Number.isFinite(gp) ? gp : 0;
  }
  const raw = s[STAT_COLUMN_KEYS[key]];
  const v = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  if (!Number.isFinite(v)) return 0;
  const gpNum = Number(s.games_played);
  const gp = Number.isFinite(gpNum) ? gpNum : 0;
  if (key === 'dd' || key === 'td') return basis === 'averages' ? (gp > 0 ? v / gp : 0) : v;
  if (basis === 'averages' || PCT_KEYS.has(key)) return v;
  return v * gp;
}

/** Format a stat-column value: percentages 1dp, counting 1dp avg / int totals. */
export function fmtStat(key: StatColumnKey, basis: 'averages' | 'totals', v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (PCT_KEYS.has(key)) return v.toFixed(1);
  if (key === 'gp') return String(Math.round(v));
  if (key === 'dd' || key === 'td') return basis === 'averages' ? v.toFixed(1) : String(Math.round(v));
  return basis === 'averages' ? v.toFixed(1) : String(Math.round(v));
}

/** JSONB key for each stat column (gp included). */
const STAT_COLUMN_KEYS: Record<StatColumnKey, string> = {
  gp: 'games_played',
  fgm: 'field_goals_made',
  fgPct: 'field_goal_percentage',
  ftPct: 'free_throw_percentage',
  tp: 'three_pointers_made',
  tpPct: 'three_point_percentage',
  reb: 'total_rebounds',
  ast: 'assists',
  stl: 'steals',
  blk: 'blocks',
  to: 'turnovers',
  dd: 'double_doubles',
  td: 'triple_doubles',
  pts: 'points',
};
export interface StatLine {
  gp: string | null;
  mpg: string | null;
  fgm: string | null;
  fgPct: string | null;
  ftPct: string | null;
  tp: string | null;
  tpPct: string | null;
  reb: string | null;
  ast: string | null;
  stl: string | null;
  blk: string | null;
  to: string | null;
  dd: string | null;
  td: string | null;
  pts: string | null;
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
    fgm: fmt(s.field_goals_made),
    fgPct: fmt(s.field_goal_percentage, 3),
    ftPct: fmt(s.free_throw_percentage, 3),
    tp: fmt(s.three_pointers_made),
    tpPct: fmt(s.three_point_percentage, 3),
    reb: fmt(s.total_rebounds),
    ast: fmt(s.assists),
    stl: fmt(s.steals),
    blk: fmt(s.blocks),
    to: fmt(s.turnovers),
    dd: fmt(s.double_doubles, 0),
    td: fmt(s.triple_doubles, 0),
    pts: fmt(s.points),
    rank: fmt(s.rank, 0),
  };
}
