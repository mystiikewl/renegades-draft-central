import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  BarChart3,
  Bot,
  BrainCircuit,
  Gauge,
  Layers3,
  Radar,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  useActiveSeason,
  useDraftSettings,
  usePlayerPool,
  usePracticeDraftPool,
  useRosters,
} from '@/api/queries';
import type { PlayerWithStats, RosterEntry } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { rememberFocusedPlayer } from '@/lib/analysisNavigation';
import {
  buildDraftIntelligence,
  CATEGORY_LABELS,
  STRATEGY_PRESETS,
  type DraftRecommendation,
  type StrategyKey,
} from '@/lib/draftIntelligence';
import { availablePracticePlayers } from '@/lib/practiceDraft';
import { PERCENTAGE_CATEGORIES, type Category } from '@/lib/projections';
import { pickStatsSeason, type StatsSeasonRow } from '@/lib/stats';
import { usePracticeDraftSession } from '@/stores/practiceDraftSession';

function rosterPlayer(entry: RosterEntry, seasonId: string): PlayerWithStats | null {
  if (!entry.player_id || !entry.players) return null;
  const best = pickStatsSeason(
    (entry.players.player_seasons ?? []) as StatsSeasonRow[],
    seasonId,
  );
  if (!best) return null;
  return {
    id: entry.player_id,
    name: entry.players.name,
    position: entry.players.position,
    nba_team: entry.players.nba_team ?? null,
    espn_id: entry.players.espn_id ?? null,
    image_url: null,
    created_at: '',
    player_seasons: [best],
  };
}

function uniquePlayers(groups: PlayerWithStats[][]): PlayerWithStats[] {
  const byId = new Map<string, PlayerWithStats>();
  for (const player of groups.flat()) byId.set(player.id, player);
  return [...byId.values()];
}

function formatCategory(cat: Category, value: number): string {
  return PERCENTAGE_CATEGORIES.has(cat) ? value.toFixed(3) : Math.round(value).toLocaleString();
}

