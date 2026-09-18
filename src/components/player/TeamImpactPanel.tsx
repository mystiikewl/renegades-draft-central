import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Minus, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useActiveSeason, useDraftSettings, useRosterWithStats, useTeams } from '@/api/queries';
import type { PlayerWithStats } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  baseline,
  impact,
  INVERTED_CATEGORIES,
  leagueValueScores,
  LEAGUE_CATEGORIES,
  PERCENTAGE_CATEGORIES,
  type CategoryImpact,
} from '@/lib/projections';
import { CATEGORY_LABELS } from '@/lib/leagueCategories';
import { standingsSwing, type StandingsSwing } from '@/lib/rotoStandings';

type Mode = 'add' | 'swap';

interface Analysis {
  dropped: PlayerWithStats | null;
  impacts: CategoryImpact[];
  swing: StandingsSwing | null;
}

/** Lowest composite value on a roster — the default swap-out suggestion. */
function weakestPlayer(players: PlayerWithStats[], values: Map<string, number>): PlayerWithStats | null {
  let worst: PlayerWithStats | null = null;
  let worstValue = Number.POSITIVE_INFINITY;
  for (const player of players) {
    const value = values.get(player.id) ?? Number.NEGATIVE_INFINITY;
    if (value < worstValue) {
      worst = player;
      worstValue = value;
    }
  }
  return worst;
}

function formatDelta(cat: keyof typeof CATEGORY_LABELS, delta: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  if (PERCENTAGE_CATEGORIES.has(cat)) return `${sign}${Math.abs(delta * 100).toFixed(1)}%`;
  const magnitude = Math.abs(delta);
  return `${sign}${magnitude >= 100 ? magnitude.toLocaleString(undefined, { maximumFractionDigits: 0 }) : magnitude.toFixed(1)}`;
}

function isHelpful(item: CategoryImpact): boolean {
  return INVERTED_CATEGORIES.has(item.cat) ? item.delta < 0 : item.delta > 0;
}

/**
 * "Team fit" panel for Player Lab: what one player does to the viewer's real
 * roster. Reuses the Team Builder's category-impact math plus a projected
 * standings recompute, and suggests the weakest rostered player as the
 * swap-out candidate in swap mode.
 */
