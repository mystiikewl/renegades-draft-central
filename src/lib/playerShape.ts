import type { PlayerWithStats } from '@/api/types';
import { playerValue } from '@/lib/projections';
import { attemptsPerGame, CATEGORY_STAT_KEYS, toFraction } from '@/lib/leagueCategories';

export type ShapeAxis = 'pts' | 'tp' | 'reb' | 'ast' | 'stl' | 'blk' | 'fgImpact' | 'ftImpact';

export const SHAPE_AXES: { key: ShapeAxis; label: string; shortLabel: string }[] = [
  { key: 'pts', label: 'Points', shortLabel: 'PTS' },
  { key: 'tp', label: 'Three-pointers', shortLabel: '3PM' },
  { key: 'reb', label: 'Rebounds', shortLabel: 'REB' },
  { key: 'ast', label: 'Assists', shortLabel: 'AST' },
  { key: 'stl', label: 'Steals', shortLabel: 'STL' },
  { key: 'blk', label: 'Blocks', shortLabel: 'BLK' },
  { key: 'fgImpact', label: 'Field-goal impact', shortLabel: 'FG IMP' },
  { key: 'ftImpact', label: 'Free-throw impact', shortLabel: 'FT IMP' },
];

export interface ShapeMetric {
  key: ShapeAxis;
  label: string;
  shortLabel: string;
  raw: number;
  percentile: number;
  rank: number;
  poolSize: number;
  draftRead: string;
}

