import type { DraftPick, DraftSettings, PlayerWithStats } from '@/api/types';
import { LEAGUE_CATEGORIES, valueScores, type Category } from '@/lib/projections';
import { STRATEGY_PRESETS } from '@/lib/draftIntelligence';

export type CpuDraftStrategy =
  | 'balanced'
  | 'punt-ft'
  | 'punt-fg'
  | 'punt-assists'
  | 'big-heavy'
  | 'guard-heavy'
  | 'stocks';

export const CPU_STRATEGIES: { key: CpuDraftStrategy; label: string; detail: string }[] = [
  { key: 'balanced', label: 'Balanced', detail: 'Best all-round value with light roster-balance pressure.' },
  { key: 'punt-ft', label: 'Punt FT%', detail: 'De-emphasises free throws and leans into big-man production.' },
  { key: 'punt-fg', label: 'Punt FG%', detail: 'Accepts efficiency loss for perimeter scoring and creation.' },
  { key: 'punt-assists', label: 'Punt AST', detail: 'De-emphasises assists for scoring, boards and defensive stats.' },
  { key: 'big-heavy', label: 'Big Heavy', detail: 'Prioritises rebounds, blocks, FG% and double-doubles.' },
  { key: 'guard-heavy', label: 'Guard Heavy', detail: 'Prioritises threes, assists, steals and FT%.' },
  { key: 'stocks', label: 'Stocks Hunter', detail: 'Aggressively targets steals and blocks.' },
];

