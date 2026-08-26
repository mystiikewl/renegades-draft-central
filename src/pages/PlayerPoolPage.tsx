import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { usePlayerPool, useActiveSeason, useDraftPicks, useDraftSettings, useTeams } from '@/api/queries';
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
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { PlayerStatsDialog } from '@/components/player/PlayerStatsDialog';
import { RealtimeBadge } from '@/components/draft/RealtimeBadge';
import type { PlayerWithStats } from '@/api/types';

type SortKey = StatColumnKey;
type Basis = 'averages' | 'totals';

const POSITIONS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'] as const;

const chip = (active: boolean) =>
  `shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all active:scale-[0.98] ${
    active
      ? 'border-foreground bg-foreground text-background shadow-sm'
      : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
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
  const makePick = useMakePickForSlot(seasonId ?? '');
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
  const paused = settings?.status === 'paused';

  const filtered = useMemo(() => {
    if (!players) return [];
    const q = search.trim().toLowerCase();
    let pool = players;
    if (position !== 'All') {
      // positions are comma-joined sets ("PF,C"); legacy rows may still hold
      // the coarse G/F/ALL buckets from the old roster-bio import
      pool = pool.filter((p) => {
        const tokens = (p.position ?? '').split(',').map((t) => t.trim());
        return (
          tokens.includes(position) ||
          tokens.includes('ALL') ||
          ((position === 'PG' || position === 'SG') && tokens.includes('G')) ||
          ((position === 'SF' || position === 'PF') && tokens.includes('F'))
        );
      });
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

  const activeSortLabel = STAT_COLUMNS.find((c) => c.key === sortKey)?.label ?? sortKey;

  return (
    <div className="mx-auto max-w-7xl space-y-3 px-0 py-3 sm:px-4 md:space-y-4 md:p-6">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Player Pool</h1>
        <div className="flex items-center gap-2">
          <RealtimeBadge />
        </div>
      </div>

      {nextPick && (settings?.status === 'running' || paused) && (
        <Card className={`mx-4 overflow-hidden sm:mx-0 ${isMyTurn ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`}>
          <CardContent className="flex items-center gap-3 py-3">
            <Badge variant="outline" className="shrink-0 text-xs">
              #{nextPick.pick_number}
            </Badge>
            <span className="line-clamp-1 min-w-0 flex-1 text-sm font-semibold">{teamName(nextPick.team_id)}</span>
            <span className={`shrink-0 text-xs font-bold uppercase tracking-wide ${isMyTurn ? 'text-primary' : 'text-muted-foreground'}`}>
              {paused ? 'Paused' : isMyTurn ? 'Your pick' : 'On clock'}
            </span>
          </CardContent>
        </Card>
      )}

      {paused && (
        <p className="mx-4 rounded-md border bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground sm:mx-0">
          The draft is paused. You can keep scouting, but player selection is locked until the commissioner resumes.
        </p>
      )}

      {queued.length > 0 && (
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
            {POSITIONS.map((pos) => (
              <button key={pos} onClick={() => setPosition(pos)} className={chip(position === pos)}>
                {pos}
              </button>
            ))}
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

      <section className="overflow-hidden border-y bg-card sm:rounded-xl sm:border">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide">Available</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {filtered.length} players · sorted by {activeSortLabel}
            </div>
          </div>
          <div className="flex overflow-hidden rounded-full border bg-background">
            {(['averages', 'totals'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBasis(b)}
                aria-pressed={basis === b}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors active:scale-[0.98] ${
                  basis === b ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {b === 'averages' ? 'AVG' : 'TOTAL'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-1 p-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No players found.</p>
        ) : (
          <div className="max-h-[calc(100dvh-17rem)] overflow-auto sm:max-h-[68vh]">
            <table className="w-full min-w-[46rem] border-collapse text-sm sm:min-w-[60rem]">
              <thead className="sticky top-0 z-30 bg-card shadow-[0_1px_0_0_var(--border)]">
                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="sticky left-0 z-40 w-[13rem] bg-card px-3 py-2 text-left font-bold sm:w-[17rem] sm:px-4">Players</th>
                  {STAT_COLUMNS.map((c) => (
                    <th key={c.key} className="min-w-[3.4rem] px-2 py-2 text-right font-bold">
                      <button
                        onClick={() => setSortKey(c.key)}
                        className={`min-h-8 min-w-8 rounded-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sortKey === c.key ? 'text-primary' : ''}`}
                      >
                        {c.label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, index) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={`cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50 active:bg-muted ${index % 2 ? 'bg-muted/[0.18]' : ''}`}
                  >
                    <td className={`sticky left-0 z-20 px-3 py-2 shadow-[6px_0_12px_-12px_hsl(var(--foreground))] sm:px-4 ${index % 2 ? 'bg-muted/[0.18]' : 'bg-card'} hover:bg-muted/50`}>
                      <div className="flex min-w-0 items-center gap-3">
                        <PlayerHeadshot espnId={p.espn_id} name={p.name} size={38} variant="bare" />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="line-clamp-1 font-semibold leading-tight">{p.name}</span>
                            {isRookie(p) && (
                              <Badge variant="outline" className="shrink-0 border-primary/40 px-1 py-0 text-[9px] text-primary">
                                R
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                            {p.nba_team ?? 'FA'} · {p.position ?? '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    {STAT_COLUMNS.map((c) => (
                      <td key={c.key} className={`whitespace-nowrap px-2 py-3 text-right text-xs tabular-nums ${sortKey === c.key ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
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
        onOpenChange={(o) => !o && setSelected(null)}
        basis={basis}
        canPick={canPick && !!nextPick && !!selected && !queuedIds.has(selected.id)}
        picking={makePick.isPending}
        pickNumber={nextPick?.pick_number}
        onPick={() =>
          selected && nextPick &&
          makePick.mutate(
            {
              pickId: nextPick.id,
              pickNumber: nextPick.pick_number,
              playerId: selected.id,
              playerName: selected.name,
            },
            { onSettled: () => setSelected(null) },
          )
        }
      />
    </div>
  );
}
