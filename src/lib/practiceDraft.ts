import type { DraftPick, DraftSettings, PlayerWithStats } from '@/api/types';
import { GAMES_PLAYED_KEY } from '@/lib/leagueCategories';
import { LEAGUE_CATEGORIES, valueScores, zScores } from '@/lib/projections';
import { buildNeeds, primaryPosition, strategyPreset, type StrategyKey } from '@/lib/draftIntelligence';

export type CpuDraftStrategy = StrategyKey;

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

// Draft-grid rules mirrored from the SQL authority (set_draft_order's grid
// generation in supabase/migrations): snake drafts reverse every even round,
// and keeper slots pre-fill rosters so the grid runs
// roster_size - keeper_limit rounds. Nothing fails on drift — keep in sync.
function practiceGridRounds(settings: DraftSettings): number {
  return Math.max(0, settings.roster_size - settings.keeper_limit);
}

function practiceRoundOrder(settings: DraftSettings, round: number, order: string[]): string[] {
  return settings.draft_type === 'snake' && round % 2 === 0 ? [...order].reverse() : order;
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
  const rounds = practiceGridRounds(settings);
  if (order.length === 0 || rounds === 0) return [];

  const picks: DraftPick[] = [];
  let pickNumber = 1;
  for (let round = 1; round <= rounds; round += 1) {
    const roundOrder = practiceRoundOrder(settings, round, order);

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

// ---------------------------------------------------------------------------
// CPU skill: room difficulty presets plus per-bot jitter
// ---------------------------------------------------------------------------

export type CpuDifficulty = 'rookie' | 'veteran' | 'elite';

export const CPU_DIFFICULTIES: { key: CpuDifficulty; label: string; detail: string }[] = [
  { key: 'rookie', label: 'Rookie', detail: 'Loose and unpredictable. Reaches often, ignores injury history, loose roster shape.' },
  { key: 'veteran', label: 'Veteran', detail: 'Drafts like a solid league manager: value first, fills needs, human variance.' },
  { key: 'elite', label: 'Elite', detail: 'Sharp room. Minimal mistakes, weighs availability risk and roster shape hard.' },
];

interface DifficultyTuning {
  /** Uniform noise (composite z) per candidate — drives reaches and variety. */
  noise: number;
  /** Share of the score that comes from filling category needs (Decision Board: 0.35). */
  fit: number;
  /** Weight on the games-played availability discount. */
  durability: number;
  /** Strength of positional-coverage minimums. */
  discipline: number;
}

const DIFFICULTY_TUNING: Record<CpuDifficulty, DifficultyTuning> = {
  rookie: { noise: 0.55, fit: 0.2, durability: 0, discipline: 0.35 },
  veteran: { noise: 0.25, fit: 0.35, durability: 0.5, discipline: 0.75 },
  elite: { noise: 0.08, fit: 0.35, durability: 1, discipline: 1 },
};

/**
 * Apply a bot's skill jitter (in [-1, 1]) to its room difficulty: positive
 * skill sharpens noise, durability and discipline; negative loosens them.
 */
export function tuningFor(difficulty: CpuDifficulty, skill = 0): DifficultyTuning {
  const base = DIFFICULTY_TUNING[difficulty];
  return {
    noise: Math.max(0.02, base.noise * (1 - skill * 0.45)),
    fit: base.fit,
    durability: Math.max(0, Math.min(1.2, base.durability + skill * 0.25)),
    discipline: Math.max(0, Math.min(1.2, base.discipline + skill * 0.2)),
  };
}

/** Per-bot skill jitter so a room doesn't play uniformly at its difficulty. */
export function assignCpuSkills(
  teamIds: string[],
  userTeamId: string,
  random: () => number = Math.random,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const teamId of teamIds) {
    if (teamId === userTeamId) continue;
    result[teamId] = Math.round((random() * 2 - 1) * 100) / 100;
  }
  return result;
}

export interface CpuPickOptions {
  difficulty: CpuDifficulty;
  /** Per-bot skill jitter in [-1, 1]; 0 plays the difficulty straight. */
  skill?: number;
  /** League size / roster size for the even-draft pace behind need scoring. */
  leagueSize?: number;
  rosterSize?: number;
  /** Injectable randomness so picks stay reproducible in tests. */
  random?: () => number;
}

const SCARCITY_SHARE = 0.1;
const COVER_BONUS = 0.35;

function gamesPlayedOf(player: PlayerWithStats): number {
  const raw = player.player_seasons[0]?.stats?.[GAMES_PLAYED_KEY];
  const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Median games played across the pool — the bar availability risk is measured against. */
function referenceGames(pool: PlayerWithStats[]): number {
  const games = pool.map(gamesPlayedOf).filter((games) => games > 0).sort((a, b) => a - b);
  return games.length ? games[Math.floor(games.length / 2)] : 0;
}

function positionFlags(position: string | null): { guard: boolean; wing: boolean; big: boolean } {
  const p = (position ?? '').toUpperCase();
  return {
    guard: p.includes('PG') || p.includes('SG') || p === 'G',
    wing: p.includes('SF') || p.includes('PF') || p === 'F',
    big: p.includes('C') || p.includes('PF'),
  };
}

/**
 * Rank the board for one CPU decision. Candidates score on the same composite
 * as the Decision Board — overall value, category-need fit, positional
 * scarcity — then adjust for availability risk and positional coverage, with
 * difficulty-scaled noise standing in for human variance.
 */
export function rankCpuPracticeCandidates(
  available: PlayerWithStats[],
  fullPool: PlayerWithStats[],
  rosterPlayerIds: string[],
  strategy: CpuDraftStrategy,
  options: CpuPickOptions = {},
): { player: PlayerWithStats; score: number }[] {
  if (!available.length) return [];

  const tuning = tuningFor(options.difficulty ?? 'veteran', options.skill ?? 0);
  const random = options.random ?? Math.random;
  const leagueSize = Math.max(1, options.leagueSize ?? 10);
  const rosterSize = Math.max(1, options.rosterSize ?? 13);
  const preset = strategyPreset(strategy);

  const rosterSet = new Set(rosterPlayerIds);
  const roster = fullPool.filter((player) => rosterSet.has(player.id));
  const rosterFlags = roster.map((player) => positionFlags(player.position));
  const guards = rosterFlags.filter((flags) => flags.guard).length;
  const bigs = rosterFlags.filter((flags) => flags.big).length;

  const composite = valueScores(available, {
    scoreUniverse: fullPool,
    weights: preset.weights,
    basis: 'totals',
  });
  const universeComposite = valueScores(fullPool, {
    scoreUniverse: fullPool,
    weights: preset.weights,
    basis: 'totals',
  });
  // valueScores returns the weight-normalised composite; the noise and bonus
  // knobs below are tuned on the weighted-sum z scale, so scale back up.
  const weightSum = LEAGUE_CATEGORIES.reduce(
    (sum, category) => sum + Math.max(0, preset.weights[category] ?? 1),
    0,
  );

  // Needs are measured against even-draft pace exactly like the Decision Board.
  const targetCount = Math.max(1, leagueSize * rosterSize);
  const targetPool = [...fullPool]
    .sort(
      (a, b) =>
        (universeComposite.get(b.id) ?? 0) - (universeComposite.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, targetCount);
  const needs = buildNeeds(roster, targetPool, leagueSize, rosterSize, preset);
  const positiveNeeds = needs.filter((need) => need.priority > 0);
  const needWeight = positiveNeeds.reduce((sum, need) => sum + need.priority, 0);
  const needZ = positiveNeeds.map((need) => zScores(fullPool, need.cat, 'totals'));

  // Positional scarcity: how far a candidate outscores the 4th-best still
  // available at their primary position (the board's replacement logic).
  const byPosition = new Map<string, { id: string; score: number }[]>();
  for (const player of available) {
    const position = primaryPosition(player.position);
    const list = byPosition.get(position) ?? [];
    list.push({ id: player.id, score: composite.get(player.id) ?? 0 });
    byPosition.set(position, list);
  }
  const scarcityScore = new Map<string, number>();
  for (const list of byPosition.values()) {
    list.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const replacement = list[Math.min(3, list.length - 1)];
    for (const entry of list) {
      scarcityScore.set(entry.id, Math.max(0, entry.score - replacement.score));
    }
  }

  const reference = referenceGames(fullPool);
  // Once rosters fill out, a team with no guard or no big gets nudged back
  // toward roughly a third of its slots at each.
  const coverageTarget = Math.floor((roster.length + 1) / 3);
  const guardGap = Math.max(0, coverageTarget - guards);
  const bigGap = Math.max(0, coverageTarget - bigs);
  const valueShare = 1 - tuning.fit - SCARCITY_SHARE;

  const scored = available.map((player) => {
    const overall = (composite.get(player.id) ?? 0) * weightSum;
    const fit = needWeight > 0
      ? positiveNeeds.reduce(
          (sum, need, index) => sum + need.priority * (needZ[index].get(player.id) ?? 0),
          0,
        ) / needWeight
      : overall;
    const flags = positionFlags(player.position);
    let score = overall * valueShare
      + fit * tuning.fit
      + (scarcityScore.get(player.id) ?? 0) * weightSum * SCARCITY_SHARE;

    // Availability risk: a season lost to injury is worth less at sharper difficulties.
    if (reference > 0) {
      const games = gamesPlayedOf(player);
      score *= 1 - tuning.durability * Math.min(Math.max(0, (reference - games) / reference), 0.6);
    }

    if (flags.guard && guardGap > 0) score += COVER_BONUS * tuning.discipline;
    if (flags.big && bigGap > 0) score += COVER_BONUS * tuning.discipline;

    // Archetype tilt stays constant — it is what makes each CPU read differently.
    if (strategy === 'big-heavy' && flags.big) score += 0.15;
    if (strategy === 'guard-heavy' && flags.guard) score += 0.15;
    if (strategy === 'stocks' && (flags.wing || flags.big)) score += 0.08;

    score += (random() * 2 - 1) * tuning.noise;
    return { player, score };
  });

  scored.sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));
  return scored;
}

/**
 * Choose a CPU pick. Deterministic only when an injectable `random` is
 * supplied — rooms are meant to vary. No hidden network AI.
 */
export function chooseCpuPracticePlayer(
  available: PlayerWithStats[],
  fullPool: PlayerWithStats[],
  rosterPlayerIds: string[],
  strategy: CpuDraftStrategy,
  options: CpuPickOptions = {},
): PlayerWithStats | null {
  return rankCpuPracticeCandidates(available, fullPool, rosterPlayerIds, strategy, options)[0]?.player ?? null;
}

/** The CPU's live shortlist, shown while it is on the clock. */
export function cpuPracticeShortlist(
  available: PlayerWithStats[],
  fullPool: PlayerWithStats[],
  rosterPlayerIds: string[],
  strategy: CpuDraftStrategy,
  options: CpuPickOptions = {},
  size = 3,
): PlayerWithStats[] {
  return rankCpuPracticeCandidates(available, fullPool, rosterPlayerIds, strategy, options)
    .slice(0, size)
    .map((entry) => entry.player);
}

/** How long a CPU "thinks" before picking: deliberate early, quicker deep in the draft. */
export function cpuThinkDelayMs(
  pickNumber: number,
  totalPicks: number,
  random: () => number = Math.random,
): number {
  const progress = totalPicks > 1
    ? Math.min(1, Math.max(0, (pickNumber - 1) / (totalPicks - 1)))
    : 0;
  const base = 2400 - 1300 * progress;
  return Math.round(base * (0.65 + random() * 0.5));
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
