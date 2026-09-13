/**
 * The league's 13 ROTO categories — the one vocabulary every surface shares.
 * Keys map to the player_seasons.stats / projections.stats JSONB contract;
 * labels are the table-header spellings. Adding or renaming a category is a
 * change here, not in eight partial copies across pages.
 */

export const CATEGORY_STAT_KEYS = {
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
} as const;

export type Category = keyof typeof CATEGORY_STAT_KEYS;

/** The league's 13 ROTO categories, in standings order. */
export const LEAGUE_CATEGORIES = Object.keys(CATEGORY_STAT_KEYS) as Category[];

/** Categories where LOWER is better (counted negatively in rankings). */
export const INVERTED_CATEGORIES: ReadonlySet<Category> = new Set(['to']);

/** Percentage categories require volume-aware aggregation and ranking. */
export const PERCENTAGE_CATEGORIES: ReadonlySet<Category> = new Set(['fgPct', 'ftPct', 'tpPct']);

/** Counting cats stored as per-game averages — valued at season totals (avg x GP). */
export const AVERAGE_CATEGORIES: ReadonlySet<Category> = new Set([
  'fgm', 'tp', 'reb', 'ast', 'stl', 'blk', 'to', 'pts',
]);

export const GAMES_PLAYED_KEY = 'games_played';

export const CATEGORY_LABELS: Record<Category, string> = {
  fgm: 'FGM',
  fgPct: 'FG%',
  ftPct: 'FT%',
  tp: '3PM',
  tpPct: '3P%',
  reb: 'REB',
  ast: 'AST',
  stl: 'STL',
  blk: 'BLK',
  to: 'TO',
  dd: 'DD',
  td: 'TD',
  pts: 'PTS',
};

/** Made/attempted JSONB keys behind each percentage category. */
export const ATTEMPT_KEYS: Partial<Record<Category, { made: string; attempts: string }>> = {
  fgPct: { made: 'field_goals_made', attempts: 'field_goals_attempted' },
  ftPct: { made: 'free_throws_made', attempts: 'free_throws_attempted' },
  tpPct: { made: 'three_pointers_made', attempts: 'three_pointers_attempted' },
};

type StatsRecord = Record<string, number | string | null> | null | undefined;

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Percentage feeds store fractions; accept 49.5 as 49.5% to stay resilient to alternate imports. */
export function toFraction(value: unknown): number {
  const parsed = num(value);
  return parsed > 1.5 ? parsed / 100 : parsed;
}

/** Per-game attempts for a percentage category: the stored attempts when present, else made / pct. */
export function attemptsPerGame(stats: StatsRecord, cat: Category): number {
  const keys = ATTEMPT_KEYS[cat];
  if (!stats || !keys) return 0;
  const direct = num(stats[keys.attempts]);
  if (direct > 0) return direct;
  const made = num(stats[keys.made]);
  const pct = toFraction(stats[CATEGORY_STAT_KEYS[cat]]);
  return pct > 0 && made > 0 ? made / pct : 0;
}

/** Read a raw category value as a display number (percentages normalised to fractions). */
export function statNumber(stats: StatsRecord, cat: Category): number {
  const raw = stats?.[CATEGORY_STAT_KEYS[cat]];
  return PERCENTAGE_CATEGORIES.has(cat) ? toFraction(raw) : num(raw);
}
