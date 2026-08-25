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
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6">
      {/* Status header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{season.label} Draft</h1>
          <p className="text-sm text-muted-foreground">
            {settings
              ? `${settings.draft_type} · ${settings.league_size} teams · ${settings.roster_size} rounds`
              : 'Loading settings…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DraftStatusBadge status={settings?.status ?? 'pre_draft'} />
          <RealtimeBadge />
          {canUndo && (
            <Button
              size="sm"
              variant="outline"
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
          className={`sticky top-0 z-30 -mx-4 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur md:-mx-6 lg:hidden ${
            isMyTurn ? 'border-primary' : 'border-border'
          }`}
        >
          <Badge variant="outline" className="shrink-0 text-xs">
            #{nextPick.pick_number}
          </Badge>
          <span className="truncate text-sm font-semibold">{teamName(nextPick.team_id)}</span>
          <span className="ml-auto shrink-0 text-xs">
            {isMyTurn ? (
              <Link to="/pool" className="font-bold uppercase text-primary">
                Your pick →
              </Link>
            ) : (
              <span className="text-muted-foreground">on the clock</span>
            )}
          </span>
        </div>
      ) : null}

      {/* On the clock */}
      {nextPick && draftLive ? (
        <Card className={isMyTurn ? 'border-primary ring-1 ring-primary' : undefined}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                Pick {nextPick.pick_number}
              </Badge>
              <span className="text-lg font-semibold">{teamName(nextPick.team_id)}</span>
              <span className="text-muted-foreground">
                {isMyTurn ? 'YOUR PICK' : 'is on the clock'}
              </span>
            </div>
            {isMyTurn && (
              <Button asChild disabled={!canPickNow}>
                <Link to="/pool">Draft a player in the Player Pool →</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Recent picks strip */}
      {lastPick ? (
        <p className="text-sm text-muted-foreground">
          Last pick: <strong>{lastPick.players?.name ?? '—'}</strong> →{' '}
          {lastPick.team?.name ?? teamName(lastPick.team_id)} (#{lastPick.pick_number})
        </p>
      ) : null}

      {queued.length > 0 && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
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
      <div className="mb-2 text-sm font-medium">Trade picks</div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="trade-mine" className="text-xs text-muted-foreground">My pick</Label>
          <Select value={myPickId} onValueChange={setMyPickId}>
            <SelectTrigger id="trade-mine" className="w-40"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {myPicks.map((p) => (
                <SelectItem key={p.id} value={p.id}>{label(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="trade-theirs" className="text-xs text-muted-foreground">Swap for…</Label>
          <Select value={theirPickId} onValueChange={setTheirPickId}>
            <SelectTrigger id="trade-theirs" className="w-40"><SelectValue placeholder="(none = give away)" /></SelectTrigger>
            <SelectContent>
              {otherUnused.map((p) => (
                <SelectItem key={p.id} value={p.id}>{label(p)} · {teamName(p.team_id).slice(0, 12)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
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
    <div className="mt-2 flex items-center gap-2">
      <Select value={toTeam} onValueChange={setToTeam}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Give to team…" /></SelectTrigger>
        <SelectContent>
          {(teams ?? []).filter((t) => !t.is_shadow).map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        disabled={!toTeam || pending}
        onClick={() => toTeam && tradePick.mutate({ pickId, toTeamId: toTeam })}
      >
        Confirm
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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Draft Board</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {seasonId && myTeamId && (
          <PickTradesPanel picks={picks} seasonId={seasonId} myTeamId={myTeamId} teamName={teamName} />
        )}
        {rounds.map((round) => (
          <div key={round}>
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
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
                    className={`flex min-h-11 items-center justify-between rounded-md border px-3 py-2 text-xs sm:block sm:p-2 ${
                      onClockId === p.id
                        ? 'border-primary ring-1 ring-primary'
                        : p.is_used
                        ? 'border-border'
                        : 'border-dashed border-muted-foreground/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                      <span>#{p.pick_number}</span>
                      <span className={p.team_id !== p.original_team_id ? 'text-amber-600' : undefined}>
                        {teamName(p.team_id)}
                      </span>
                    </div>
                    {/* ponytail: truncate keeps long names from wrapping the mobile row */}
                    <div className="truncate font-medium sm:mt-1 sm:text-left">
                      {p.players?.name ?? '—'}
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
