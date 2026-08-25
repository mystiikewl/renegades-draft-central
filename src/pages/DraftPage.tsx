import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useActiveSeason, useDraftPicks, useDraftSettings, useTeams } from '@/api/queries';
import { useSwapPicks, useTradePick, useUndoLastPick } from '@/api/mutations';
import { useDraftRealtime } from '@/api/realtime';
import { useCanPickNow } from '@/hooks/useCanPickNow';
import { useAuth } from '@/auth/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useOfflineQueue } from '@/api/offlineQueue';
import type { DraftPick } from '@/api/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RealtimeBadge } from '@/components/draft/RealtimeBadge';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';

function DraftStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pre_draft: { label: 'Pre-draft', variant: 'secondary' },
    running: { label: 'Live', variant: 'default' },
    paused: { label: 'Paused', variant: 'destructive' },
    complete: { label: 'Complete', variant: 'outline' },
  };
  const cfg = map[status] ?? map.pre_draft;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

/**
 * The draft board page — spectating only. Picks are made from the Player
 * Pool (/pool); when it's your turn this page points you there.
 */
export function DraftPage() {
  const { profile } = useAuth();
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  useDraftRealtime(seasonId);

  const { data: settings } = useDraftSettings(seasonId);
  const { data: picks, isLoading: picksLoading } = useDraftPicks(seasonId);
  const { data: teams } = useTeams();
  const undoPick = useUndoLastPick(seasonId ?? '');
  const [undoConfirm, setUndoConfirm] = useState(false);
  const queued = useOfflineQueue((s) => s.queue);

  const nextPick = useMemo(
    () => picks?.find((p) => !p.is_used) ?? null,
    [picks]
  );
  const lastPick = useMemo(() => {
    if (!picks?.length) return null;
    const used = picks.filter((p) => p.is_used);
    return used.length ? used[used.length - 1] : null;
  }, [picks]);

  const teamName = (id: string) => teams?.find((t) => t.id === id)?.name ?? '—';
  const isMyTurn = !!nextPick && !!profile?.team_id && nextPick.team_id === profile.team_id;
  const canPickNow = useCanPickNow(seasonId);
  const draftLive = settings?.status === 'running' || settings?.status === 'paused';
  const canUndo =
    !!draftLive &&
    !!lastPick &&
    (!!profile?.is_admin || (!!profile?.team_id && profile.team_id === lastPick.team_id));

  if (!season) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No active season. Ask an admin to create one for 2026-27.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:space-y-6 md:p-6">
      {/* Status header */}
      <div className="space-y-3 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{season.label} Draft</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {settings
              ? `${settings.draft_type} · ${settings.league_size} teams · ${settings.roster_size} rounds`
              : 'Loading settings…'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
          <DraftStatusBadge status={settings?.status ?? 'pre_draft'} />
          <RealtimeBadge />
          {canUndo && (
            <Button
              size="sm"
              variant="outline"
              className="transition-all active:scale-[0.98]"
              onClick={() => setUndoConfirm(true)}
              disabled={undoPick.isPending || !picks?.some((p) => p.is_used)}
            >
              Undo last pick
            </Button>
          )}
        </div>
      </div>

      {/* Mobile: sticky on-the-clock mini-bar (lg:hidden, sticks below non-sticky app header) */}
      {nextPick && draftLive ? (
        <div
          className={`sticky top-0 z-30 -mx-4 flex items-center gap-2 border-y bg-background/95 px-4 py-2.5 shadow-sm backdrop-blur md:-mx-6 lg:hidden ${
            isMyTurn ? 'border-primary' : 'border-border'
          }`}
        >
          <Badge variant="outline" className="shrink-0 text-xs">
            #{nextPick.pick_number}
          </Badge>
          <span className="line-clamp-2 min-w-0 text-sm font-semibold leading-tight">{teamName(nextPick.team_id)}</span>
          <span className="ml-auto shrink-0 text-xs">
            {isMyTurn ? (
              <Link
                to="/pool"
                className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 font-bold uppercase text-primary-foreground transition-transform active:scale-[0.98]"
              >
                Pick →
              </Link>
            ) : (
              <span className="text-muted-foreground">on the clock</span>
            )}
          </span>
        </div>
      ) : null}

      {/* On the clock */}
      {nextPick && draftLive ? (
        <Card className={isMyTurn ? 'border-primary bg-primary/5 ring-1 ring-primary' : undefined}>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <Badge variant="outline" className="shrink-0 text-sm">
                Pick {nextPick.pick_number}
              </Badge>
              <div className="min-w-0">
                <div className="line-clamp-2 font-semibold leading-tight sm:text-lg">{teamName(nextPick.team_id)}</div>
                <div className={`mt-0.5 text-sm ${isMyTurn ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                  {isMyTurn ? 'YOUR PICK' : 'is on the clock'}
                </div>
              </div>
            </div>
            {isMyTurn && (
              <Button asChild disabled={!canPickNow} className="w-full transition-transform active:scale-[0.98] sm:w-auto">
                <Link to="/pool" className="justify-center">Draft a player in the Player Pool →</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Recent picks strip */}
      {lastPick ? (
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm sm:flex sm:gap-3">
          {lastPick.players?.espn_id || lastPick.players?.name ? (
            <PlayerHeadshot espnId={lastPick.players?.espn_id ?? null} name={lastPick.players?.name ?? ''} size={32} />
          ) : null}
          <div className="min-w-0 sm:contents">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">Last pick</span>
            <strong className="line-clamp-2 font-semibold leading-tight">{lastPick.players?.name ?? '—'}</strong>
            <span className="col-start-2 text-xs text-muted-foreground sm:text-sm">
              to {lastPick.team?.name ?? teamName(lastPick.team_id)} · #{lastPick.pick_number}
            </span>
          </div>
        </div>
      ) : null}

      {queued.length > 0 && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Offline — {queued.length} pick{queued.length > 1 ? 's' : ''} queued (
          {queued.map((q) => q.playerName).join(', ')}). They'll submit automatically when
          you reconnect.
        </p>
      )}

      <DraftBoard picks={picks ?? []} picksLoading={picksLoading} teamName={teamName} seasonId={seasonId} myTeamId={profile?.team_id ?? null} />

      {/* Undo confirm */}
      <Dialog open={undoConfirm} onOpenChange={setUndoConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Undo last pick?</DialogTitle>
            <DialogDescription>
              The most recent pick will be removed and that team goes back on the clock.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUndoConfirm(false)}>
              Cancel
            </Button>
            <Button
              className="transition-transform active:scale-[0.98]"
              disabled={undoPick.isPending}
              onClick={() =>
                undoPick.mutate(undefined, { onSettled: () => setUndoConfirm(false) })
              }
            >
              {undoPick.isPending ? 'Undoing…' : 'Undo pick'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Give one of my unused picks to another team, or swap it for one of theirs. */
function PickTradesPanel({
  picks,
  seasonId,
  myTeamId,
  teamName,
}: {
  picks: DraftPick[];
  seasonId: string;
  myTeamId: string | null;
  teamName: (id: string) => string;
}) {
  const tradePick = useTradePick(seasonId);
  const swapPicks = useSwapPicks(seasonId);
  const [myPickId, setMyPickId] = useState('');
  const [theirPickId, setTheirPickId] = useState('');

  const myPicks = picks.filter((p) => p.team_id === myTeamId && !p.is_used);
  const otherUnused = picks.filter((p) => p.team_id !== myTeamId && !p.is_used);
  if (!myPicks.length && !otherUnused.length) return null;

  const label = (p: DraftPick) =>
    `R${p.round} #${p.pick_number}${p.team_id !== p.original_team_id ? ` (from ${teamName(p.original_team_id).slice(0, 10)})` : ''}`;

  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="mb-3 text-sm font-medium">Trade picks</div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <Label htmlFor="trade-mine" className="text-xs text-muted-foreground">My pick</Label>
          <Select value={myPickId} onValueChange={setMyPickId}>
            <SelectTrigger id="trade-mine" className="mt-1 w-full"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {myPicks.map((p) => (
                <SelectItem key={p.id} value={p.id}>{label(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label htmlFor="trade-theirs" className="text-xs text-muted-foreground">Swap for…</Label>
          <Select value={theirPickId} onValueChange={setTheirPickId}>
            <SelectTrigger id="trade-theirs" className="mt-1 w-full"><SelectValue placeholder="(none = give away)" /></SelectTrigger>
            <SelectContent>
              {otherUnused.map((p) => (
                <SelectItem key={p.id} value={p.id}>{label(p)} · {teamName(p.team_id).slice(0, 12)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          className="w-full transition-transform active:scale-[0.98] sm:w-auto"
          disabled={!myPickId || !theirPickId || tradePick.isPending || swapPicks.isPending}
          onClick={() => theirPickId && swapPicks.mutate({ mine: myPickId, theirs: theirPickId })}
        >
          Swap
        </Button>
      </div>
      {!theirPickId && myPickId && (
        <GiveAwayRow pickId={myPickId} seasonId={seasonId} teamName={teamName} pending={tradePick.isPending} />
      )}
    </div>
  );
}

/** Pick the receiving team when gifting a pick. */
function GiveAwayRow({
  pickId,
  seasonId,
  teamName,
  pending,
}: {
  pickId: string;
  seasonId: string;
  teamName: (id: string) => string;
  pending: boolean;
}) {
  const { data: teams } = useTeams();
  const tradePick = useTradePick(seasonId);
  const [toTeam, setToTeam] = useState('');
  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center">
      <Select value={toTeam} onValueChange={setToTeam}>
        <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Give to team…" /></SelectTrigger>
        <SelectContent>
          {(teams ?? []).filter((t) => !t.is_shadow).map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        className="w-full transition-transform active:scale-[0.98] sm:w-auto"
        disabled={!toTeam || pending}
        onClick={() => toTeam && tradePick.mutate({ pickId, toTeamId: toTeam })}
      >
        Confirm giveaway
      </Button>
    </div>
  );
}

export function DraftBoard({
  picks,
  picksLoading,
  teamName,
  seasonId,
  myTeamId,
}: {
  picks: DraftPick[];
  picksLoading: boolean;
  teamName: (id: string) => string;
  seasonId?: string;
  myTeamId?: string | null;
}) {
  if (picksLoading) return <Skeleton className="h-96 w-full" />;
  if (!picks.length)
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Draft order not set yet — the board appears once picks are generated.
        </CardContent>
      </Card>
    );

  const rounds = [...new Set(picks.map((p) => p.round))].sort((a, b) => a - b);
  const onClockId = picks.find((p) => !p.is_used)?.id;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Draft Board</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-3 sm:px-6">
        {seasonId && myTeamId && (
          <PickTradesPanel picks={picks} seasonId={seasonId} myTeamId={myTeamId} teamName={teamName} />
        )}
        {rounds.map((round) => (
          <div key={round}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Round {round}
            </div>
            {/* Single markup: full-width pick row on mobile, dense tile from sm up */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {picks
                .filter((p) => p.round === round)
                .map((p) => (
                  <div
                    key={p.id}
                    data-on-clock={onClockId === p.id || undefined}
                    className={`flex min-h-14 items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs sm:block sm:min-h-0 sm:p-2 ${
                      onClockId === p.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : p.is_used
                        ? 'border-border'
                        : 'border-dashed border-muted-foreground/40 opacity-70'
                    }`}
                  >
                    <div className="min-w-0 flex-1 sm:min-w-0">
                      <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                        <span className="shrink-0">#{p.pick_number}</span>
                        <span className={`line-clamp-1 ${p.team_id !== p.original_team_id ? 'text-amber-600' : undefined}`}>
                          {teamName(p.team_id)}
                        </span>
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-2 sm:mt-1.5">
                        {p.is_used && (
                          <PlayerHeadshot
                            espnId={p.players?.espn_id ?? null}
                            name={p.players?.name ?? ''}
                            size={22}
                            variant="bare"
                          />
                        )}
                        <span
                          className={`line-clamp-2 min-w-0 font-medium leading-tight ${
                            onClockId === p.id ? 'font-semibold' : undefined
                          }`}
                        >
                          {p.players?.name ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
