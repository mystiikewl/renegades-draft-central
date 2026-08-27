import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Bot, Dices, Eye, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useActiveSeason, useDraftSettings, usePracticeDraftPool, useTeams } from '@/api/queries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { DraftPlayerList } from '@/components/draft/DraftPlayerList';
import { DraftBoard } from '@/pages/DraftPage';
import { getTeamColour } from '@/lib/teamColours';
import {
  CPU_STRATEGIES,
  assignCpuStrategies,
  availablePracticePlayers,
  buildPracticeBoard,
  buildPracticeOrder,
  practiceScores,
} from '@/lib/practiceDraft';
import { usePracticeDraftSession } from '@/stores/practiceDraftSession';

export function PracticeDraftPage() {
  const { profile } = useAuth();
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  const { data: settings, isLoading: settingsLoading } = useDraftSettings(seasonId);
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: players, isLoading: playersLoading } = usePracticeDraftPool(seasonId);

  const [selectedSlot, setSelectedSlot] = useState(1);
  const [showBoard, setShowBoard] = useState(false);

  const active = usePracticeDraftSession((state) => state.active);
  const sessionSeasonId = usePracticeDraftSession((state) => state.seasonId);
  const humanTeamId = usePracticeDraftSession((state) => state.humanTeamId);
  const sessionSlot = usePracticeDraftSession((state) => state.selectedSlot);
  const picks = usePracticeDraftSession((state) => state.picks);
  const draftOrder = usePracticeDraftSession((state) => state.draftOrder);
  const cpuStrategies = usePracticeDraftSession((state) => state.cpuStrategies);
  const cpuThinking = usePracticeDraftSession((state) => state.cpuThinking);
  const startSession = usePracticeDraftSession((state) => state.start);
  const makeHumanPick = usePracticeDraftSession((state) => state.makeHumanPick);
  const endSession = usePracticeDraftSession((state) => state.end);

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

  const isMyTurn = !!nextPick && !!humanTeamId && nextPick.team_id === humanTeamId;
  const complete = picks.length > 0 && picks.every((pick) => pick.is_used);
  const myPicks = picks.filter((pick) => pick.team_id === humanTeamId && pick.is_used && !pick.is_skipped);
  const teamName = (id: string) => teams?.find((team) => team.id === id)?.name ?? (id === humanTeamId ? 'Your Team' : 'CPU Team');
  const strategyLabel = (teamId: string) =>
    CPU_STRATEGIES.find((item) => item.key === cpuStrategies[teamId])?.label ?? 'Balanced';

  const startDraft = () => {
    if (!settings || !seasonId || !profile?.team_id || eligibleTeamIds.length < 2) return;
    const order = buildPracticeOrder(eligibleTeamIds, profile.team_id, selectedSlot);
    startSession({
      seasonId,
      humanTeamId: profile.team_id,
      selectedSlot,
      draftOrder: order,
      cpuStrategies: assignCpuStrategies(order, profile.team_id),
      picks: buildPracticeBoard(settings, [], order),
    });
    setShowBoard(false);
  };

  const returnToSetup = () => {
    endSession();
    setShowBoard(false);
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

  if (active && sessionSeasonId && sessionSeasonId !== seasonId) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <Bot className="mx-auto size-8 text-muted-foreground" />
            <h1 className="text-xl font-bold">Practice session is from another season</h1>
            <p className="text-sm text-muted-foreground">End the old simulation before starting one for the active season.</p>
            <Button onClick={returnToSetup}>End old simulation</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!active) {
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
                  const selected = selectedSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`min-h-12 rounded-xl border text-sm font-black tabular-nums transition-colors ${selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}
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
              <Badge variant="secondary" className="gap-1"><Bot className="size-3" /> Pick {sessionSlot}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {season.label} · {settings.draft_type} · {draftOrder.length} teams · {Math.max(0, settings.roster_size - settings.keeper_limit)} draft rounds
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={returnToSetup}><RotateCcw className="mr-1.5 size-4" /> New simulation</Button>
            <Button asChild variant="ghost" size="sm"><Link to="/"><X className="mr-1.5 size-4" /> Leave room</Link></Button>
          </div>
        </div>
      </header>

      {!complete && nextPick && (
        <section className={`border-y bg-card px-4 py-4 sm:rounded-2xl sm:border sm:px-5 ${isMyTurn ? 'border-primary/50 bg-primary/[0.04]' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${isMyTurn ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <span className="font-mono text-sm font-bold">#{nextPick.pick_number}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isMyTurn ? 'text-primary' : 'text-muted-foreground'}`}>
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
              <p className="mt-1 text-sm text-muted-foreground">You drafted {myPicks.length} players from slot {sessionSlot}.</p>
            </div>
            <Button onClick={returnToSetup}><RotateCcw className="mr-2 size-4" /> Run another</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-3">
          <DraftPlayerList
            players={rankedAvailable}
            title={isMyTurn ? 'Make your pick' : 'Available players'}
            subtitle={isMyTurn ? `${rankedAvailable.length} players available · choose a player below` : `${rankedAvailable.length} players available · scout while the room advances`}
            disabled={!isMyTurn || complete}
            disabledLabel={complete ? 'Complete' : 'Waiting'}
            onSelect={(player) => nextPick && isMyTurn && makeHumanPick(nextPick.id, player)}
          />
          <div className="flex items-center justify-between gap-3 px-4 sm:px-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/pool">Open full practice pool</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBoard((value) => !value)}>
              <Eye className="mr-1.5 size-4" /> {showBoard ? 'Hide board' : 'View draft board'}
            </Button>
          </div>
        </div>

        <aside className="mx-4 space-y-3 sm:mx-0 lg:sticky lg:top-4">
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="font-bold">Your Practice Team</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{myPicks.length}/{picks.filter((pick) => pick.team_id === humanTeamId).length} picks</p>
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
                  <Badge variant={teamId === humanTeamId ? 'default' : 'outline'} className="shrink-0 text-[9px]">
                    {teamId === humanTeamId ? 'YOU' : strategyLabel(teamId)}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {showBoard && (
        <div className="pt-1">
          <DraftBoard picks={picks} picksLoading={false} teamName={teamName} teamColor={getTeamColour} />
        </div>
      )}
    </div>
  );
}