export interface PlayerShape {
  playerId: string;
  metrics: ShapeMetric[];
  overall: number;
  strongest: ShapeMetric[];
  weakest: ShapeMetric[];
  tags: string[];
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function games(player: PlayerWithStats): number {
  return Math.max(1, num(player.player_seasons[0]?.stats?.games_played));
}

function poolShootingBaseline(pool: PlayerWithStats[], cat: 'fgPct' | 'ftPct'): number {
  let makes = 0;
  let attempts = 0;
  for (const player of pool) {
    const stats = player.player_seasons[0]?.stats ?? {};
    const att = attemptsPerGame(stats, cat) * games(player);
    const pct = toFraction(stats[CATEGORY_STAT_KEYS[cat]]);
    if (att <= 0 || pct <= 0) continue;
    attempts += att;
    makes += pct * att;
  }
  return attempts > 0 ? makes / attempts : 0;
}

function shootingImpact(
  player: PlayerWithStats,
  cat: 'fgPct' | 'ftPct',
  baseline: number,
): number {
  const stats = player.player_seasons[0]?.stats ?? {};
  const pct = toFraction(stats[CATEGORY_STAT_KEYS[cat]]);
  const attempts = attemptsPerGame(stats, cat) * games(player);
  if (pct <= 0 || attempts <= 0 || baseline <= 0) return 0;
  return (pct - baseline) * attempts;
}

function rawMetric(player: PlayerWithStats, axis: ShapeAxis, fgBase: number, ftBase: number): number {
  if (axis === 'fgImpact') return shootingImpact(player, 'fgPct', fgBase);
  if (axis === 'ftImpact') return shootingImpact(player, 'ftPct', ftBase);
  return playerValue(player, axis, 'totals');
}

function percentile(values: number[], value: number): number {
  if (!values.length) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  let below = 0;
  let equal = 0;
  for (const candidate of sorted) {
    if (candidate < value) below++;
    else if (candidate === value) equal++;
  }
  const rank = (below + Math.max(0, equal - 1) / 2) / Math.max(1, sorted.length - 1);
  return Math.max(1, Math.min(99, Math.round(rank * 98 + 1)));
}

function competitionRank(values: number[], value: number): number {
  return values.filter((candidate) => candidate > value).length + 1;
}

function draftRead(percentileRank: number): string {
  if (percentileRank >= 90) return 'Elite source';
  if (percentileRank >= 75) return 'Strong contributor';
  if (percentileRank >= 55) return 'Above pool average';
  if (percentileRank >= 40) return 'Around pool average';
  if (percentileRank >= 20) return 'Build-dependent';
  return 'Needs covering';
}

function shapeTags(metrics: ShapeMetric[]): string[] {
  const byKey = new Map(metrics.map((metric) => [metric.key, metric.percentile]));
  const tags: { score: number; label: string }[] = [];
  const add = (score: number, threshold: number, label: string) => {
    if (score >= threshold) tags.push({ score, label });
  };

  add(byKey.get('pts') ?? 0, 90, 'Elite scorer');
  add(byKey.get('tp') ?? 0, 88, 'Perimeter weapon');
  add(byKey.get('reb') ?? 0, 88, 'Rebounding force');
  add(byKey.get('ast') ?? 0, 88, 'Primary creator');
  add(((byKey.get('stl') ?? 0) + (byKey.get('blk') ?? 0)) / 2, 82, 'Defensive playmaker');
  add(byKey.get('fgImpact') ?? 0, 88, 'FG% anchor');
  add(byKey.get('ftImpact') ?? 0, 88, 'FT% anchor');

  if ((byKey.get('fgImpact') ?? 100) <= 20) tags.push({ score: 80, label: 'FG% drag' });
  if ((byKey.get('ftImpact') ?? 100) <= 20) tags.push({ score: 80, label: 'FT% drag' });

  return tags.sort((a, b) => b.score - a.score).slice(0, 3).map((tag) => tag.label);
}

export function buildPlayerShapes(pool: PlayerWithStats[]): Map<string, PlayerShape> {
  const result = new Map<string, PlayerShape>();
  if (!pool.length) return result;
  const fgBase = poolShootingBaseline(pool, 'fgPct');
  const ftBase = poolShootingBaseline(pool, 'ftPct');
  const rawByAxis = new Map<ShapeAxis, number[]>();

  for (const axis of SHAPE_AXES) {
    rawByAxis.set(axis.key, pool.map((player) => rawMetric(player, axis.key, fgBase, ftBase)));
  }

  for (const player of pool) {
    const metrics = SHAPE_AXES.map((axis) => {
      const raw = rawMetric(player, axis.key, fgBase, ftBase);
      const values = rawByAxis.get(axis.key) ?? [];
      const percentileRank = percentile(values, raw);
      return {
        ...axis,
        raw,
        percentile: percentileRank,
        rank: competitionRank(values, raw),
        poolSize: values.length,
        draftRead: draftRead(percentileRank),
      };
    });
    const sorted = [...metrics].sort((a, b) => b.percentile - a.percentile);
    result.set(player.id, {
      playerId: player.id,
      metrics,
      overall: Math.round(metrics.reduce((sum, metric) => sum + metric.percentile, 0) / metrics.length),
      strongest: sorted.slice(0, 3),
      weakest: sorted.slice(-2).reverse(),
      tags: shapeTags(metrics),
    });
  }

  return result;
}

export function shapeSimilarity(a: PlayerShape, b: PlayerShape): number {
  const byKey = new Map(b.metrics.map((metric) => [metric.key, metric.percentile]));
  const squared = a.metrics.reduce((sum, metric) => {
    const other = byKey.get(metric.key) ?? 50;
    return sum + (metric.percentile - other) ** 2;
  }, 0);
  const maxDistance = 98 * Math.sqrt(a.metrics.length);
  const distance = Math.sqrt(squared);
  return Math.max(0, Math.min(100, Math.round((1 - distance / maxDistance) * 100)));
}

export function closestShapeMatches(
  playerId: string,
  shapes: Map<string, PlayerShape>,
  limit = 5,
): { playerId: string; similarity: number }[] {
  const source = shapes.get(playerId);
  if (!source) return [];
  return [...shapes.values()]
    .filter((shape) => shape.playerId !== playerId)
    .map((shape) => ({ playerId: shape.playerId, similarity: shapeSimilarity(source, shape) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
