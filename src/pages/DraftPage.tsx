import { useMemo, useState } from 'react';
import { useActiveSeason, useDraftPicks, useDraftSettings, useTeams } from '@/api/queries';
import { useMakePick, useUndoLastPick } from '@/api/mutations';
import { useDraftRealtime } from '@/api/realtime';
import { useAuth } from '@/auth/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlayerPool } from '@/api/queries';
import type { DraftPick, PlayerWithStats } from '@/api/types';

export function DraftPage() {
  const { profile } = useAuth();
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  useDraftRealtime(seasonId);

  const { data: settings } = useDraftSettings(seasonId);
  const { data: picks, isLoading: picksLoading } = useDraftPicks(seasonId);
  const { data: teams } = useTeams();

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

  if (!season) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No active season. Ask an admin to create one for 2026-27.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Status header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{season.label} Draft</h1>
          <p className="text-sm text-muted-foreground">
            {settings
              ? `${settings.draft_type} · ${settings.league_size} teams · ${settings.roster_size} rounds · ${Math.floor(settings.pick_time_limit_seconds / 60)}min clock`
              : 'Loading settings…'}
          </p>
        </div>
        <DraftStatusBadge status={settings?.status ?? 'pre_draft'} />
      </div>

      {/* On the clock */}
      {nextPick && settings?.status === 'running' ? (
        <Card className={isMyTurn ? 'border-primary' : undefined}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                Pick {nextPick.pick_number}
              </Badge>
              <span className="text-lg font-semibold">{teamName(nextPick.team_id)}</span>
              <span className="text-muted-foreground">is on the clock</span>
            </div>
            {isMyTurn && (
              <span className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
                YOUR PICK — choose a player below
              </span>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Recent picks strip */}
      {lastPick ? (
        <p className="text-sm text-muted-foreground">
          Last pick: <strong>{lastPick.players?.name ?? '—'}</strong> →{' '}
          {lastPick.teams?.name ?? teamName(lastPick.team_id)} (#{lastPick.pick_number})
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <DraftBoard picks={picks ?? []} picksLoading={picksLoading} teamName={teamName} />
        <PlayerPoolPanel
          seasonId={seasonId}
          canPick={isMyTurn || !!profile?.is_admin}
          playerNameFor={(pick: DraftPick) => pick.players?.name ?? null}
        />
      </div>
    </div>
  );
}

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

function DraftBoard({
  picks,
  picksLoading,
  teamName,
}: {
  picks: DraftPick[];
  picksLoading: boolean;
  teamName: (id: string) => string;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Draft Board</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rounds.map((round) => (
          <div key={round}>
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
              Round {round}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {picks
                .filter((p) => p.round === round)
                .map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-md border p-2 text-xs ${
                      p.is_used ? 'border-border' : 'border-dashed border-muted-foreground/40 opacity-70'
                    }`}
                  >
                    <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                      <span>#{p.pick_number}</span>
                      <span>{teamName(p.team_id).slice(0, 14)}</span>
                    </div>
                    <div className="mt-1 truncate font-medium">
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

function PlayerPoolPanel({
  seasonId,
  canPick,
  playerNameFor,
}: {
  seasonId: string;
  canPick: boolean;
  playerNameFor: (pick: DraftPick) => string | null;
}) {
  const [search, setSearch] = useState('');
  const { data: players, isLoading } = usePlayerPool(seasonId);
  const { data: picks } = useDraftPicks(seasonId);
  const makePick = useMakePick(seasonId);
  const undoPick = useUndoLastPick(seasonId);

  const rosteredIds = useMemo(() => {
    const ids = new Set<string>();
    picks?.forEach((p) => p.player_id && ids.add(p.player_id));
    return ids;
  }, [picks]);

  const filtered = useMemo(() => {
    if (!players) return [];
    const q = search.trim().toLowerCase();
    const pool = players.filter((p) => !rosteredIds.has(p.id));
    if (!q) return pool.slice(0, 60);
    return pool
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nba_team ?? '').toLowerCase().includes(q) ||
          (p.position ?? '').toLowerCase() === q
      )
      .slice(0, 60);
  }, [players, search, rosteredIds]);

  const stat = (p: PlayerWithStats, key: string): string => {
    const v = p.player_seasons?.[0]?.stats?.[key];
    return v == null ? '—' : String(v);
  };

  const nextPick = picks?.find((p) => !p.is_used);

  return (
    <Card className="h-fit">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Player Pool</CardTitle>
        {nextPick?.is_used === false && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => undoPick.mutate()}
            disabled={undoPick.isPending || !picks?.some((p) => p.is_used)}
          >
            Undo last pick
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Search players, teams, positions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!canPick && (
          <p className="text-xs text-muted-foreground">
            Picks unlock when you're on the clock (admins can always pick).
          </p>
        )}
        <ScrollArea className="h-[500px] pr-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No players found.</p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_40px_40px_40px_40px_64px] gap-2 px-2 pb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                <span>Player</span>
                <span className="text-right">PPG</span>
                <span className="text-right">RPG</span>
                <span className="text-right">APG</span>
                <span className="text-right">GP</span>
                <span />
              </div>
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_40px_40px_40px_40px_64px] items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.position ?? '—'} · {p.nba_team ?? '—'}
                    </div>
                  </div>
                  <span className="text-right tabular-nums">{stat(p, 'avgPoints')}</span>
                  <span className="text-right tabular-nums">{stat(p, 'avgRebounds')}</span>
                  <span className="text-right tabular-nums">{stat(p, 'avgAssists')}</span>
                  <span className="text-right tabular-nums">{stat(p, 'gamesPlayed')}</span>
                  <Button
                    size="sm"
                    disabled={!canPick || makePick.isPending}
                    onClick={() => makePick.mutate(p.id)}
                  >
                    Pick
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
