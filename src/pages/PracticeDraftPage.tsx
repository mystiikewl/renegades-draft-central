import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Bot, Dices, RotateCcw, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useActiveSeason, useDraftSettings, usePracticeDraftPool, useTeams } from '@/api/queries';
import type { DraftPick, PlayerWithStats } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { DraftBoard } from '@/pages/DraftPage';
import { getTeamColour } from '@/lib/teamColours';
import { fmtStat, statColumnValue } from '@/lib/stats';
import {
  CPU_STRATEGIES,
  assignCpuStrategies,
  availablePracticePlayers,
  buildPracticeBoard,
  buildPracticeOrder,
  chooseCpuPracticePlayer,
  makePracticePick,
  practiceScores,
  skipPracticePick,
  type CpuDraftStrategy,
} from '@/lib/practiceDraft';

export function PracticeDraftPage() {
  const { profile } = useAuth();
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  const { data: settings, isLoading: settingsLoading } = useDraftSettings(seasonId);
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: players, isLoading: playersLoading } = usePracticeDraftPool(seasonId);

  const [selectedSlot, setSelectedSlot] = useState(1);
  const [sessionPicks, setSessionPicks] = useState<DraftPick[] | null>(null);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [cpuStrategies, setCpuStrategies] = useState<Record<string, CpuDraftStrategy>>({});
  const [search, setSearch] = useState('');
  const [cpuThinking, setCpuThinking] = useState(false);

  const eligibleTeamIds = useMemo(() => {
    if (!profile?.team_id) return [];
    const ids = [profile.team_id];
    for (const team of teams ?? []) if (!ids.includes(team.id)) ids.push(team.id);
    for (const id of settings?.draft_order ?? []) if (!ids.includes(id)) ids.push(id);
    return ids.slice(0, Math.max(1, settings?.league_size ?? ids.length));
  }, [profile?.team_id, settings?.draft_order, settings?.league_size, teams]);

  useEffect(() => {
    if (selectedSlot > eligibleTeamIds.length && eligibleTeamIds.length > 0) setSelectedSlot(eligibleTeamIds.length);
  }, [eligibleTeamIds.length, selectedSlot]);

  const picks = sessionPicks ?? [];
  const nextPick = useMemo(() => picks.find((pick) => !pick.is_used) ?? null, [picks]);
  const available = useMemo(() => availablePracticePlayers(players ?? [], picks), [players, picks]);
  const scores = useMemo(() => practiceScores(players ?? []), [players]);
  const rankedAvailable = useMemo(
    () => [...available].sort((a, b) => {
      const diff = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
      return diff || a.name.localeCompare(b.name);
    }),
    [available, scores],
  );

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rankedAvailable;
    return rankedAvailable.filter((player) =>
      player.name.toLowerCase().includes(q) ||
      (player.nba_team ?? '').toLowerCase().includes(q) ||
      (player.position ?? '').toLowerCase().includes(q),
    );
  }, [rankedAvailable, search]);

  const isMyTurn = !!nextPick && !!profile?.team_id && nextPick.team_id === profile.team_id;
  const complete = picks.length > 0 && picks.every((pick) => pick.is_used);
  const myPicks = picks.filter((pick) => pick.team_id === profile?.team_id && pick.is_used && !pick.is_skipped);
  const teamName = (id: string) => teams?.find((team) => team.id === id)?.name ?? (id === profile?.team_id ? 'Your Team' : 'CPU Team');
  const strategyLabel = (teamId: string) =>
    CPU_STRATEGIES.find((item) => item.key === cpuStrategies[teamId])?.label ?? 'Balanced';

  const startDraft = () => {
    if (!settings || !profile?.team_id || eligibleTeamIds.length < 2) return;
    const order = buildPracticeOrder(eligibleTeamIds, profile.team_id, selectedSlot);
    setDraftOrder(order);
    setCpuStrategies(assignCpuStrategies(order, profile.team_id));
    setSessionPicks(buildPracticeBoard(settings, [], order));
    setSearch('');
  };

  const returnToSetup = () => {
    setSessionPicks(null);
    setDraftOrder([]);
    setCpuStrategies({});
    setSearch('');
    setCpuThinking(false);
  };

  useEffect(() => {
    if (!sessionPicks || !nextPick || isMyTurn || !profile?.team_id || playersLoading) {
      setCpuThinking(false);
      return;
    }

    setCpuThinking(true);
    const timer = window.setTimeout(() => {
      setSessionPicks((current) => {
        if (!current) return current;
        const currentNext = current.find((pick) => !pick.is_used);
        if (!currentNext || currentNext.team_id === profile.team_id) return current;
        const remaining = availablePracticePlayers(players ?? [], current);
        const rosterIds = current
          .filter((pick) => pick.team_id === currentNext.team_id && pick.player_id)
          .map((pick) => pick.player_id as string);
        const cpuPick = chooseCpuPracticePlayer(
          remaining,
          players ?? [],
          rosterIds,
          cpuStrategies[currentNext.team_id] ?? 'balanced',
        );
        return cpuPick
          ? makePracticePick(current, currentNext.id, cpuPick)
          : skipPracticePick(current, currentNext.id);
      });
      setCpuThinking(false);
    }, 340);

    return () => window.clearTimeout(timer);
  }, [cpuStrategies, isMyTurn, nextPick, players, playersLoading, profile?.team_id, sessionPicks]);

  const makeMyPick = (player: PlayerWithStats) => {
    if (!nextPick || !isMyTurn) return;
    setSessionPicks((current) => current ? makePracticePick(current, nextPick.id, player) : current);
  };

  if (!season) {
    return <div className="p-8 text-center text-muted-foreground">No active season is available for practice.</div>;
  }

  if (settingsLoading || teamsLoading || playersLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!profile?.team_id) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <Bot className="mx-auto size-8 text-muted-foreground" />
            <h1 className="text-xl font-bold">Practice Draft</h1>
            <p className="text-sm text-muted-foreground">Claim a league team before starting a draft simulation.</p>
            <Button asChild variant="outline"><Link to="/">Back to Draft Central</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!settings || eligibleTeamIds.length < 2) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <Bot className="mx-auto size-8 text-muted-foreground" />
            <h1 className="text-xl font-bold">Practice Draft</h1>
            <p className="text-sm text-muted-foreground">The league needs at least two configured teams before a simulation can begin.</p>
            <Button asChild variant="outline"><Link to="/">Back to Draft Central</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!sessionPicks) {
    return (
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 md:py-8">
        <header>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Practice Draft</h1>
            <Badge variant="secondary" className="gap-1"><Bot className="size-3" /> Simulation</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Choose where you want to draft. Every CPU manager is shuffled around you for a fresh room.</p>
        </header>

        <Card className="overflow-hidden">
          <CardContent className="space-y-6 p-5 sm:p-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Step 1 · Pick your seat</div>
              <h2 className="mt-1 text-lg font-bold">Draft position</h2>
              <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-10">
                {eligibleTeamIds.map((_, index) => {
                  const slot = index + 1;
                  const active = selectedSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`min-h-12 rounded-xl border text-sm font-black tabular-nums transition-colors ${active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/20 p-4">
                <Dices className="size-5 text-muted-foreground" />
                <h3 className="mt-3 text-sm font-bold">Randomised room</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Your team stays at pick {selectedSlot}. The other {eligibleTeamIds.length - 1} managers are randomised every time you start.</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <Sparkles className="size-5 text-muted-foreground" />
                <h3 className="mt-3 text-sm font-bold">Different CPU minds</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Bots can draft balanced, chase guards or bigs, hunt stocks, or deliberately punt FG%, FT% or assists.</p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span><strong className="text-foreground">Private practice only.</strong> Nothing from this draft is written to league data.</span>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild variant="ghost"><Link to="/"><X className="mr-1.5 size-4" /> Cancel</Link></Button>
              <Button onClick={startDraft}><Dices className="mr-1.5 size-4" /> Start from pick {selectedSlot}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-0 py-3 sm:px-4 md:space-y-5 md:p-6">
      <header className="space-y-3 px-4 sm:px-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Practice Draft</h1>
              <Badge variant="secondary" className="gap-1"><Bot className="size-3" /> Pick {selectedSlot}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {season.label} · {settings.draft_type} · {eligibleTeamIds.length} teams · {Math.max(0, settings.roster_size - settings.keeper_limit)} draft rounds
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={returnToSetup}><RotateCcw className="mr-1.5 size-4" /> New simulation</Button>
            <Button asChild variant="ghost" size="sm"><Link to="/"><X className="mr-1.5 size-4" /> Cancel</Link></Button>
          </div>
        </div>
      </header>

      {!complete && nextPick && (
        <section className={`border-y bg-card px-4 py-4 sm:rounded-2xl sm:border sm:px-5 ${isMyTurn ? 'sm:border-primary/60' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${isMyTurn ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <span className="font-mono text-sm font-bold">#{nextPick.pick_number}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {isMyTurn ? 'You are on the clock' : cpuThinking ? `${strategyLabel(nextPick.team_id)} CPU thinking…` : 'CPU on the clock'}
              </div>
              <div className="mt-1 line-clamp-1 text-lg font-bold">{teamName(nextPick.team_id)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Round {nextPick.round} · {available.length} players available</div>
            </div>
            {isMyTurn && <Badge className="shrink-0">MAKE A PICK</Badge>}
          </div>
        </section>
      )}

      {complete && (
        <Card className="mx-4 border-primary/30 bg-primary/[0.04] sm:mx-0">
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold">Simulation complete</h2>
              <p className="mt-1 text-sm text-muted-foreground">You drafted {myPicks.length} players from slot {selectedSlot}.</p>
            </div>
            <Button onClick={returnToSetup}><RotateCcw className="mr-2 size-4" /> Run another</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-4">
          <DraftBoard picks={picks} picksLoading={false} teamName={teamName} teamColor={getTeamColour} />

          <section className="overflow-hidden border-y bg-card sm:rounded-xl sm:border">
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold">Practice Player Pool</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">The Draft button stays visible on every player when you are on the clock.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search players" className="pl-9" aria-label="Search practice players" />
              </div>
            </div>

            {filteredPlayers.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No available players found.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredPlayers.map((player) => (
                  <div key={player.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_repeat(5,3rem)_auto]">
                    <div className="flex min-w-0 items-center gap-3">
                      <PlayerHeadshot espnId={player.espn_id} name={player.name} size={40} variant="bare" />
                      <div className="min-w-0">
                        <div className="line-clamp-1 font-semibold">{player.name}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{player.nba_team ?? 'FA'} · {player.position ?? '—'}</div>
                        <div className="mt-1 flex gap-3 text-[10px] tabular-nums text-muted-foreground sm:hidden">
                          <span>{fmtStat('pts', 'averages', statColumnValue(player, 'pts', 'averages'))} PTS</span>
                          <span>{fmtStat('reb', 'averages', statColumnValue(player, 'reb', 'averages'))} REB</span>
                          <span>{fmtStat('ast', 'averages', statColumnValue(player, 'ast', 'averages'))} AST</span>
                        </div>
                      </div>
                    </div>
                    {(['pts', 'reb', 'ast', 'stl', 'blk'] as const).map((key) => (
                      <div key={key} className="hidden text-right sm:block">
                        <div className="text-[9px] font-bold uppercase text-muted-foreground">{key}</div>
                        <div className="text-xs font-semibold tabular-nums">{fmtStat(key, 'averages', statColumnValue(player, key, 'averages'))}</div>
                      </div>
                    ))}
                    <Button size="sm" disabled={!isMyTurn || complete} onClick={() => makeMyPick(player)} aria-label={`Draft ${player.name}`}>
                      {isMyTurn ? 'Draft' : 'Waiting'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="mx-4 h-fit space-y-3 sm:mx-0 lg:sticky lg:top-4">
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="font-bold">Your Practice Team</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{myPicks.length}/{picks.filter((pick) => pick.team_id === profile.team_id).length} picks</p>
            </div>
            {myPicks.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Your selections will appear here.</p>
            ) : (
              <div className="divide-y">
                {myPicks.map((pick) => (
                  <div key={pick.id} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="w-8 shrink-0 font-mono text-[10px] text-muted-foreground">#{pick.pick_number}</span>
                    <PlayerHeadshot espnId={pick.players?.espn_id ?? null} name={pick.players?.name ?? ''} size={30} variant="bare" />
                    <div className="min-w-0">
                      <div className="line-clamp-1 text-sm font-semibold">{pick.players?.name ?? '—'}</div>
                      <div className="text-[10px] text-muted-foreground">{pick.players?.nba_team ?? 'FA'} · {pick.players?.position ?? '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-bold">Draft Room</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">CPU strategies are assigned fresh each simulation.</p>
            </div>
            <div className="divide-y">
              {draftOrder.map((teamId, index) => (
                <div key={teamId} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div className="min-w-0"><span className="mr-2 font-mono text-muted-foreground">{index + 1}</span><span className="font-semibold">{teamName(teamId)}</span></div>
                  <Badge variant={teamId === profile.team_id ? 'default' : 'outline'} className="shrink-0 text-[9px]">
                    {teamId === profile.team_id ? 'YOU' : strategyLabel(teamId)}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
