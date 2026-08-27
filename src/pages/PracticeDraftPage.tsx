import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Bot, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useActiveSeason, useDraftPicks, useDraftSettings, usePracticeDraftPool, useTeams } from '@/api/queries';
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
  availablePracticePlayers,
  buildPracticeBoard,
  makePracticePick,
  practiceScores,
  skipPracticePick,
} from '@/lib/practiceDraft';

export function PracticeDraftPage() {
  const { profile } = useAuth();
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  const { data: settings, isLoading: settingsLoading } = useDraftSettings(seasonId);
  const { data: sourcePicks, isLoading: picksLoading } = useDraftPicks(seasonId);
  const { data: teams } = useTeams();
  const { data: players, isLoading: playersLoading } = usePracticeDraftPool(seasonId);

  const [sessionPicks, setSessionPicks] = useState<DraftPick[] | null>(null);
  const [search, setSearch] = useState('');
  const [cpuThinking, setCpuThinking] = useState(false);

  const freshBoard = useMemo(() => {
    if (!settings) return [];
    return buildPracticeBoard(settings, sourcePicks ?? []);
  }, [settings, sourcePicks]);

  useEffect(() => {
    if (sessionPicks === null && freshBoard.length > 0) setSessionPicks(freshBoard);
  }, [freshBoard, sessionPicks]);

  const picks = sessionPicks ?? freshBoard;
  const nextPick = useMemo(() => picks.find((pick) => !pick.is_used) ?? null, [picks]);
  const available = useMemo(
    () => availablePracticePlayers(players ?? [], picks),
    [players, picks],
  );
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
  const teamName = (id: string) => teams?.find((team) => team.id === id)?.name ?? '—';

  // CPU teams advance one pick at a time. The timer is UX only; all state stays
  // in this component and disappears when the route is left or restarted.
  useEffect(() => {
    if (!nextPick || isMyTurn || !profile?.team_id || playersLoading) {
      setCpuThinking(false);
      return;
    }

    setCpuThinking(true);
    const timer = window.setTimeout(() => {
      setSessionPicks((current) => {
        const board = current ?? freshBoard;
        const currentNext = board.find((pick) => !pick.is_used);
        if (!currentNext || currentNext.team_id === profile.team_id) return board;
        const remaining = availablePracticePlayers(players ?? [], board)
          .sort((a, b) => {
            const diff = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
            return diff || a.name.localeCompare(b.name);
          });
        const cpuPick = remaining[0];
        return cpuPick
          ? makePracticePick(board, currentNext.id, cpuPick)
          : skipPracticePick(board, currentNext.id);
      });
      setCpuThinking(false);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [freshBoard, isMyTurn, nextPick, players, playersLoading, profile?.team_id, scores]);

  const makeMyPick = (player: PlayerWithStats) => {
    if (!nextPick || !isMyTurn) return;
    setSessionPicks((current) => makePracticePick(current ?? freshBoard, nextPick.id, player));
  };

  const restart = () => {
    setSessionPicks(freshBoard);
    setSearch('');
  };

  if (!season) {
    return <div className="p-8 text-center text-muted-foreground">No active season is available for practice.</div>;
  }

  if (settingsLoading || picksLoading || playersLoading) {
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

  if (!settings || freshBoard.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <Bot className="mx-auto size-8 text-muted-foreground" />
            <h1 className="text-xl font-bold">Practice Draft</h1>
            <p className="text-sm text-muted-foreground">
              The commissioner needs to configure a draft order before practice simulations can begin.
            </p>
            <Button asChild variant="outline"><Link to="/">Back to Draft Central</Link></Button>
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
              <Badge variant="secondary" className="gap-1">
                <Bot className="size-3" /> Simulation
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {season.label} · {settings.draft_type} · {settings.league_size} teams · {settings.roster_size} rounds
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={restart}>
              <RotateCcw className="mr-1.5 size-4" /> Restart
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><X className="mr-1.5 size-4" /> Cancel</Link>
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <span><strong className="text-foreground">Private practice only.</strong> Picks exist in this browser session and are never written to league draft, roster, keeper, trade, or season data.</span>
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
                {isMyTurn ? 'Your practice pick' : cpuThinking ? 'CPU drafting…' : 'CPU on the clock'}
              </div>
              <div className="mt-1 line-clamp-1 text-lg font-bold">{teamName(nextPick.team_id)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Round {nextPick.round} · {available.length} players available</div>
            </div>
          </div>
        </section>
      )}

      {complete && (
        <Card className="mx-4 border-primary/30 bg-primary/[0.04] sm:mx-0">
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold">Simulation complete</h2>
              <p className="mt-1 text-sm text-muted-foreground">You drafted {myPicks.length} players. Restart to try a different strategy.</p>
            </div>
            <Button onClick={restart}><RotateCcw className="mr-2 size-4" /> Draft again</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-4">
          <DraftBoard
            picks={picks}
            picksLoading={false}
            teamName={teamName}
            teamColor={getTeamColour}
          />

          <section className="overflow-hidden border-y bg-card sm:rounded-xl sm:border">
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold">Practice Player Pool</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">CPU opponents use current 13-category production to make deterministic practice picks.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search players"
                  className="pl-9"
                  aria-label="Search practice players"
                />
              </div>
            </div>

            {filteredPlayers.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No available players found.</p>
            ) : (
              <div className="max-h-[34rem] overflow-auto">
                <table className="w-full min-w-[42rem] border-collapse text-sm">
                  <thead className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_var(--border)]">
                    <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 text-left">Player</th>
                      <th className="px-2 py-2 text-right">PTS</th>
                      <th className="px-2 py-2 text-right">REB</th>
                      <th className="px-2 py-2 text-right">AST</th>
                      <th className="px-2 py-2 text-right">STL</th>
                      <th className="px-2 py-2 text-right">BLK</th>
                      <th className="w-24 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((player) => (
                      <tr key={player.id} className="border-b border-border/50 hover:bg-muted/40">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-3">
                            <PlayerHeadshot espnId={player.espn_id} name={player.name} size={36} variant="bare" />
                            <div className="min-w-0">
                              <div className="line-clamp-1 font-semibold">{player.name}</div>
                              <div className="mt-0.5 text-[11px] text-muted-foreground">{player.nba_team ?? 'FA'} · {player.position ?? '—'}</div>
                            </div>
                          </div>
                        </td>
                        {(['pts', 'reb', 'ast', 'stl', 'blk'] as const).map((key) => (
                          <td key={key} className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">
                            {fmtStat(key, 'averages', statColumnValue(player, key, 'averages'))}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            disabled={!isMyTurn || complete}
                            onClick={() => makeMyPick(player)}
                            aria-label={`Draft ${player.name}`}
                          >
                            Draft
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="mx-4 h-fit overflow-hidden rounded-xl border bg-card sm:mx-0 lg:sticky lg:top-4">
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
                    <div className="text-[10px] text-muted-foreground">{pick.players?.position ?? '—'} · {pick.players?.nba_team ?? 'FA'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
