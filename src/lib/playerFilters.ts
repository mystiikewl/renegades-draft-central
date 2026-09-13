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
