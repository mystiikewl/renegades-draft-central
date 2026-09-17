import { describe, expect, it } from 'vitest';
import { matchesPosition, matchesSearch, rookieDraftOrder } from './playerFilters';

it('parses numeric round/pick order and rejects missing, malformed and other-year draft data', () => {
  expect(rookieDraftOrder('2026: Rd 1, Pk 10 (WSH)', 2026)).toBe(110);
  expect(rookieDraftOrder('2026: Rd 2, Pk 1 (BOS)', 2026)).toBe(201);
  for (const display of [null, undefined, 42, 'Undrafted', '2025: Rd 1, Pk 1 (DAL)',
    '2026: Rd 1, Pk 0 (WSH)', '2026: Rd 1, Pk 61 (WSH)', '2026: Rd 3, Pk 1 (WSH)', '2026: Rd 1, Pk 1.5 (WSH)']) {
    expect(rookieDraftOrder(display, 2026)).toBe(Infinity);
  }
});

describe('matchesPosition', () => {
  it('passes everything on All', () => {
    expect(matchesPosition({ position: null }, 'All')).toBe(true);
    expect(matchesPosition({ position: 'PG' }, 'All')).toBe(true);
  });

  it('matches exact tokens and the G/F umbrella tokens', () => {
    expect(matchesPosition({ position: 'PG' }, 'PG')).toBe(true);
    expect(matchesPosition({ position: 'PG, SG' }, 'SG')).toBe(true);
    expect(matchesPosition({ position: 'G' }, 'PG')).toBe(true);
    expect(matchesPosition({ position: 'G' }, 'SG')).toBe(true);
    expect(matchesPosition({ position: 'F' }, 'SF')).toBe(true);
    expect(matchesPosition({ position: 'F' }, 'PF')).toBe(true);
    expect(matchesPosition({ position: 'ALL' }, 'C')).toBe(true);
  });

  it('rejects non-matching tokens', () => {
    expect(matchesPosition({ position: 'C' }, 'PG')).toBe(false);
    expect(matchesPosition({ position: 'G' }, 'C')).toBe(false);
    expect(matchesPosition({ position: null }, 'PG')).toBe(false);
  });
});

describe('matchesSearch', () => {
  const player = { name: 'Luka Doncic', nba_team: 'DAL', position: 'PG' };

  it('matches name, team or position case-insensitively', () => {
    expect(matchesSearch(player, 'luka')).toBe(true);
    expect(matchesSearch(player, 'dal')).toBe(true);
    expect(matchesSearch(player, 'pg')).toBe(true);
  });

  it('empty queries match everyone; misses match no one', () => {
    expect(matchesSearch(player, '  ')).toBe(true);
    expect(matchesSearch(player, 'boston')).toBe(false);
  });

  it('tolerates missing team and position', () => {
    expect(matchesSearch({ name: 'X', nba_team: null, position: null }, 'x')).toBe(true);
  });
});
