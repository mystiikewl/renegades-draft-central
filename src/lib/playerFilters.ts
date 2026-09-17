import type { PlayerWithStats } from '@/api/types';

export const POSITION_FILTERS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'] as const;

export type PositionFilter = (typeof POSITION_FILTERS)[number];

/**
 * Positional eligibility: exact token, ALL, or the G/F umbrella tokens.
 * Shared by the Player Pool table and the live-draft picking list (previously
 * two verbatim copies plus two private variants).
 */
export function matchesPosition(
  player: Pick<PlayerWithStats, 'position'>,
  position: PositionFilter,
): boolean {
  if (position === 'All') return true;
  const tokens = (player.position ?? '').split(',').map((token) => token.trim());
  return (
    tokens.includes(position) ||
    tokens.includes('ALL') ||
    ((position === 'PG' || position === 'SG') && tokens.includes('G')) ||
    ((position === 'SF' || position === 'PF') && tokens.includes('F'))
  );
}

/** ESPN's pick is not consistently round-local; sort lexically by round then pick. */
export function rookieDraftOrder(display: unknown, year: number): number {
  const match = typeof display === 'string'
    ? /^(\d{4}): Rd ([12]), Pk ([1-9]\d?) \([A-Z]{2,4}\)$/.exec(display.trim()) : null;
  if (!match || Number(match[1]) !== year || Number(match[3]) > 60) return Infinity;
  return Number(match[2]) * 100 + Number(match[3]);
}

/** Case-insensitive player search across name, NBA team and position. */
export function matchesSearch(
  player: Pick<PlayerWithStats, 'name' | 'nba_team' | 'position'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    player.name.toLowerCase().includes(needle) ||
    (player.nba_team ?? '').toLowerCase().includes(needle) ||
    (player.position ?? '').toLowerCase().includes(needle)
  );
}
