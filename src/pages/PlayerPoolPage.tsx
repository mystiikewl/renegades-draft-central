import { useMemo, useState } from 'react';
import { usePlayerPool, useActiveSeason } from '@/api/queries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { isRookie, STAT_COLUMNS, statColumnValue, fmtStat, type StatColumnKey } from '@/lib/stats';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { PlayerStatsDialog } from '@/components/player/PlayerStatsDialog';
import type { PlayerWithStats } from '@/api/types';

type SortKey = StatColumnKey;
type Basis = 'averages' | 'totals';

const POSITIONS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'] as const;

const chip = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
  }`;

export function PlayerPoolPage() {
  const { data: season } = useActiveSeason();
  const { data: players, isLoading } = usePlayerPool(season?.id);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>('All');
  const [rookiesOnly, setRookiesOnly] = useState(false);
  const [basis, setBasis] = useState<Basis>('averages');
  const [sortKey, setSortKey] = useState<SortKey>('pts');
  const [selected, setSelected] = useState<PlayerWithStats | null>(null);

  const filtered = useMemo(() => {
    if (!players) return [];
    const q = search.trim().toLowerCase();
    let pool = players;
    if (position !== 'All') {
      pool = pool.filter((p) =>
        p.position === position ||
        // guards can match PG/SG, forwards PF/SF via ESPN's G/F designations
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
      <div>
        <h1 className="text-2xl font-bold">Player Pool</h1>
        <p className="text-sm text-muted-foreground">
          Full NBA player list with {season?.label ?? ''} {basis === 'averages' ? 'per-game averages' : 'season totals'}. Make picks from the
          Draft page when you're on the clock.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name or team…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {POSITIONS.map((pos) => (
            <button key={pos} onClick={() => setPosition(pos)} className={chip(position === pos)}>
              {pos}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setRookiesOnly((v) => !v)}
            aria-pressed={rookiesOnly}
            className={chip(rookiesOnly)}
          >
            Rookies
          </button>
        </div>
        <div className="ml-auto flex overflow-hidden rounded-md border">
          {(['averages', 'totals'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBasis(b)}
              aria-pressed={basis === b}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                basis === b ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted/60'
              }`}
            >
              {b === 'averages' ? 'Avg' : 'Totals'}
            </button>
          ))}
        </div>
      </div>

      <Card>
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
                          className={`hover:text-foreground ${sortKey === c.key ? 'text-primary' : ''}`}
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
                      className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/40"
                    >
                      <td className="sticky left-0 z-10 bg-card px-4 py-2 font-medium shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.15)] hover:bg-muted/40">
                        <span className="flex items-center gap-2">
                          <span className="hidden sm:inline-flex">
                            <PlayerHeadshot espnId={p.espn_id} name={p.name} />
                          </span>
                          {p.name}
                          {isRookie(p) && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-primary border-primary/40">
                              ROOK
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {p.position ?? '—'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{p.nba_team ?? '—'}</td>
                      {STAT_COLUMNS.map((c) => (
                        <td key={c.key} className="whitespace-nowrap px-2 py-2 text-right tnum">
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
      />
    </div>
  );
}
