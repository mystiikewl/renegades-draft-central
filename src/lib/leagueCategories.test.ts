import { describe, expect, it } from 'vitest';
import {
  ATTEMPT_KEYS,
  CATEGORY_LABELS,
  CATEGORY_STAT_KEYS,
  INVERTED_CATEGORIES,
  LEAGUE_CATEGORIES,
  PERCENTAGE_CATEGORIES,
  attemptsPerGame,
  toFraction,
} from './leagueCategories';

describe('league categories', () => {
  it('defines the 13 ROTO categories in standings order with unique JSONB keys', () => {
    expect(LEAGUE_CATEGORIES).toHaveLength(13);
    const keys = LEAGUE_CATEGORIES.map((cat) => CATEGORY_STAT_KEYS[cat]);
    expect(new Set(keys).size).toBe(13);
    expect(LEAGUE_CATEGORIES[0]).toBe('fgm');
    expect(LEAGUE_CATEGORIES[12]).toBe('pts');
  });

  it('marks turnovers inverted and the three shooting rates as percentages', () => {
    expect([...INVERTED_CATEGORIES]).toEqual(['to']);
    expect([...PERCENTAGE_CATEGORIES].sort()).toEqual(['fgPct', 'ftPct', 'tpPct']);
  });

  it('labels every category the way the tables render it', () => {
    expect(CATEGORY_LABELS.fgPct).toBe('FG%');
    expect(CATEGORY_LABELS.tp).toBe('3PM');
    expect(CATEGORY_LABELS.dd).toBe('DD');
  });

  it('reads fractions natively and rescales 0-100 imports', () => {
    expect(toFraction(0.485)).toBeCloseTo(0.485);
    expect(toFraction(48.5)).toBeCloseTo(0.485);
    expect(toFraction('0.9')).toBeCloseTo(0.9);
    expect(toFraction(null)).toBe(0);
  });

  it('derives per-game attempts from direct attempts, falling back to made/pct', () => {
    const stats = {
      field_goals_made: 6,
      field_goals_attempted: 12,
      free_throws_made: 4,
      free_throw_percentage: 0.8,
      three_pointers_made: 2,
      three_point_percentage: 0.4,
    };
    expect(attemptsPerGame(stats, 'fgPct')).toBeCloseTo(12);
    expect(attemptsPerGame(stats, 'ftPct')).toBeCloseTo(5); // 4 made / 0.8
    expect(attemptsPerGame(stats, 'tpPct')).toBeCloseTo(5); // 2 made / 0.4
  });

  it('gives every percentage category volume keys', () => {
    for (const cat of PERCENTAGE_CATEGORIES) {
      expect(ATTEMPT_KEYS[cat]).toBeDefined();
    }
  });
});
