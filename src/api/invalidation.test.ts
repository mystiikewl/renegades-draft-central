import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { keysForTable, REALTIME_TABLES, invalidateTables, type LeagueTable } from './invalidation';

describe('invalidation policy', () => {
  it('maps each table to the season-scoped keys it feeds', () => {
    expect(keysForTable('rosters', 's1')).toEqual([[...['rosters', 's1']]]);
    expect(keysForTable('draft_picks', 's1')).toEqual([[...['draft-picks', 's1']]]);
  });

  it('feeds projections into the players cache — pools and Lab share one key', () => {
    expect(keysForTable('projections', 's1')).toEqual(keysForTable('players', 's1'));
  });

  it('trade assets refresh the trade ledger; seasons refresh both season keys', () => {
    expect(keysForTable('trade_assets', 's1')).toEqual(keysForTable('trades', 's1'));
    expect(keysForTable('seasons', 's1')).toContainEqual([...['season', 'active']]);
  });

  it('invalidates one query per mapped key through the client', () => {
    const invalidateQueries = vi.fn();
    invalidateTables({ invalidateQueries } as unknown as QueryClient, 's1', 'rosters', 'draft_picks');
    const keys = invalidateQueries.mock.calls.map((c) => c[0]!.queryKey);
    expect(keys).toContainEqual(['rosters', 's1']);
    expect(keys).toContainEqual(['draft-picks', 's1']);
  });

  it('subscribes realtime to real tables only — the profiles pseudo-table stays out', () => {
    const names = REALTIME_TABLES.map((t) => t.table as LeagueTable);
    expect(names).not.toContain('profiles');
    expect(names).toContain('players');
    expect(names).toContain('projections');
  });
});
