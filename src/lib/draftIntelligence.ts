import type { PlayerWithStats } from '@/api/types';
import {
  baseline,
  categoryTotals,
  INVERTED_CATEGORIES,
  LEAGUE_CATEGORIES,
  PERCENTAGE_CATEGORIES,
  zScores,
  type Basis,
  type Category,
} from '@/lib/projections';

export type StrategyKey =
  | 'balanced'
  | 'punt-ft'
  | 'punt-fg'
  | 'punt-assists'
  | 'big-heavy'
  | 'guard-heavy'
  | 'stocks';

export const CATEGORY_LABELS: Record<Category, string> = {
  fgm: 'FGM',
  fgPct: 'FG%',
  ftPct: 'FT%',
  tp: '3PM',
  tpPct: '3P%',
  reb: 'REB',
  ast: 'AST',
  stl: 'STL',
  blk: 'BLK',
  to: 'TO',
  dd: 'DD',
  td: 'TD',
  pts: 'PTS',
};

export interface StrategyPreset {
  key: StrategyKey;
  label: string;
  shortLabel: string;
  detail: string;
  weights: Record<Category, number>;
}

function weights(overrides: Partial<Record<Category, number>> = {}): Record<Category, number> {
  return Object.fromEntries(
    LEAGUE_CATEGORIES.map((category) => [category, overrides[category] ?? 1]),
  ) as Record<Category, number>;
}

export const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    key: 'balanced',
    label: 'Balanced build',
    shortLabel: 'Balanced',
    detail: 'Values all 13 categories evenly and lets roster needs break ties.',
    weights: weights(),
  },
  {
    key: 'punt-ft',
    label: 'Punt FT%',
    shortLabel: 'Punt FT%',
    detail: 'Removes FT% from the decision and leans into boards, blocks, FG% and double-doubles.',
    weights: weights({ ftPct: 0, reb: 1.25, blk: 1.35, fgPct: 1.2, dd: 1.2 }),
  },
  {
    key: 'punt-fg',
    label: 'Punt FG%',
    shortLabel: 'Punt FG%',
    detail: 'Accepts field-goal drag for perimeter scoring, assists, threes and free throws.',
    weights: weights({ fgPct: 0, tp: 1.25, tpPct: 1.15, ast: 1.25, ftPct: 1.2, pts: 1.15 }),
  },
  {
    key: 'punt-assists',
    label: 'Punt assists',
    shortLabel: 'Punt AST',
    detail: 'Removes assists and favours scoring, rebounds, defensive stats and efficiency.',
    weights: weights({ ast: 0, reb: 1.2, blk: 1.2, stl: 1.15, pts: 1.15, dd: 1.15 }),
  },
  {
    key: 'big-heavy',
    label: 'Big-heavy build',
    shortLabel: 'Bigs',
    detail: 'Prioritises rebounds, blocks, FG%, makes and double-doubles.',
    weights: weights({ reb: 1.45, blk: 1.5, fgPct: 1.35, fgm: 1.2, dd: 1.35, tp: 0.65, ast: 0.75 }),
  },
  {
    key: 'guard-heavy',
    label: 'Guard-heavy build',
    shortLabel: 'Guards',
    detail: 'Prioritises assists, threes, steals, FT% and perimeter scoring.',
    weights: weights({ ast: 1.45, tp: 1.4, stl: 1.3, ftPct: 1.25, pts: 1.15, blk: 0.7, reb: 0.8 }),
  },
  {
    key: 'stocks',
    label: 'Stocks hunter',
    shortLabel: 'Stocks',
    detail: 'Aggressively values steals and blocks while preserving broad category value.',
    weights: weights({ stl: 1.65, blk: 1.65, reb: 1.1, to: 1.1 }),
  },
];

export function strategyPreset(key: StrategyKey): StrategyPreset {
  return STRATEGY_PRESETS.find((preset) => preset.key === key) ?? STRATEGY_PRESETS[0];
}

export type NeedStatus = 'priority' | 'watch' | 'healthy' | 'punt';

export interface CategoryNeed {
  cat: Category;
  current: number;
  target: number;
  rawGap: number;
  priority: number;
  status: NeedStatus;
}

export interface DraftRecommendation {
  player: PlayerWithStats;
  rank: number;
  tier: number;
  decisionScore: number;
  rawDecisionScore: number;
  overallScore: number;
  fitScore: number;
  scarcityScore: number;
  helps: Category[];
  risks: Category[];
  position: string;
}

export interface PositionScarcity {
  position: string;
  available: number;
  depth: number;
  topPlayer: PlayerWithStats;
  dropOff: number;
  urgency: number;
}

export interface CategoryMarket {
  cat: Category;
  priority: number;
  leaders: PlayerWithStats[];
}

