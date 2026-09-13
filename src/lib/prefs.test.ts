import { beforeEach, describe, expect, it } from 'vitest';
import { loadJsonPref, loadStringPref, removePref, saveJsonPref, saveStringPref } from './prefs';

describe('prefs', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips JSON values', () => {
    saveJsonPref('k', { a: 1 });
    expect(loadJsonPref('k', { a: 0 })).toEqual({ a: 1 });
  });

  it('merges stored objects over their defaults so partial prefs stay valid', () => {
    localStorage.setItem('weights', JSON.stringify({ pts: 3 }));
    expect(loadJsonPref('weights', { pts: 1, reb: 1 })).toEqual({ pts: 3, reb: 1 });
  });

  it('replaces arrays and scalars wholesale', () => {
    localStorage.setItem('builds', JSON.stringify([{ name: 'b' }]));
    expect(loadJsonPref('builds', [])).toEqual([{ name: 'b' }]);
  });

  it('falls back on missing keys and malformed JSON', () => {
    expect(loadJsonPref('missing', { a: 2 })).toEqual({ a: 2 });
    localStorage.setItem('broken', '{nope');
    expect(loadJsonPref('broken', 'fallback')).toBe('fallback');
  });

  it('string prefs round-trip, clear, and survive unavailable storage', () => {
    saveStringPref('basis', 'totals');
    expect(loadStringPref('basis')).toBe('totals');
    removePref('basis');
    expect(loadStringPref('basis')).toBeNull();
  });
});
