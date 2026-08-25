import { useMemo, useState } from 'react';
import { usePlayerPool, useActiveSeason, useDraftPicks, useDraftSettings, useTeams } from '@/api/queries';
import { useMakePick } from '@/api/mutations';
import { useDraftRealtime } from '@/api/realtime';
import { useCanPickNow } from '@/hooks/useCanPickNow';
import { useAuth } from '@/auth/AuthContext';
import { useOfflineQueue } from '@/api/offlineQueue';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { isRookie, STAT_COLUMNS, statColumnValue, fmtStat, type StatColumnKey } from '@/lib/stats';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { PlayerStatsDialog } from '@/components/player/PlayerStatsDialog';
import { RealtimeBadge } from '@/components/draft/RealtimeBadge';
import type { PlayerWithStats } from '@/api/types';

type SortKey = StatColumnKey;
type Basis = 'averages' | 'totals';

const POSITIONS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'] as const;

const chip = (active: boolean) =>
  `shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-all active:scale-[0.98] ${
    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
  }`;

export function PlayerPoolPage() {
  const { profile } = useAuth();
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  useDraftRealtime(seasonId);

  const { data: players, isLoading } = usePlayerPool(seasonId);
  const { data: picks } = useDraftPicks(seasonId);
  const { data: settings } = useDraftSettings(seasonId);
  const { data: teams } = useTeams();
  const canPick = useCanPickNow(seasonId);
  const makePick = useMakePick(seasonId ?? '');
  const queued = useOfflineQueue((s) => s.queue);
  const queuedIds = useMemo(() => new Set(queued.map((q) => q.playerId)), [queued]);

  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>('All');
  const [rookiesOnly, setRookiesOnly] = useState(false);
  const [basis, setBasis] = useState<Basis>('averages');
  const [sortKey, setSortKey] = useState<SortKey>('pts');
  const [selected, setSelected] = useState<PlayerWithStats | null>(null);

  const nextPick = useMemo(() => picks?.find((p) => !p.is_used) ?? null, [picks]);
  const teamName = (id: string) => teams?.find((t) => t.id === id)?.name ?? '—';
  const isMyTurn = !!nextPick && !!profile?.team_id && nextPick.team_id === profile.team_id;

  const filtered = useMemo(() => {
    if (!players) return [];
    const q = search.trim().toLowerCase();
    let pool = players;
    if (position !== 'All') {
      pool = pool.filter((p) =>
        p.position === position ||
        ((position === 'PG' || position === 'SG') && p.position === 'G') ||
        ((position === 'SF' || position === 'PF') && p.position === 'F')
      );
    }
    if (rookiesOnly) pool = pool.filter(isRookie);
    if (q) {
      pool = pool.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nba_team ?? '').toLowerCase().includes(q),
      );
    }
    return [...pool].sort((a, b) =>
      statColumnValue(b, sortKey, basis) - statColumnValue(a, sortKey, basis),
    );
  }, [players, search, position, rookiesOnly, sortKey, basis]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Player Pool</h1>
        <RealtimeBadge />
      </div>

      {nextPick && (settings?.status === 'running' || settings?.status === 'paused') && (
        <Card className={isMyTurn ? 'border-primary bg-primary/5 ring-1 ring-primary' : undefined}>
          <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <Badge variant="outline" className="shrink-0 text-sm">
                Pick {nextPick.pick_number}
              </Badge>
              <span className="line-clamp-2 min-w-0 font-semibold sm:text-lg">{teamName(nextPick.team_id)}</span>
            </div>
            <span className={`text-sm font-medium ${isMyTurn ? 'text-primary' : 'text-muted-foreground'}`}>
              {isMyTurn ? 'Your pick' : 'On the clock'}
            </span>
          </CardContent>
        </Card>
      )}

      {queued.length > 0 && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Offline — {queued.length} pick{queued.length > 1 ? 's' : ''} queued (
          {queued.map((q) => q.playerName).join(', ')}). They'll submit automatically when
          you reconnect.
        </p>
      )}

      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Search player or NBA team…"
            aria-label="Search player pool"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-xs"
          />
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-xs font-medium text-muted-foreground">Stats</span>
            <div className="flex overflow-hidden rounded-md border">
              {(['averages', 'totals'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBasis(b)}
                  aria-pressed={basis === b}
                  className={`px-3 py-2 text-sm font-medium transition-all active:scale-[0.98] ${
                    basis === b ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  {b === 'averages' ? 'Avg' : 'Totals'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
          <div className="flex w-max items-center gap-1.5">
            {POSITIONS.map((pos) => (
              <button key={pos} onClick={() => setPosition(pos)} className={chip(position === pos)}>
                {pos}
              </button>
            ))}
            <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-border" />
            <button
              onClick={() => setRookiesOnly((v) => !v)}
              aria-pressed={rookiesOnly}
              className={chip(rookiesOnly)}
            >
              Rookies
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{filtered.length} player{filtered.length === 1 ? '' : 's'}</span>
        <span>{STAT_COLUMNS.find((c) => c.key === sortKey)?.label ?? sortKey}</span>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No players found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card px-4 py-2.5 font-semibold">Player</th>
                    <th className="px-2 py-2.5 font-semibold">Pos</th>
                    <th className="px-2 py-2.5 font-semibold">Team</th>
                    {STAT_COLUMNS.map((c) => (
                      <th key={c.key} className="px-2 py-2.5 text-right font-semibold">
                        <button
                          onClick={() => setSortKey(c.key)}
                          className={`min-h-8 min-w-8 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground ${sortKey === c.key ? 'text-primary' : ''}`}
                        >
                          {c.label}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/40 active:bg-muted/60"
                    >
                      <td className="sticky left-0 z-10 max-w-44 bg-card px-4 py-2.5 font-medium shadow-[inset_-8px_0_8px_-8px_var(--border)] hover:bg-muted/40 sm:max-w-none">
                        <span className="flex items-center gap-2">
                          <span className="hidden sm:inline-flex">
                            <PlayerHeadshot espnId={p.espn_id} name={p.name} />
                          </span>
                          <span className="line-clamp-2 min-w-0 leading-tight">{p.name}</span>
                          {isRookie(p) && (
                            <Badge variant="outline" className="shrink-0 border-primary/40 px-1 py-0 text-[9px] text-primary">
                              ROOK
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {p.position ?? '—'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-muted-foreground">{p.nba_team ?? '—'}</td>
                      {STAT_COLUMNS.map((c) => (
                        <td key={c.key} className="whitespace-nowrap px-2 py-2.5 text-right tnum">
                          {fmtStat(c.key, basis, statColumnValue(p, c.key, basis))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <PlayerStatsDialog
        player={selected}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        basis={basis}
        canPick={canPick && !!selected && !queuedIds.has(selected.id)}
        picking={makePick.isPending}
        onPick={() =>
          selected &&
          makePick.mutate(
            { playerId: selected.id, playerName: selected.name },
            { onSettled: () => setSelected(null) },
          )
        }
      />
    </div>
  );
}
