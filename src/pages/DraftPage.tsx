import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Radio } from 'lucide-react';
import { useActiveSeason, useDraftPicks, useDraftSettings, useTeams } from '@/api/queries';
import { useUndoLastPick } from '@/api/mutations';
import { useDraftRealtime } from '@/api/realtime';
import { useCanPickNow } from '@/hooks/useCanPickNow';
import { useAuth } from '@/auth/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

/** Draft-room overview. Player selection itself lives in /pool. */
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

  const nextPick = useMemo(() => picks?.find((p) => !p.is_used) ?? null, [picks]);
  const lastPick = useMemo(() => {
    if (!picks?.length) return null;
    const used = picks.filter((p) => p.is_used);
    return used.length ? used[used.length - 1] : null;
  }, [picks]);

  const teamName = (id: string) => teams?.find((t) => t.id === id)?.name ?? '—';
  const teamColor = (id: string) => teams?.find((t) => t.id === id)?.team_color;
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
    <div className="mx-auto max-w-7xl space-y-4 px-0 py-3 sm:px-4 md:space-y-5 md:p-6">
      <div className="flex items-start justify-between gap-3 px-4 sm:px-0">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{season.label} Draft</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {settings
              ? `${settings.draft_type} · ${settings.league_size} teams · ${settings.roster_size} rounds`
              : 'Loading settings…'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DraftStatusBadge status={settings?.status ?? 'pre_draft'} />
          <RealtimeBadge />
        </div>
      </div>

      {nextPick && draftLive ? (
        <section className={`overflow-hidden border-y bg-card sm:rounded-2xl sm:border ${isMyTurn ? 'sm:border-primary/60' : ''}`}>
          <div className={`relative px-4 py-4 sm:px-5 ${isMyTurn ? 'bg-primary/[0.06]' : 'bg-muted/25'}`}>
            {isMyTurn && <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
            <div className="flex items-center gap-3">
              <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${isMyTurn ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-background text-muted-foreground'}`}>
                <span className="font-mono text-sm font-bold">#{nextPick.pick_number}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  <Radio className={`size-3.5 ${isMyTurn ? 'text-primary' : ''}`} />
                  On the clock
                </div>
                <div className="mt-1 line-clamp-2 text-lg font-bold leading-tight">{teamName(nextPick.team_id)}</div>
                <div className={`mt-1 text-xs font-medium ${isMyTurn ? 'text-primary' : 'text-muted-foreground'}`}>
                  {isMyTurn ? 'YOUR PICK' : `Round ${nextPick.round}`}
                </div>
              </div>
              {isMyTurn && (
                <Button asChild disabled={!canPickNow} className="hidden shrink-0 transition-transform active:scale-[0.98] sm:inline-flex">
                  <Link to="/pool">Player Pool <ArrowRight className="size-4" /></Link>
                </Button>
              )}
            </div>
            {isMyTurn && (
              <Button asChild disabled={!canPickNow} className="mt-4 w-full transition-transform active:scale-[0.98] sm:hidden">
                <Link to="/pool" className="justify-center">Open Player Pool <ArrowRight className="size-4" /></Link>
              </Button>
            )}
          </div>

          {(lastPick || canUndo) && (
            <div className="flex min-h-12 items-center gap-3 border-t px-4 py-2.5 text-sm sm:px-5">
              {lastPick && (
                <>
                  <PlayerHeadshot
                    espnId={lastPick.players?.espn_id ?? null}
                    name={lastPick.players?.name ?? ''}
                    size={30}
                    variant="bare"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 font-semibold">{lastPick.players?.name ?? '—'}</div>
                    <div className="line-clamp-1 text-[11px] text-muted-foreground">
                      Last pick · {lastPick.team?.name ?? teamName(lastPick.team_id)} · #{lastPick.pick_number}
                    </div>
                  </div>
                </>
              )}
              {canUndo && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto shrink-0 text-xs transition-transform active:scale-[0.98]"
                  onClick={() => setUndoConfirm(true)}
                  disabled={undoPick.isPending || !picks?.some((p) => p.is_used)}
                >
                  Undo last pick
                </Button>
              )}
            </div>
          )}
        </section>
      ) : null}

      {queued.length > 0 && (
        <p className="mx-4 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground sm:mx-0">
          Offline — {queued.length} pick{queued.length > 1 ? 's' : ''} queued (
          {queued.map((q) => q.playerName).join(', ')}). They'll submit automatically when you reconnect.
        </p>
      )}

      <DraftBoard picks={picks ?? []} picksLoading={picksLoading} teamName={teamName} teamColor={teamColor} />

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
              onClick={() => undoPick.mutate(undefined, { onSettled: () => setUndoConfirm(false) })}
            >
              {undoPick.isPending ? 'Undoing…' : 'Undo pick'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DraftBoard({
  picks,
  picksLoading,
  teamName,
  teamColor,
}: {
  picks: DraftPick[];
  picksLoading: boolean;
  teamName: (id: string) => string;
  teamColor?: (id: string) => string | undefined;
}) {
  if (picksLoading) return <Skeleton className="mx-4 h-96 w-[calc(100%-2rem)] sm:mx-0 sm:w-full" />;
  if (!picks.length)
    return (
      <Card className="mx-4 sm:mx-0">
        <CardContent className="py-10 text-center text-muted-foreground">
          Draft order not set yet — the board appears once picks are generated.
        </CardContent>
      </Card>
    );

  const rounds = [...new Set(picks.map((p) => p.round))].sort((a, b) => a - b);
  const onClockId = picks.find((p) => !p.is_used)?.id;

  return (
    <section className="overflow-hidden border-y bg-card sm:rounded-2xl sm:border">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div>
          <h2 className="font-bold">Draft Board</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:hidden">Swipe to scan picks</p>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {picks.filter((p) => p.is_used).length}/{picks.length}
        </Badge>
      </div>

      <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <div className="min-w-max">
          {rounds.map((round) => {
            const roundPicks = picks
              .filter((p) => p.round === round)
              .sort((a, b) => a.pick_number - b.pick_number);

            return (
              <div key={round} className="flex border-b last:border-b-0">
                <div className="sticky left-0 z-20 flex w-16 shrink-0 flex-col items-center justify-center border-r bg-muted/80 px-2 py-3 backdrop-blur sm:w-20">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Round</span>
                  <span className="mt-0.5 text-lg font-black tabular-nums">{round}</span>
                </div>

                {roundPicks.map((p) => {
                  const onClock = onClockId === p.id;
                  const traded = p.team_id !== p.original_team_id;
                  const pickTeamColor = p.is_used ? teamColor?.(p.team_id) : undefined;

                  return (
                    <div
                      key={p.id}
                      data-on-clock={onClock || undefined}
                      data-team-color={pickTeamColor}
                      style={
                        pickTeamColor
                          ? {
                              backgroundColor: `${pickTeamColor}1F`,
                              borderTopColor: pickTeamColor,
                              borderTopWidth: '2px',
                            }
                          : undefined
                      }
                      className={`relative flex h-[6.75rem] w-36 shrink-0 flex-col border-r p-2.5 text-xs sm:h-28 sm:w-40 ${
                        onClock
                          ? 'bg-primary/[0.07] ring-2 ring-inset ring-primary'
                          : p.is_used
                          ? 'bg-card'
                          : 'bg-muted/[0.16]'
                      }`}
                    >
                      {onClock && (
                        <span className="absolute right-2 top-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-primary">
                          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                          Live
                        </span>
                      )}

                      <div className="flex min-w-0 items-center gap-1.5 pr-9 font-mono text-[9px] text-muted-foreground">
                        <span className="shrink-0">#{p.pick_number}</span>
                        {traded && <span className="rounded bg-amber-500/10 px-1 py-0.5 font-sans font-bold text-amber-600">TRADE</span>}
                      </div>

                      {p.is_used ? (
                        <div className="mt-2 flex min-w-0 flex-1 items-center gap-2">
                          <PlayerHeadshot
                            espnId={p.players?.espn_id ?? null}
                            name={p.players?.name ?? ''}
                            size={36}
                            variant="bare"
                          />
                          <div className="min-w-0">
                            <div className="line-clamp-2 font-bold leading-tight">{p.players?.name ?? '—'}</div>
                            <div className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">{teamName(p.team_id)}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-auto min-w-0">
                          <div className={`line-clamp-2 font-semibold leading-tight ${onClock ? 'text-primary' : ''}`}>
                            {teamName(p.team_id)}
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground">{onClock ? 'On the clock' : 'Upcoming'}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