/** Fisher-Yates shuffle with injectable randomness for tests. */
export function shufflePracticeTeams<T>(values: T[], random: () => number = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Put the user's team in the selected 1-based draft slot and randomise every
 * other CPU manager around them. Practice order is intentionally independent
 * from the live league draft order.
 */
export function buildPracticeOrder(
  teamIds: string[],
  userTeamId: string,
  userSlot: number,
  random: () => number = Math.random,
): string[] {
  const unique = [...new Set(teamIds)];
  if (!unique.includes(userTeamId)) unique.unshift(userTeamId);
  const others = shufflePracticeTeams(unique.filter((id) => id !== userTeamId), random);
  const slot = Math.max(1, Math.min(unique.length, Math.floor(userSlot || 1))) - 1;
  const order = [...others];
  order.splice(slot, 0, userTeamId);
  return order;
}

/** Assign a stable strategy to each CPU for one simulation. */
export function assignCpuStrategies(
  teamIds: string[],
  userTeamId: string,
  random: () => number = Math.random,
): Record<string, CpuDraftStrategy> {
  const strategies = CPU_STRATEGIES.map((item) => item.key);
  const shuffled = shufflePracticeTeams(strategies, random);
  const result: Record<string, CpuDraftStrategy> = {};
  let index = 0;
  for (const teamId of teamIds) {
    if (teamId === userTeamId) continue;
    result[teamId] = shuffled[index % shuffled.length];
    index += 1;
  }
  return result;
}

/**
 * Build a disposable board from an explicit draft order (the practice path) or
 * the settings' own order. Nothing here writes to Supabase.
 */
export function buildPracticeBoard(
  settings: DraftSettings,
  orderOverride?: string[],
): DraftPick[] {
  const order = orderOverride ?? settings.draft_order ?? [];
  const rounds = Math.max(0, settings.roster_size - settings.keeper_limit);
  if (order.length === 0 || rounds === 0) return [];

  const picks: DraftPick[] = [];
  let pickNumber = 1;
  for (let round = 1; round <= rounds; round += 1) {
    const roundOrder = settings.draft_type === 'snake' && round % 2 === 0
      ? [...order].reverse()
      : order;

    for (const teamId of roundOrder) {
      picks.push({
        id: `practice-${pickNumber}`,
        season_id: settings.season_id,
        round,
        pick_number: pickNumber,
        team_id: teamId,
        original_team_id: teamId,
        player_id: null,
        is_used: false,
        is_skipped: false,
        skipped_at: null,
        picked_at: null,
        players: null,
        team: null,
      });
      pickNumber += 1;
    }
  }
  return picks;
}

export function availablePracticePlayers(players: PlayerWithStats[], picks: DraftPick[]): PlayerWithStats[] {
  const drafted = new Set(picks.flatMap((pick) => pick.player_id ? [pick.player_id] : []));
  return players.filter((player) => !drafted.has(player.id));
}

/** All-category value on the same scale as the Player Pool's VAL column. */
export function practiceScores(players: PlayerWithStats[]): Map<string, number> {
  return valueScores(players, { basis: 'totals' });
}

// One weight table: the CPU consumes the same STRATEGY_PRESETS the live
// Decision Board uses (they had silently diverged when duplicated).
const STRATEGY_WEIGHTS = Object.fromEntries(
  STRATEGY_PRESETS.map((preset) => [preset.key, preset.weights]),
) as Record<CpuDraftStrategy, Partial<Record<Category, number>>>;

function positionFlags(position: string | null): { guard: boolean; wing: boolean; big: boolean } {
  const p = (position ?? '').toUpperCase();
  return {
    guard: p.includes('PG') || p.includes('SG') || p === 'G',
    wing: p.includes('SF') || p.includes('PF') || p === 'F',
    big: p.includes('C') || p.includes('PF'),
  };
}

/**
 * Choose a CPU pick using category strategy plus light roster construction.
 * This is deterministic for a given board/player pool: no hidden network AI.
 */
export function chooseCpuPracticePlayer(
  available: PlayerWithStats[],
  fullPool: PlayerWithStats[],
  rosterPlayerIds: string[],
  strategy: CpuDraftStrategy,
): PlayerWithStats | null {
  if (!available.length) return null;
  const rosterSet = new Set(rosterPlayerIds);
  const roster = fullPool.filter((player) => rosterSet.has(player.id));
  const rosterFlags = roster.map((player) => positionFlags(player.position));
  const guards = rosterFlags.filter((flags) => flags.guard).length;
  const bigs = rosterFlags.filter((flags) => flags.big).length;
  const weights = STRATEGY_WEIGHTS[strategy];
  // valueScores normalises by the weight sum; the roster-balance bonuses below
  // were tuned on the weighted-sum scale, so scale the composite back up.
  const weightSum = LEAGUE_CATEGORIES.reduce(
    (sum, category) => sum + Math.max(0, weights[category] ?? 1),
    0,
  );
  const composite = valueScores(available, {
    scoreUniverse: fullPool,
    weights,
    basis: 'totals',
  });

  const scored = available.map((player) => {
    let score = (composite.get(player.id) ?? 0) * weightSum;

    const flags = positionFlags(player.position);
    // Avoid cartoonishly unbalanced rosters while keeping archetypes distinct.
    if (roster.length >= 2 && guards === 0 && flags.guard) score += 1.1;
    if (roster.length >= 2 && bigs === 0 && flags.big) score += 1.1;
    if (strategy === 'big-heavy' && flags.big) score += 0.8;
    if (strategy === 'guard-heavy' && flags.guard) score += 0.8;
    if (strategy === 'stocks' && (flags.wing || flags.big)) score += 0.25;

    return { player, score };
  });

  scored.sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));
  return scored[0]?.player ?? null;
}

export function bestPracticePlayer(players: PlayerWithStats[]): PlayerWithStats | null {
  if (players.length === 0) return null;
  const scores = practiceScores(players);
  return [...players].sort((a, b) => {
    const diff = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
    return diff || a.name.localeCompare(b.name);
  })[0] ?? null;
}

export function makePracticePick(picks: DraftPick[], pickId: string, player: PlayerWithStats): DraftPick[] {
  if (picks.some((pick) => pick.player_id === player.id)) return picks;
  return picks.map((pick) =>
    pick.id === pickId && !pick.is_used
      ? {
          ...pick,
          player_id: player.id,
          is_used: true,
          is_skipped: false,
          picked_at: new Date().toISOString(),
          players: {
            name: player.name,
            position: player.position,
            nba_team: player.nba_team,
            espn_id: player.espn_id,
          },
        }
      : pick,
  );
}

export function skipPracticePick(picks: DraftPick[], pickId: string): DraftPick[] {
  return picks.map((pick) =>
    pick.id === pickId && !pick.is_used
      ? {
          ...pick,
          is_used: true,
          is_skipped: true,
          skipped_at: new Date().toISOString(),
          picked_at: null,
          player_id: null,
          players: null,
        }
      : pick,
  );
}
