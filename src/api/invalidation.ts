import type { QueryClient } from '@tanstack/react-query';
import { qk } from './queries';

/**
 * One owner for "a write to league table X must refresh these query keys".
 * Mutations call invalidateTables() after their RPC; the realtime channel
 * consumes the same mapping (REALTIME_TABLES), so the two paths cannot drift.
 */
export type LeagueTable =
  | 'draft_picks'
  | 'draft_settings'
  | 'rosters'
  | 'trades'
  | 'trade_assets'
  | 'players'
  | 'projections'
  | 'teams'
  | 'seasons'
  | 'profiles'
  | 'notifications';

type KeyFactory = (seasonId: string) => readonly unknown[];

const TABLE_KEYS: Record<LeagueTable, KeyFactory[]> = {
  draft_picks: [qk.draftPicks],
  draft_settings: [qk.draftSettings],
  rosters: [qk.rosters],
  trades: [qk.trades],
  trade_assets: [qk.trades],
  players: [qk.players],
  // Projections are folded into the stats-enriched players read.
  projections: [qk.players],
  teams: [() => qk.teams],
  seasons: [() => qk.seasons, () => qk.activeSeason],
  // Pseudo-table: claim_team updates the caller's profile row.
  profiles: [() => ['profile']],
  // Team-scoped, not season-scoped: the factory ignores the season id.
  notifications: [() => qk.notifications],
};

/** Which real tables the realtime channel subscribes to, and whether they are season-scoped. */
export const REALTIME_TABLES: { table: LeagueTable; seasonScoped: boolean }[] = [
  { table: 'draft_picks', seasonScoped: true },
  { table: 'draft_settings', seasonScoped: true },
  { table: 'rosters', seasonScoped: true },
  { table: 'trades', seasonScoped: true },
  { table: 'trade_assets', seasonScoped: false },
  { table: 'players', seasonScoped: false },
  { table: 'projections', seasonScoped: true },
  { table: 'teams', seasonScoped: false },
  { table: 'seasons', seasonScoped: false },
  { table: 'notifications', seasonScoped: false },
];

export function keysForTable(
  table: LeagueTable,
  seasonId: string,
): (readonly unknown[])[] {
  return TABLE_KEYS[table].map((factory) => factory(seasonId));
}

/** Invalidate every query key fed by the given tables — call from mutation onSuccess. */
export function invalidateTables(
  qc: QueryClient,
  seasonId: string | undefined,
  ...tables: LeagueTable[]
) {
  const id = seasonId ?? '';
  for (const table of tables) {
    for (const key of keysForTable(table, id)) {
      qc.invalidateQueries({ queryKey: key });
    }
  }
}