export interface DraftIntelligence {
  strategy: StrategyPreset;
  rosterCompletion: number;
  targetPoolSize: number;
  needs: CategoryNeed[];
  recommendations: DraftRecommendation[];
  scarcity: PositionScarcity[];
  categoryMarkets: CategoryMarket[];
}

export interface DraftIntelligenceInput {
  available: PlayerWithStats[];
  roster: PlayerWithStats[];
  universe: PlayerWithStats[];
  leagueSize: number;
  rosterSize: number;
  strategy: StrategyKey;
  basis?: Basis;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function weightedComposite(
  players: PlayerWithStats[],
  scoreUniverse: PlayerWithStats[],
  preset: StrategyPreset,
  basis: Basis,
): Map<string, number> {
  const categoryScores = new Map<Category, Map<string, number>>();
  for (const category of LEAGUE_CATEGORIES) {
    categoryScores.set(category, zScores(scoreUniverse, category, basis));
  }

  const activeWeight = LEAGUE_CATEGORIES.reduce(
    (sum, category) => sum + Math.max(0, preset.weights[category]),
    0,
  );
  const result = new Map<string, number>();
  for (const player of players) {
    const total = LEAGUE_CATEGORIES.reduce(
      (sum, category) =>
        sum + (categoryScores.get(category)?.get(player.id) ?? 0) * preset.weights[category],
      0,
    );
    result.set(player.id, activeWeight > 0 ? total / activeWeight : 0);
  }
  return result;
}

function categoryScoreMaps(
  universe: PlayerWithStats[],
  basis: Basis,
): Map<Category, Map<string, number>> {
  return new Map(
    LEAGUE_CATEGORIES.map((category) => [category, zScores(universe, category, basis)]),
  );
}

function needScale(category: Category, target: number): number {
  if (PERCENTAGE_CATEGORIES.has(category)) return 0.025;
  return Math.max(Math.abs(target) * 0.12, 1);
}

function buildNeeds(
  roster: PlayerWithStats[],
  targetPool: PlayerWithStats[],
  leagueSize: number,
  rosterSize: number,
  preset: StrategyPreset,
): CategoryNeed[] {
  const totals = categoryTotals(roster, LEAGUE_CATEGORIES);
  const completeTarget = baseline(targetPool, leagueSize, LEAGUE_CATEGORIES);
  const completion = rosterSize > 0 ? clamp(roster.length / rosterSize, 0, 1) : 0;

  return LEAGUE_CATEGORIES.map((cat) => {
    const target = PERCENTAGE_CATEGORIES.has(cat)
      ? completeTarget[cat]
      : completeTarget[cat] * completion;
    // An empty roster has no meaningful percentage profile yet.
    const current = roster.length === 0 && PERCENTAGE_CATEGORIES.has(cat)
      ? target
      : totals[cat];
    const rawGap = INVERTED_CATEGORIES.has(cat) ? current - target : target - current;
    const categoryWeight = preset.weights[cat];
    const priority = categoryWeight === 0 || roster.length === 0
      ? 0
      : clamp(rawGap / needScale(cat, target), -2, 2) * categoryWeight;
    const status: NeedStatus = categoryWeight === 0
      ? 'punt'
      : priority >= 0.35
        ? 'priority'
        : priority >= 0.08
          ? 'watch'
          : 'healthy';
    return { cat, current, target, rawGap, priority, status };
  }).sort((a, b) => b.priority - a.priority);
}

export function primaryPosition(position: string | null): string {
  const matches = (position ?? '').toUpperCase().match(/\b(PG|SG|SF|PF|C)\b/g);
  return matches?.[0] ?? 'UTIL';
}

function tierRecommendations(
  recommendations: Omit<DraftRecommendation, 'rank' | 'tier' | 'decisionScore'>[],
): DraftRecommendation[] {
  const sorted = [...recommendations].sort(
    (a, b) => b.rawDecisionScore - a.rawDecisionScore || a.player.name.localeCompare(b.player.name),
  );
  let tier = 1;
  return sorted.map((recommendation, index) => {
    if (
      index > 0 &&
      sorted[index - 1].rawDecisionScore - recommendation.rawDecisionScore >= 0.3
    ) {
      tier += 1;
    }
    return {
      ...recommendation,
      rank: index + 1,
      tier,
      decisionScore: Math.round(clamp(50 + recommendation.rawDecisionScore * 18, 1, 99)),
    };
  });
}

function buildPositionScarcity(
  recommendations: DraftRecommendation[],
): PositionScarcity[] {
  const grouped = new Map<string, DraftRecommendation[]>();
  for (const recommendation of recommendations) {
    const list = grouped.get(recommendation.position) ?? [];
    list.push(recommendation);
    grouped.set(recommendation.position, list);
  }

  return [...grouped.entries()]
    .map(([position, entries]) => {
      const sorted = [...entries].sort((a, b) => b.overallScore - a.overallScore);
      const top = sorted[0];
      const replacement = sorted[Math.min(3, sorted.length - 1)] ?? top;
      const dropOff = Math.max(0, top.overallScore - replacement.overallScore);
      return {
        position,
        available: sorted.length,
        depth: sorted.filter((entry) => entry.overallScore >= top.overallScore - 0.75).length,
        topPlayer: top.player,
        dropOff,
        urgency: Math.round(clamp(42 + dropOff * 24, 1, 99)),
      };
    })
    .filter((row) => row.available > 0)
    .sort((a, b) => b.urgency - a.urgency || a.position.localeCompare(b.position));
}

export function buildDraftIntelligence(input: DraftIntelligenceInput): DraftIntelligence {
  const basis = input.basis ?? 'totals';
  const preset = strategyPreset(input.strategy);
  const universeById = new Map(input.universe.map((player) => [player.id, player]));
  for (const player of [...input.available, ...input.roster]) universeById.set(player.id, player);
  const universe = [...universeById.values()];

  const universeScores = weightedComposite(universe, universe, preset, basis);
  const targetCount = Math.max(1, input.leagueSize * input.rosterSize);
  const targetPool = [...universe]
    .sort(
      (a, b) =>
        (universeScores.get(b.id) ?? 0) - (universeScores.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, targetCount);
  const needs = buildNeeds(
    input.roster,
    targetPool,
    Math.max(1, input.leagueSize),
    Math.max(1, input.rosterSize),
    preset,
  );

  const categoryMaps = categoryScoreMaps(universe, basis);
  const availableOverall = weightedComposite(input.available, universe, preset, basis);
  const positiveNeeds = needs.filter((need) => need.priority > 0);
  const needWeight = positiveNeeds.reduce((sum, need) => sum + need.priority, 0);

  const byPosition = new Map<string, PlayerWithStats[]>();
  for (const player of input.available) {
    const position = primaryPosition(player.position);
    const list = byPosition.get(position) ?? [];
    list.push(player);
    byPosition.set(position, list);
  }
  for (const list of byPosition.values()) {
    list.sort(
      (a, b) =>
        (availableOverall.get(b.id) ?? 0) - (availableOverall.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name),
    );
  }

  const untiered = input.available.map((player) => {
    const overallScore = availableOverall.get(player.id) ?? 0;
    const fitScore = needWeight > 0
      ? positiveNeeds.reduce(
          (sum, need) =>
            sum + (categoryMaps.get(need.cat)?.get(player.id) ?? 0) * need.priority,
          0,
        ) / needWeight
      : overallScore;
    const position = primaryPosition(player.position);
    const positionPool = byPosition.get(position) ?? [];
    const replacement = positionPool[Math.min(3, positionPool.length - 1)];
    const scarcityScore = replacement
      ? Math.max(0, overallScore - (availableOverall.get(replacement.id) ?? 0))
      : 0;
    const rawDecisionScore = overallScore * 0.55 + fitScore * 0.35 + scarcityScore * 0.1;

    const helps = positiveNeeds
      .map((need) => ({
        cat: need.cat,
        contribution: need.priority * (categoryMaps.get(need.cat)?.get(player.id) ?? 0),
      }))
      .filter((item) => item.contribution > 0.05)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map((item) => item.cat);
    const risks = LEAGUE_CATEGORIES
      .filter((cat) => preset.weights[cat] > 0)
      .map((cat) => ({ cat, score: categoryMaps.get(cat)?.get(player.id) ?? 0 }))
      .filter((item) => item.score < -0.65)
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)
      .map((item) => item.cat);

    return {
      player,
      rawDecisionScore,
      overallScore,
      fitScore,
      scarcityScore,
      helps,
      risks,
      position,
    };
  });

  const recommendations = tierRecommendations(untiered);
  const categoryMarkets = needs
    .filter((need) => need.status === 'priority' || need.status === 'watch')
    .slice(0, 5)
    .map((need) => ({
      cat: need.cat,
      priority: need.priority,
      leaders: [...input.available]
        .sort(
          (a, b) =>
            (categoryMaps.get(need.cat)?.get(b.id) ?? 0) -
              (categoryMaps.get(need.cat)?.get(a.id) ?? 0) ||
            a.name.localeCompare(b.name),
        )
        .slice(0, 3),
    }));

  return {
    strategy: preset,
    rosterCompletion: input.rosterSize > 0
      ? clamp(input.roster.length / input.rosterSize, 0, 1)
      : 0,
    targetPoolSize: targetPool.length,
    needs,
    recommendations,
    scarcity: buildPositionScarcity(recommendations),
    categoryMarkets,
  };
}
