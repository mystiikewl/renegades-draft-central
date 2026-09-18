import { useEffect, useMemo, useState } from 'react';
import { Bot, Search, SlidersHorizontal } from 'lucide-react';
import { usePlayerPool, usePracticeDraftPool, useActiveSeason, useDraftPicks, useDraftSettings, useTeams } from '@/api/queries';
import { useFavouriteIds } from '@/api/favourites';
import { useMakePickForSlot } from '@/api/draftTurnActions';
import { useDraftRealtime } from '@/api/realtime';
import { useCanPickNow } from '@/hooks/useCanPickNow';
import { useAuth } from '@/auth/AuthContext';
import { useOfflineQueue } from '@/api/offlineQueue';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { isRookie, STAT_COLUMNS, statColumnValue, fmtStat, type StatColumnKey } from '@/lib/stats';
import { POSITION_FILTERS, matchesPosition, matchesSearch, rookieDraftOrder } from '@/lib/playerFilters';
import { nextPick as pickOnClock, teamById } from '@/lib/draftState';
import { FilterChip } from '@/components/ui/filter-chip';
import { leagueValueScores } from '@/lib/projections';
import { availablePracticePlayers } from '@/lib/practiceDraft';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { PlayerStatsDialog } from '@/components/player/PlayerStatsDialog';
import { WatchlistStar } from '@/components/player/WatchlistStar';
import { RealtimeBadge } from '@/components/draft/RealtimeBadge';
import { usePracticeDraftSession } from '@/stores/practiceDraftSession';
import type { PlayerWithStats } from '@/api/types';

type SortKey = 'value' | 'rookie' | StatColumnKey;
type Basis = 'averages' | 'totals';
type PoolMode = 'practice' | 'live';

