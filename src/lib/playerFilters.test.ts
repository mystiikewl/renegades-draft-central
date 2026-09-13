import { describe, expect, it } from 'vitest';
import { matchesPosition, matchesSearch } from './playerFilters';

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