export function TeamImpactPanel({
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
  const [mode, setMode] = useState<Mode>('add');

  const teamId = profile?.team_id ?? undefined;

  const playersByTeam = useMemo(() => {
    const map = new Map<string, PlayerWithStats[]>();
    for (const row of rosterRows ?? []) {
      if (!row.player) continue;
      const list = map.get(row.entry.team_id) ?? [];
      list.push(row.player);
      map.set(row.entry.team_id, list);
    }
    return map;
  }, [rosterRows]);

  const myPlayers = useMemo(
    () => playersByTeam.get(teamId ?? '') ?? [],
    [playersByTeam, teamId],
  );
  const valueByPlayer = useMemo(() => leagueValueScores(pool, 'totals'), [pool]);

  const analysis = useMemo<Analysis | null>(() => {
    if (!candidate || !teamId || !teams?.length || myPlayers.length === 0) return null;
    const leagueSize = settings?.league_size ?? teams.length;
    const base = baseline(pool, leagueSize, LEAGUE_CATEGORIES);
    const dropped = mode === 'swap' && myPlayers.length > 1 ? weakestPlayer(myPlayers, valueByPlayer) : null;
    const context = dropped ? myPlayers.filter((player) => player.id !== dropped.id) : myPlayers;
    return {
      dropped,
      impacts: impact(context, candidate, base, LEAGUE_CATEGORIES),
      swing: standingsSwing(teams, playersByTeam, teamId, candidate, dropped?.id),
    };
  }, [candidate, teamId, teams, myPlayers, settings?.league_size, pool, mode, valueByPlayer, playersByTeam]);

  if (!candidate) return null;

  const loading = rostersLoading || teams == null;
  const claimed = !!teamId;
  const showAnalysis = claimed && !loading && myPlayers.length > 0 && !!analysis;

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="size-4 shrink-0" />
          <h2 className="font-bold">Team fit</h2>
          {showAnalysis && (
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {mode === 'add'
                ? `adding ${candidate.name}`
                : `swapping out ${analysis!.dropped?.name ?? '—'} for ${candidate.name}`}
            </span>
          )}
        </div>
        {claimed && !loading && myPlayers.length > 1 && (
          <div className="flex overflow-hidden rounded-full border bg-background">
            {(['add', 'swap'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.98] ${
                  mode === value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {value === 'add' ? 'Add' : 'Swap weakest'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        {!claimed ? (
          <p className="text-sm text-muted-foreground">
            Claim your team in{' '}
            <Link to="/profile" className="font-semibold text-primary hover:underline">your profile</Link>{' '}
            to see how {candidate.name} moves your roster.
          </p>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-6 w-full" />)}
          </div>
        ) : myPlayers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No roster yet — projected impact unlocks once draft picks land. Building a hypothetical roster?{' '}
            <Link to="/team-builder" className="font-semibold text-primary hover:underline">Try the Team Builder</Link>.
          </p>
        ) : !analysis ? (
          <p className="text-sm text-muted-foreground">Not enough data to project impact yet.</p>
        ) : (
          <TeamFitAnalysis analysis={analysis} leagueSize={settings?.league_size ?? teams!.length} />
        )}
      </div>
    </section>
  );
}

function TeamFitAnalysis({ analysis, leagueSize }: { analysis: Analysis; leagueSize: number }) {
  const { swing, impacts } = analysis;
  const gain = swing ? swing.after.totalPoints - swing.before.totalPoints : 0;
  const RankIcon = gain > 0 ? TrendingUp : gain < 0 ? TrendingDown : Minus;
  const rankTone = gain > 0 ? 'text-emerald-600 dark:text-emerald-400' : gain < 0 ? 'text-red-500' : 'text-muted-foreground';

  // Counting and percentage cats live on different scales; bar each against
  // its own group max so FG% moves stay visible next to PTS.
  const countingMax = Math.max(...impacts.filter((item) => !PERCENTAGE_CATEGORIES.has(item.cat)).map((item) => Math.abs(item.delta)), 1);
  const pctMax = Math.max(...impacts.filter((item) => PERCENTAGE_CATEGORIES.has(item.cat)).map((item) => Math.abs(item.delta)), 0.001);
  const sorted = [...impacts].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const pointMoves = swing
    ? LEAGUE_CATEGORIES.filter((cat) => swing.pointsByCategory[cat] !== 0)
    : [];

  return (
    <div className="space-y-4">
      {swing && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/20 p-3">
          <RankIcon className={`size-6 shrink-0 ${rankTone}`} aria-hidden />
          <div>
            <div className={`text-2xl font-black tabular-nums ${rankTone}`}>
              {gain >= 0 ? '+' : '−'}{Math.abs(gain)}
              <span className="ml-1.5 text-sm font-bold text-muted-foreground">standings pts</span>
            </div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              projected rank #{swing.before.rank} → #{swing.after.rank}
            </div>
          </div>
          {pointMoves.length > 0 && (
            <div className="ml-auto flex max-w-full flex-wrap gap-1.5">
              {pointMoves.map((cat) => {
                const move = swing.pointsByCategory[cat];
                return (
                  <Badge
                    key={cat}
                    variant="outline"
                    className={move > 0 ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'border-red-500/40 text-red-500'}
                  >
                    {move > 0 ? '+' : '−'}{Math.abs(move)} {CATEGORY_LABELS[cat]}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        {sorted.map((item) => (
          <ImpactRow key={item.cat} item={item} scale={PERCENTAGE_CATEGORIES.has(item.cat) ? pctMax : countingMax} />
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Category deltas vs. an even-draft baseline across {leagueSize} teams (season totals; percentages are
        attempt-weighted). "flips" marks categories that cross from losing to winning — or the reverse.
      </p>
    </div>
  );
}

function ImpactRow({ item, scale }: { item: CategoryImpact; scale: number }) {
  const helpful = isHelpful(item);
  const width = scale > 0 ? Math.min(50, (Math.abs(item.delta) / scale) * 50) : 0;
  const barColour = item.delta === 0 ? 'bg-muted-foreground/30' : helpful ? 'bg-emerald-500' : 'bg-red-500';
  const textTone = item.delta === 0
    ? 'text-muted-foreground'
    : helpful
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-500';

  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_4.5rem] items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{CATEGORY_LABELS[item.cat]}</span>
      <div className="relative h-2.5 rounded-full bg-muted/60">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
        <div
          className={`absolute inset-y-0 rounded-full ${barColour}`}
          style={item.delta >= 0 ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }}
        />
      </div>
      <div className="flex items-center justify-end gap-1.5">
        {item.flipsVsBaseline && item.delta !== 0 && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-primary">flips</span>
        )}
        <span className={`text-xs font-bold tabular-nums ${textTone}`}>{formatDelta(item.cat, item.delta)}</span>
      </div>
    </div>
  );
}