export function AnalysisPage() {
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  const { profile } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useDraftSettings(seasonId);
  const { data: livePool = [], isLoading: livePoolLoading } = usePlayerPool(seasonId);
  const { data: practicePool = [], isLoading: practicePoolLoading } = usePracticeDraftPool(seasonId);
  const { data: rosters = [], isLoading: rostersLoading } = useRosters(seasonId);
  const practiceActive = usePracticeDraftSession((state) => state.active);
  const practiceSeasonId = usePracticeDraftSession((state) => state.seasonId);
  const practiceHumanTeamId = usePracticeDraftSession((state) => state.humanTeamId);
  const practicePicks = usePracticeDraftSession((state) => state.picks);
  const inPracticeContext = practiceActive && practiceSeasonId === seasonId;
  const [strategy, setStrategy] = useState<StrategyKey>('balanced');

  useEffect(() => {
    if (!seasonId) return;
    try {
      const stored = localStorage.getItem(`draft-intelligence:${seasonId}:strategy`) as StrategyKey | null;
      if (stored && STRATEGY_PRESETS.some((preset) => preset.key === stored)) setStrategy(stored);
    } catch {
      setStrategy('balanced');
    }
  }, [seasonId]);

  const rosteredPlayers = useMemo(
    () => seasonId
      ? rosters.map((entry) => ({ entry, player: rosterPlayer(entry, seasonId) }))
      : [],
    [rosters, seasonId],
  );

  const context = useMemo(() => {
    if (!settings || !profile?.team_id) {
      return { available: [] as PlayerWithStats[], roster: [] as PlayerWithStats[], universe: [] as PlayerWithStats[] };
    }

    const allLiveRostered = rosteredPlayers
      .map(({ player }) => player)
      .filter((player): player is PlayerWithStats => !!player);

    if (!inPracticeContext) {
      const mine = rosteredPlayers
        .filter(({ entry }) => entry.team_id === profile.team_id)
        .map(({ player }) => player)
        .filter((player): player is PlayerWithStats => !!player);
      return {
        available: livePool,
        roster: mine,
        universe: uniquePlayers([livePool, allLiveRostered]),
      };
    }

    const poolById = new Map(practicePool.map((player) => [player.id, player]));
    const draftedMine = practicePicks
      .filter((pick) => pick.team_id === practiceHumanTeamId && pick.player_id)
      .map((pick) => poolById.get(pick.player_id!))
      .filter((player): player is PlayerWithStats => !!player);
    const myKeepers = rosteredPlayers
      .filter(({ entry }) => entry.team_id === profile.team_id && entry.acquisition === 'keeper')
      .map(({ player }) => player)
      .filter((player): player is PlayerWithStats => !!player);
    const allKeepers = rosteredPlayers
      .filter(({ entry }) => entry.acquisition === 'keeper')
      .map(({ player }) => player)
      .filter((player): player is PlayerWithStats => !!player);

    return {
      available: availablePracticePlayers(practicePool, practicePicks),
      roster: uniquePlayers([myKeepers, draftedMine]),
      universe: uniquePlayers([practicePool, allKeepers]),
    };
  }, [
    settings,
    profile?.team_id,
    rosteredPlayers,
    inPracticeContext,
    livePool,
    practicePool,
    practicePicks,
    practiceHumanTeamId,
  ]);

  const intelligence = useMemo(
    () => settings
      ? buildDraftIntelligence({
          available: context.available,
          roster: context.roster,
          universe: context.universe,
          leagueSize: settings.league_size,
          rosterSize: settings.roster_size,
          strategy,
        })
      : null,
    [settings, context, strategy],
  );

  const isLoading = settingsLoading || rostersLoading || livePoolLoading || (inPracticeContext && practicePoolLoading);
  const topNeeds = intelligence?.needs.filter((need) => need.status === 'priority' || need.status === 'watch').slice(0, 4) ?? [];
  const topRecommendation = intelligence?.recommendations[0];

  function chooseStrategy(next: StrategyKey) {
    setStrategy(next);
    if (!seasonId) return;
    try {
      localStorage.setItem(`draft-intelligence:${seasonId}:strategy`, next);
    } catch {
      // Continue with in-memory state when storage is unavailable.
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96 w-full" />
      </PageShell>
    );
  }

  if (!settings || !intelligence) {
    return (
      <PageShell>
        <PageHeader title="Draft Intelligence" description="Draft settings are required before projections can be built." />
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-5">
      <PageHeader
        eyebrow="Analysis"
        title="Draft Intelligence"
        description={inPracticeContext
          ? 'Recommendations are following your active practice draft, including keepers and simulated picks.'
          : 'One decision board connecting rankings, roster fit, player profiles and league projections.'}
        actions={
          <Link
            to="/practice-draft"
            className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted sm:text-sm"
          >
            <Bot className="size-4" />
            {inPracticeContext ? 'Return to practice' : 'Run a practice draft'}
          </Link>
        }
      />

      {inPracticeContext && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-primary">Practice context active</div>
            <p className="mt-0.5 text-xs text-muted-foreground">CPU selections are removed from this board as the simulation advances.</p>
          </div>
          <Badge variant="outline">{context.available.length} available</Badge>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Target className="size-4" />
            <h2 className="font-bold">Draft strategy</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Change the lens; roster needs still break ties inside each strategy.</p>
        </div>
        <div className="overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2">
            {STRATEGY_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                aria-pressed={strategy === preset.key}
                onClick={() => chooseStrategy(preset.key)}
                className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98] ${
                  strategy === preset.key
                    ? 'border-foreground bg-foreground text-background'
                    : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {preset.shortLabel}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{intelligence.strategy.label}:</span>{' '}
          {intelligence.strategy.detail}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <OverviewCard
          icon={Gauge}
          label="Roster build"
          value={`${context.roster.length}/${settings.roster_size}`}
          detail={`${Math.round(intelligence.rosterCompletion * 100)}% complete · ${context.available.length} players available`}
        />
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <Target className="size-4" /> Category priorities
          </div>
          <div className="mt-3 flex min-h-12 flex-wrap content-start gap-1.5">
            {topNeeds.length > 0 ? topNeeds.map((need) => (
              <Badge key={need.cat} variant={need.status === 'priority' ? 'default' : 'secondary'}>
                {CATEGORY_LABELS[need.cat]}
              </Badge>
            )) : <span className="text-sm font-semibold">No major category gap yet</span>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Measured against league-average pace for this point in the build.</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <BrainCircuit className="size-4" /> Best next decision
          </div>
          {topRecommendation ? (
            <div className="mt-3 flex items-center gap-3">
              <PlayerHeadshot espnId={topRecommendation.player.espn_id} name={topRecommendation.player.name} size={48} variant="bare" />
              <div className="min-w-0">
                <div className="truncate font-bold">{topRecommendation.player.name}</div>
                <div className="text-xs text-muted-foreground">Score {topRecommendation.decisionScore} · Tier {topRecommendation.tier}</div>
              </div>
            </div>
          ) : <p className="mt-3 text-sm text-muted-foreground">No available players to rank.</p>}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4">
          <div>
            <div className="flex items-center gap-2"><BrainCircuit className="size-4" /><h2 className="font-bold">Recommended next picks</h2></div>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">55% strategy-adjusted value, 35% roster fit and 10% positional scarcity. Tiers open when the score drops materially.</p>
          </div>
          <Badge variant="outline">Top {Math.min(12, intelligence.recommendations.length)}</Badge>
        </div>
        {intelligence.recommendations.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">No players remain in this draft context.</p>
        ) : (
          <div className="grid gap-0 divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            {intelligence.recommendations.slice(0, 12).map((recommendation, index) => (
              <RecommendationRow key={recommendation.player.id} recommendation={recommendation} index={index} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="border-b px-4 py-4">
            <div className="flex items-center gap-2"><BarChart3 className="size-4" /><h2 className="font-bold">Category market</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">Best available specialists for the gaps your current build is actually carrying.</p>
          </div>
          {intelligence.categoryMarkets.length === 0 ? (
            <p className="px-4 py-10 text-sm text-muted-foreground">Add rostered players to generate category-specific targets.</p>
          ) : (
            <div className="divide-y">
              {intelligence.categoryMarkets.map((market) => {
                const need = intelligence.needs.find((item) => item.cat === market.cat);
                return (
                  <div key={market.cat} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold">{CATEGORY_LABELS[market.cat]}</div>
                        {need && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            Current {formatCategory(market.cat, need.current)} · pace target {formatCategory(market.cat, need.target)}
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary">need {market.priority.toFixed(1)}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {market.leaders.map((player, rank) => (
                        <Link
                          key={player.id}
                          to="/player-lab"
                          onClick={() => rememberFocusedPlayer(player.id)}
                          className="flex items-center gap-2 rounded-xl border p-2.5 transition-colors hover:bg-muted/40"
                        >
                          <span className="w-4 text-right font-mono text-[10px] font-bold text-muted-foreground">{rank + 1}</span>
                          <PlayerHeadshot espnId={player.espn_id} name={player.name} size={34} variant="bare" />
                          <span className="min-w-0 truncate text-xs font-semibold">{player.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="border-b px-4 py-4">
            <div className="flex items-center gap-2"><Layers3 className="size-4" /><h2 className="font-bold">Position scarcity</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">Urgency rises when the best option is separated from the fourth player at that position.</p>
          </div>
          <div className="divide-y">
            {intelligence.scarcity.map((row) => (
              <div key={row.position} className="flex items-center gap-3 px-4 py-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted font-black">{row.position}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{row.topPlayer.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{row.available} available · {row.depth} near the top tier</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg font-black">{row.urgency}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">urgency</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <BrainCircuit className="mt-0.5 size-5 shrink-0" />
          <div>
            <h2 className="font-bold">What this projection does — and does not do</h2>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted-foreground">
              It uses the league's 13-category totals, volume-aware shooting impact, your current roster pace, the selected strategy and remaining positional depth. It is a deterministic decision aid, not a forecast of injuries, trades, role changes or future NBA rotations.
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <div className="mt-2 text-3xl font-black tabular-nums">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function RecommendationRow({ recommendation, index }: { recommendation: DraftRecommendation; index: number }) {
  return (
    <article className={`p-4 ${index >= 6 ? 'lg:border-t' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-7 shrink-0 pt-1 text-right font-mono text-sm font-black text-muted-foreground">{recommendation.rank}</div>
        <PlayerHeadshot espnId={recommendation.player.espn_id} name={recommendation.player.name} size={52} variant="bare" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate font-bold">{recommendation.player.name}</h3>
            <Badge variant="outline" className="text-[9px]">T{recommendation.tier}</Badge>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {recommendation.player.nba_team ?? 'FA'} · {recommendation.player.position ?? '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-black tabular-nums">{recommendation.decisionScore}</div>
          <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">board score</div>
        </div>
      </div>

      <div className="ml-10 mt-3 grid grid-cols-3 gap-2 text-center sm:ml-[5.5rem]">
        <Metric label="Value" value={recommendation.overallScore} />
        <Metric label="Fit" value={recommendation.fitScore} />
        <Metric label="Scarcity" value={recommendation.scarcityScore} />
      </div>

      <div className="ml-10 mt-3 flex flex-wrap gap-1.5 sm:ml-[5.5rem]">
        {recommendation.helps.map((cat) => (
          <Badge key={cat} variant="secondary" className="text-[9px]">helps {CATEGORY_LABELS[cat]}</Badge>
        ))}
        {recommendation.risks.map((cat) => (
          <Badge key={cat} variant="outline" className="text-[9px] text-muted-foreground">watch {CATEGORY_LABELS[cat]}</Badge>
        ))}
      </div>

      <div className="ml-10 mt-3 flex gap-2 sm:ml-[5.5rem]">
        <Link
          to="/player-lab"
          onClick={() => rememberFocusedPlayer(recommendation.player.id)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
        >
          <Radar className="size-3.5" /> Player Lab
        </Link>
        <Link
          to="/team-builder"
          onClick={() => rememberFocusedPlayer(recommendation.player.id)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
        >
          <Sparkles className="size-3.5" /> Test fit
        </Link>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-2">
      <div className="font-mono text-xs font-bold tabular-nums">{value > 0 ? '+' : ''}{value.toFixed(2)}</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