export function PlayerPoolPage() {
  const { profile } = useAuth();
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  useDraftRealtime(seasonId);

  const { data: livePlayers, isLoading: liveLoading } = usePlayerPool(seasonId);
  const { data: picks } = useDraftPicks(seasonId);
  const { data: settings } = useDraftSettings(seasonId);
  const { data: teams } = useTeams();
  const canPick = useCanPickNow(seasonId);
  const makePick = useMakePickForSlot(seasonId ?? '');
  const queued = useOfflineQueue((s) => s.queue);
  const queuedIds = useMemo(() => new Set(queued.map((q) => q.playerId)), [queued]);

  const practiceActive = usePracticeDraftSession((state) => state.active);
  const practiceSeasonId = usePracticeDraftSession((state) => state.seasonId);
  const practiceHumanTeamId = usePracticeDraftSession((state) => state.humanTeamId);
  const practicePicks = usePracticeDraftSession((state) => state.picks);
  const makeHumanPick = usePracticeDraftSession((state) => state.makeHumanPick);
  const { data: practiceUniverse, isLoading: practiceLoading } = usePracticeDraftPool(
    practiceActive ? practiceSeasonId ?? undefined : undefined,
  );

  const [poolMode, setPoolMode] = useState<PoolMode>(practiceActive ? 'practice' : 'live');
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<(typeof POSITION_FILTERS)[number]>('All');
  const [rookiesOnly, setRookiesOnly] = useState(false);
  const [watchedOnly, setWatchedOnly] = useState(false);
  const favouriteIds = useFavouriteIds(seasonId);
  const [basis, setBasis] = useState<Basis>('totals');
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [selected, setSelected] = useState<PlayerWithStats | null>(null);

  useEffect(() => {
    if (practiceActive) setPoolMode('practice');
    else setPoolMode('live');
  }, [practiceActive]);

  const practicePlayers = useMemo(
    () => availablePracticePlayers(practiceUniverse ?? [], practicePicks),
    [practicePicks, practiceUniverse],
  );
  const inPracticeMode = practiceActive && poolMode === 'practice';
  const players = useMemo(
    () => inPracticeMode ? practicePlayers : (livePlayers ?? []),
    [inPracticeMode, livePlayers, practicePlayers],
  );
  const isLoading = inPracticeMode ? practiceLoading : liveLoading;
  const valueScores = useMemo(() => leagueValueScores(players, basis), [players, basis]);

  const liveNextPick = useMemo(() => (picks ? pickOnClock(picks) : null), [picks]);
  const practiceNextPick = useMemo(() => pickOnClock(practicePicks), [practicePicks]);
  const nextPick = inPracticeMode ? practiceNextPick : liveNextPick;
  const teamsIndex = useMemo(() => teamById(teams), [teams]);
  const teamName = (id: string) => teamsIndex.get(id)?.name ?? (id === practiceHumanTeamId ? 'Your Team' : '—');
  const isMyTurn = inPracticeMode
    ? !!practiceNextPick && practiceNextPick.team_id === practiceHumanTeamId
    : !!liveNextPick && !!profile?.team_id && liveNextPick.team_id === profile.team_id;
  const paused = !inPracticeMode && settings?.status === 'paused';
  const practiceComplete = inPracticeMode && practicePicks.length > 0 && practicePicks.every((pick) => pick.is_used);

  const filtered = useMemo(() => {
    let pool = players.filter((p) => matchesPosition(p, position));
    if (rookiesOnly) pool = pool.filter(isRookie);
    if (watchedOnly) pool = pool.filter((p) => favouriteIds.has(p.id));
    pool = pool.filter((p) => matchesSearch(p, search));
    // ponytail: unknown season year parses to NaN → Infinity → name order.
    const draftYear = Number(season?.label.slice(0, 4));
    return [...pool].sort((a, b) => {
      const difference = sortKey === 'rookie'
        ? rookieDraftOrder(a.draft_display, draftYear) - rookieDraftOrder(b.draft_display, draftYear)
        : sortKey === 'value'
        ? (valueScores.get(b.id) ?? 0) - (valueScores.get(a.id) ?? 0)
        : statColumnValue(b, sortKey, basis) - statColumnValue(a, sortKey, basis);
      return difference || a.name.localeCompare(b.name);
    });
  }, [players, search, position, rookiesOnly, watchedOnly, favouriteIds, sortKey, basis, valueScores, season?.label]);

  const activeSortLabel = sortKey === 'value'
    ? 'Value'
    : STAT_COLUMNS.find((c) => c.key === sortKey)?.label ?? sortKey;
  const projectedCount = players.filter((player) => player.stats_source === 'espn').length;
  const fallbackCount = players.filter((player) => player.stats_uses_historical_fallback).length;
  const projectionUpdatedAt = players.reduce<string | null>((latest, player) => {
    if (!player.stats_updated_at) return latest;
    return !latest || player.stats_updated_at > latest ? player.stats_updated_at : latest;
  }, null);
  const canSelectPractice = inPracticeMode && isMyTurn && !practiceComplete;
  const canSelectLive = !inPracticeMode && canPick && !!liveNextPick && !!selected && !queuedIds.has(selected.id);

  const submitSelected = () => {
    if (!selected || !nextPick) return;
    if (inPracticeMode) {
      if (!canSelectPractice) return;
      makeHumanPick(nextPick.id, selected);
      setSelected(null);
      return;
    }
    makePick.mutate(
      {
        pickId: nextPick.id,
        pickNumber: nextPick.pick_number,
        playerId: selected.id,
        playerName: selected.name,
      },
      { onSettled: () => setSelected(null) },
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-3 px-0 py-3 sm:px-4 md:space-y-4 md:p-6">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {inPracticeMode ? 'Practice Draft Pool' : 'Player Pool'}
            </h1>
            {inPracticeMode && <Badge className="gap-1"><Bot className="size-3" /> Practice</Badge>}
          </div>
          {inPracticeMode && (
            <p className="mt-0.5 text-xs text-muted-foreground">This pool follows your active simulation and removes every player already drafted there.</p>
          )}
        </div>
        {!inPracticeMode && <RealtimeBadge />}
      </div>

      {practiceActive && (
        <div className="mx-4 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.05] p-2 sm:mx-0">
          <div className="min-w-0 px-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Practice session active</div>
            <div className="line-clamp-1 text-xs font-medium">
              {practiceComplete
                ? 'Simulation complete'
                : practiceNextPick
                  ? `${isMyTurn && inPracticeMode ? 'Your pick' : 'Current pick'} · #${practiceNextPick.pick_number}`
                  : 'Simulation in progress'}
            </div>
          </div>
          <div className="flex shrink-0 rounded-lg border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setPoolMode('practice')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${inPracticeMode ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
            >
              Practice
            </button>
            <button
              type="button"
              onClick={() => setPoolMode('live')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${!inPracticeMode ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
            >
              Live
            </button>
          </div>
        </div>
      )}

      {nextPick && (inPracticeMode || settings?.status === 'running' || paused) && (
        <Card className={`mx-4 overflow-hidden sm:mx-0 ${isMyTurn ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`}>
          <CardContent className="flex items-center gap-3 py-3">
            <Badge variant="outline" className="shrink-0 text-xs">#{nextPick.pick_number}</Badge>
            <span className="line-clamp-1 min-w-0 flex-1 text-sm font-semibold">{teamName(nextPick.team_id)}</span>
            <span className={`shrink-0 text-xs font-bold uppercase tracking-wide ${isMyTurn ? 'text-primary' : 'text-muted-foreground'}`}>
              {paused ? 'Paused' : isMyTurn ? 'Your pick' : 'On clock'}
            </span>
          </CardContent>
        </Card>
      )}

      {paused && (
        <p className="mx-4 rounded-md border bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground sm:mx-0">
          The live draft is paused. You can keep scouting, but player selection is locked until the commissioner resumes.
        </p>
      )}

      {!inPracticeMode && queued.length > 0 && (
        <p className="mx-4 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground sm:mx-0">
          Offline — {queued.length} exact-slot pick{queued.length > 1 ? 's' : ''} queued. Stale queued choices are rejected instead of moving to a later pick.
        </p>
      )}

      <div className="border-y bg-card/70 py-3 sm:rounded-xl sm:border">
        <div className="flex items-center gap-2 px-4 sm:px-3">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search players or teams"
              aria-label="Search player pool"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-full bg-muted/60 pl-9"
            />
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground" aria-hidden="true">
            <SlidersHorizontal className="size-4" />
          </div>
        </div>

        <div className="mt-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-3">
          <div className="flex w-max items-center gap-2">
            {POSITION_FILTERS.map((pos) => (
              <FilterChip key={pos} active={position === pos} onClick={() => setPosition(pos)}>{pos}</FilterChip>
            ))}
            <FilterChip active={rookiesOnly} onClick={() => { setRookiesOnly(!rookiesOnly); setSortKey(rookiesOnly ? 'value' : 'rookie'); }}>Rookies</FilterChip>
            <FilterChip active={watchedOnly} onClick={() => setWatchedOnly(!watchedOnly)}>★ Watchlist</FilterChip>
          </div>
        </div>
      </div>

      <section className="overflow-hidden border-y bg-card sm:rounded-xl sm:border">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide">Available</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{filtered.length} players{sortKey !== 'rookie' && ` · sorted by ${activeSortLabel}`}</div>
            <div className="mt-1 text-[10px] font-medium text-muted-foreground">
              {projectedCount > 0
                ? `ESPN projections${projectionUpdatedAt ? ` · updated ${new Date(projectionUpdatedAt).toLocaleDateString()}` : ''}${fallbackCount > 0 ? ` · ${fallbackCount} historical fallback${fallbackCount === 1 ? '' : 's'}` : ''}`
                : 'Historical stats · ESPN projections not imported yet'}
            </div>
          </div>
          <div className="flex overflow-hidden rounded-full border bg-background">
            {(['averages', 'totals'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBasis(b)}
                aria-pressed={basis === b}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.98] ${basis === b ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {b === 'averages' ? 'AVG' : 'TOTAL'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-1 p-3">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No players found.</p>
        ) : (
          <div className="max-h-[calc(100dvh-17rem)] overflow-auto sm:max-h-[68vh]">
            <table className="w-full min-w-[30rem] border-collapse text-sm sm:min-w-[64rem]">
              <thead className="sticky top-0 z-30 bg-card shadow-[0_1px_0_0_var(--border)]">
                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="sticky left-0 z-40 w-[13rem] bg-card px-3 py-2 text-left font-bold sm:w-[17rem] sm:px-4">Players</th>
                  <th className="min-w-[4rem] px-2 py-2 text-right font-bold">
                    <button onClick={() => setSortKey('value')} className={`min-h-10 min-w-10 rounded-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sortKey === 'value' ? 'text-primary' : ''}`}>VAL</button>
                  </th>
                  {STAT_COLUMNS.map((c) => (
                    <th key={c.key} className={`min-w-[3.4rem] px-2 py-2 text-right font-bold ${c.key === 'pts' ? '' : 'hidden md:table-cell'}`}>
                      <button onClick={() => setSortKey(c.key)} className={`min-h-10 min-w-10 rounded-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sortKey === c.key ? 'text-primary' : ''}`}>{c.label}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, index) => (
                  <tr key={p.id} onClick={() => setSelected(p)} className={`cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50 active:bg-muted ${index % 2 ? 'bg-muted/[0.18]' : ''}`}>
                    <td className={`sticky left-0 z-20 px-3 py-2 shadow-[6px_0_12px_-12px_hsl(var(--foreground))] sm:px-4 ${index % 2 ? 'bg-muted/[0.18]' : 'bg-card'} hover:bg-muted/50`}>
                      <div className="flex min-w-0 items-center gap-3">
                        <PlayerHeadshot espnId={p.espn_id} name={p.name} size={38} variant="bare" />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="line-clamp-1 font-semibold leading-tight">{p.name}</span>
                            {isRookie(p) && <Badge variant="outline" className="shrink-0 border-primary/40 px-1 py-0 text-[9px] text-primary">R</Badge>}
                            {p.stats_source === 'historical' && (
                              <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9px] text-muted-foreground" title="ESPN projection unavailable; using historical stats">HIST</Badge>
                            )}
                          </div>
                          <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{p.nba_team ?? 'FA'} · {p.position ?? '—'}</div>
                        </div>
                        <WatchlistStar playerId={p.id} playerName={p.name} />
                      </div>
                    </td>
                    <td className={`whitespace-nowrap px-2 py-3 text-right text-xs font-bold tabular-nums ${sortKey === 'value' ? 'text-primary' : 'text-foreground'}`}>
                      {(valueScores.get(p.id) ?? 0).toFixed(2)}
                    </td>
                    {STAT_COLUMNS.map((c) => (
                      <td key={c.key} className={`whitespace-nowrap px-2 py-3 text-right text-xs tabular-nums ${c.key === 'pts' ? '' : 'hidden md:table-cell'} ${sortKey === c.key ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                        {fmtStat(c.key, basis, statColumnValue(p, c.key, basis))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PlayerStatsDialog
        player={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        basis={basis}
        canPick={inPracticeMode ? canSelectPractice && !!selected : canSelectLive}
        picking={inPracticeMode ? false : makePick.isPending}
        pickNumber={nextPick?.pick_number}
        onPick={submitSelected}
      />
    </div>
  );
}
