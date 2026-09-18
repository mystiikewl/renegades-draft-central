import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Scale } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useActiveSeason, useDraftSettings, useRosterWithStats, useTeams } from '@/api/queries';
import type { PlayerWithStats } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  categoryVerdict,
  DEEP_SHARE,
  marketDepthByCat,
  PROVIDER_Z,
  SCARCE_SHARE,
  strongCategories,
  type MarketDepth,
  type MarketVerdict,
} from '@/lib/categoryMarket';
import {
  buildNeeds,
  strategyPreset,
  type CategoryNeed,
  type StrategyKey,
} from '@/lib/draftIntelligence';
import { CATEGORY_LABELS } from '@/lib/leagueCategories';
import { loadStringPref } from '@/lib/prefs';
import { LEAGUE_CATEGORIES, zScores } from '@/lib/projections';

const DEPTH_LABELS: Record<MarketDepth['depth'], string> = {
  scarce: 'shallow',
  moderate: 'balanced',
  deep: 'deep',
};

const NEED_PHRASES: Record<CategoryNeed['status'], string> = {
  priority: 'priority need',
  watch: 'minor need',
  healthy: 'well covered',
  punt: 'punting',
};

const VERDICT_LABELS: Record<MarketVerdict, string> = {
  premium: 'Premium',
  hold: 'Hold',
  value: 'Value fill',
  filler: 'Filler',
  replaceable: 'Replaceable',
  punting: 'Punting',
};

const VERDICT_CLASS: Record<MarketVerdict, string> = {
  premium: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  hold: 'border-sky-500/40 text-sky-600 dark:text-sky-400',
  value: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  filler: 'text-muted-foreground',
  replaceable: 'text-muted-foreground',
  punting: 'text-muted-foreground',
};

function ordinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  const last = value % 10;
  return `${value}${last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th'}`;
}

/**
 * "Category market context" for Player Lab: whether the candidate's category
 * strengths are scarce (premium) or replaceable (commodity) league-wide, and
 * whether the viewer's roster actually needs them — one verdict row per
 * strong category. Same self-contained pattern as TeamImpactPanel.
 */
export function CategoryMarketPanel({
  candidate,
  pool,
}: {
  candidate: PlayerWithStats | null;
  pool: PlayerWithStats[];
}) {
  const { profile } = useAuth();
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  const { data: settings } = useDraftSettings(seasonId);
  const { data: teams } = useTeams();
  const { data: rosterRows, isLoading: rostersLoading } = useRosterWithStats(seasonId);

  const teamId = profile?.team_id ?? undefined;
  const leagueSize = settings?.league_size ?? teams?.length ?? 1;

  const myPlayers = useMemo(() => {
    const mine = new Map<string, PlayerWithStats>();
    for (const row of rosterRows ?? []) {
      if (row.entry.team_id === teamId && row.player) mine.set(row.player.id, row.player);
    }
    return [...mine.values()];
  }, [rosterRows, teamId]);

  // Honor the Decision Board's strategy lens so both surfaces read needs the same way.
  const preset = useMemo(() => {
    const stored = seasonId ? loadStringPref(`draft-intelligence:${seasonId}:strategy`) : null;
    return strategyPreset((stored as StrategyKey | null) ?? 'balanced');
  }, [seasonId]);

  const depthByCat = useMemo(() => marketDepthByCat(pool, leagueSize), [pool, leagueSize]);
  const zByCat = useMemo(
    () => new Map(LEAGUE_CATEGORIES.map((cat) => [cat, zScores(pool, cat, 'totals')])),
    [pool],
  );

  const needsByCat = useMemo(() => {
    const rosterSize = settings?.roster_size ?? Math.max(1, myPlayers.length);
    const needs = buildNeeds(myPlayers, pool, leagueSize, rosterSize, preset);
    return new Map(needs.map((need) => [need.cat, need]));
  }, [myPlayers, pool, leagueSize, settings?.roster_size, preset]);

  const strong = useMemo(
    () => (candidate ? strongCategories(zByCat, candidate.id) : { rows: [], fallback: false }),
    [candidate, zByCat],
  );

  if (!candidate) return null;

  const loading = rostersLoading || teams == null;
  const claimed = !!teamId;
  const hasRoster = myPlayers.length > 0;
  const topHeavyCats = strong.rows
    .filter((row) => depthByCat.get(row.cat)?.topHeavy)
    .map((row) => CATEGORY_LABELS[row.cat]);

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-2">
        <Scale className="size-4 shrink-0" />
        <h2 className="font-bold">Category market context</h2>
        {claimed && !loading && hasRoster && strong.rows.length > 0 && (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            how {candidate.name}'s strengths are stocked league-wide
          </span>
        )}
      </div>

      <div className="mt-4">
        {!claimed ? (
          <p className="text-sm text-muted-foreground">
            Claim your team in{' '}
            <Link to="/profile" className="font-semibold text-primary hover:underline">your profile</Link>{' '}
            to see whether {candidate.name}'s strengths fill your roster's needs.
          </p>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-9 w-full" />)}
          </div>
        ) : !hasRoster ? (
          <p className="text-sm text-muted-foreground">
            No roster yet — market context unlocks once draft picks land. Building a hypothetical roster?{' '}
            <Link to="/team-builder" className="font-semibold text-primary hover:underline">Try the Team Builder</Link>.
          </p>
        ) : strong.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No category data for this player yet.</p>
        ) : (
          <div className="space-y-2.5">
            {strong.rows.map((row) => {
              const depth = depthByCat.get(row.cat);
              if (!depth) return null;
              const verdict = categoryVerdict(depth, row, needsByCat.get(row.cat));
              return (
                <MarketRow
                  key={row.cat}
                  depth={depth}
                  percentile={row.percentile}
                  poolSize={row.poolSize}
                  rank={row.rank}
                  need={needsByCat.get(row.cat)}
                  verdict={verdict}
                />
              );
            })}
            {strong.fallback && (
              <p className="text-[10px] text-muted-foreground">
                No provider-level categories — showing his relative strengths only.
              </p>
            )}
            {topHeavyCats.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Top-heavy: {topHeavyCats.join(', ')} — value drops fast after the elite tier.
              </p>
            )}
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Depth = share of the player pool at provider level (z ≥ {PROVIDER_Z}, season totals):
              scarce &lt; {Math.round(SCARCE_SHARE * 100)}% ≤ balanced ≤ {Math.round(DEEP_SHARE * 100)}% &lt; deep.
              Verdict weighs market depth, your roster need and his pool rank.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function MarketRow({
  depth,
  percentile,
  poolSize,
  rank,
  need,
  verdict,
}: {
  depth: MarketDepth;
  percentile: number;
  poolSize: number;
  rank: number;
  need?: CategoryNeed;
  verdict: MarketVerdict;
}) {
  const filled = depth.depth === 'scarce' ? 1 : depth.depth === 'moderate' ? 2 : 3;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABELS[depth.cat]}
          </span>
          <span className="flex items-center gap-0.5" aria-hidden>
            {[1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={`size-1.5 rounded-full ${dot <= filled ? 'bg-foreground/70' : 'bg-muted-foreground/25'}`}
              />
            ))}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {DEPTH_LABELS[depth.depth]} market{depth.topHeavy ? ' · top-heavy' : ''}
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          #{rank} of {poolSize} pool ({ordinal(percentile)} pct) · {need ? NEED_PHRASES[need.status] : 'no need data'}
        </div>
      </div>
      <Badge variant="outline" className={`shrink-0 ${VERDICT_CLASS[verdict]}`}>
        {VERDICT_LABELS[verdict]}
      </Badge>
    </div>
  );
}
