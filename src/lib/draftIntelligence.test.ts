import { describe, expect, it } from 'vitest';
import type { PlayerWithStats } from '@/api/types';
import { buildDraftIntelligence, primaryPosition } from './draftIntelligence';

interface PlayerInput {
  id: string;
  position?: string;
  pts?: number;
  ast?: number;
  reb?: number;
  stl?: number;
  blk?: number;
  tp?: number;
  to?: number;
  fgPct?: number;
  ftPct?: number;
}

function player({
  id,
  position = 'PG',
  pts = 16,
  ast = 4,
  reb = 5,
  stl = 1,
  blk = 0.5,
  tp = 2,
  to = 2,
  fgPct = 0.47,
  ftPct = 0.78,
}: PlayerInput): PlayerWithStats {
  return {
    id,
    espn_id: id,
    name: id,
    position,
    nba_team: 'TST',
    image_url: null,
    created_at: '',
    player_seasons: [{
      season_id: 's1',
      stats: {
        games_played: 82,
        field_goals_made: pts / 2.2,
        field_goals_attempted: pts / 2.2 / fgPct,
        field_goal_percentage: fgPct,
        free_throws_made: 3,
        free_throws_attempted: 3 / ftPct,
        free_throw_percentage: ftPct,
        three_pointers_made: tp,
        three_pointers_attempted: tp / 0.36,
        three_point_percentage: 0.36,
        total_rebounds: reb,
        assists: ast,
        steals: stl,
        blocks: blk,
        turnovers: to,
        double_doubles: reb >= 9 || ast >= 9 ? 20 : 3,
        triple_doubles: ast >= 9 && reb >= 9 ? 4 : 0,
        points: pts,
      },
    }],
  };
}

const anchor = player({ id: 'anchor', pts: 29, ast: 2, reb: 5, position: 'SG' });
const passer = player({ id: 'passer', pts: 18, ast: 11, reb: 5, position: 'PG' });
const scorer = player({ id: 'scorer', pts: 31, ast: 2, reb: 4, position: 'SG' });
const balanced = player({ id: 'balanced', pts: 21, ast: 6, reb: 6, position: 'SF' });
const big = player({ id: 'big', pts: 17, ast: 2, reb: 11, blk: 2, position: 'C' });
const wing = player({ id: 'wing', pts: 19, ast: 4, reb: 7, stl: 2, position: 'SF' });

describe('draft intelligence', () => {
  it('uses roster gaps to separate similarly valuable candidates', () => {
    const available = [passer, scorer, balanced, big, wing];
    const result = buildDraftIntelligence({
      available,
      roster: [anchor],
      universe: [anchor, ...available],
      leagueSize: 2,
      rosterSize: 3,
      strategy: 'balanced',
    });

    const assistNeed = result.needs.find((need) => need.cat === 'ast');
    const passerRecommendation = result.recommendations.find((row) => row.player.id === 'passer');
    const scorerRecommendation = result.recommendations.find((row) => row.player.id === 'scorer');

    expect(assistNeed?.status).toBe('priority');
    expect(passerRecommendation?.fitScore).toBeGreaterThan(scorerRecommendation?.fitScore ?? 0);
    expect(passerRecommendation?.helps).toContain('ast');
  });

  it('removes a punt category from needs and player-fit pressure', () => {
    const available = [passer, scorer, balanced, big, wing];
    const result = buildDraftIntelligence({
      available,
      roster: [anchor],
      universe: [anchor, ...available],
      leagueSize: 2,
      rosterSize: 3,
      strategy: 'punt-assists',
    });

    expect(result.needs.find((need) => need.cat === 'ast')?.status).toBe('punt');
    expect(result.recommendations.every((row) => !row.helps.includes('ast'))).toBe(true);
  });

  it('raises scarcity when a position has a steep replacement cliff', () => {
    const centres = [
      player({ id: 'c-elite', position: 'C', pts: 24, reb: 12, blk: 2.5 }),
      player({ id: 'c-2', position: 'C', pts: 10, reb: 6, blk: 0.8 }),
      player({ id: 'c-3', position: 'C', pts: 9, reb: 5, blk: 0.6 }),
      player({ id: 'c-4', position: 'C', pts: 8, reb: 5, blk: 0.5 }),
    ];
    const guards = [
      player({ id: 'g-1', position: 'PG', pts: 20, ast: 7 }),
      player({ id: 'g-2', position: 'PG', pts: 19, ast: 7 }),
      player({ id: 'g-3', position: 'PG', pts: 18, ast: 7 }),
      player({ id: 'g-4', position: 'PG', pts: 17, ast: 7 }),
    ];
    const available = [...centres, ...guards];
    const result = buildDraftIntelligence({
      available,
      roster: [],
      universe: available,
      leagueSize: 2,
      rosterSize: 4,
      strategy: 'balanced',
    });

    const centreScarcity = result.scarcity.find((row) => row.position === 'C');
    const guardScarcity = result.scarcity.find((row) => row.position === 'PG');
    expect(centreScarcity?.urgency).toBeGreaterThan(guardScarcity?.urgency ?? 0);
    expect(centreScarcity?.topPlayer.id).toBe('c-elite');
  });

  it('normalises multi-position strings to a primary slot', () => {
    expect(primaryPosition('PG, SG')).toBe('PG');
    expect(primaryPosition('PF-C')).toBe('PF');
    expect(primaryPosition(null)).toBe('UTIL');
  });
});
