import { describe, expect, it } from 'vitest';
import { getTeamColour } from './teamColours';

describe('getTeamColour', () => {
  it('assigns each team ID a stable palette colour', () => {
    expect(getTeamColour('team-alpha')).toBe('#7C3AED');
    expect(getTeamColour('team-beta')).toBe('#2563EB');
    expect(getTeamColour('team-alpha')).toBe('#7C3AED');
  });
});
