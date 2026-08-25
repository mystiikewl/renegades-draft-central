import { useMemo, useState } from 'react';
import { usePlayerPool, useActiveSeason } from '@/api/queries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { parseStats } from '@/lib/stats';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { PlayerStatsDialog } from '@/components/player/PlayerStatsDialog';
import type { PlayerWithStats } from '@/api/types';

type SortKey = 'rank' | 'pts' | 'reb' | 'ast' | 'tp' | 'stl' | 'blk' | 'gp';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'rank', label: 'Rank' },
  { key: 'gp', label: 'GP' },
  { key: 'pts', label: 'PPG' },
  { key: 'reb', label: 'RPG' },
  { key: 'ast', label: 'APG' },
  { key: 'stl', label: 'SPG' },
  { key: 'blk', label: 'BPG' },
  { key: 'tp', label: '3PM' },
];

const POSITIONS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'] as const;

export function PlayerPoolPage() {
  const { data: season } = useActiveSeason();
  const { data: players, isLoading } = usePlayerPool(season?.id);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>('All');
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
    if (q) {
      pool = pool.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nba_team ?? '').toLowerCase().includes(q),
      );
    }
    return [...pool].sort((a, b) => {
      if (sortKey === 'rank') {
        const ra = a.player_seasons[0]?.stats?.rank ?? Infinity;
        const rb = b.player_seasons[0]?.stats?.rank ?? Infinity;
        return ra - rb;
      }
      const statMap: Record<Exclude<SortKey, 'rank'>, string> = {
        gp: 'games_played', pts: 'points', reb: 'total_rebounds', ast: 'assists',
        stl: 'steals', blk: 'blocks', tp: 'three_pointers_made',
      };
      const va = Number(a.player_seasons[0]?.stats?.[statMap[sortKey]] ?? 0);
      const vb = Number(b.player_seasons[0]?.stats?.[statMap[sortKey]] ?? 0);
      return vb - va;
    });
  }, [players, search, position, sortKey]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Player Pool</h1>
        <p className="text-sm text-muted-foreground">
          Full NBA player list with {season?.label ?? ''} season averages. Make picks from the
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
            <button
              key={pos}
              onClick={() => setPosition(pos)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                position === pos
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {filtered.length} players
        </span>
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
                    <th className="px-4 py-2.5 font-semibold">Player</th>
                    <th className="px-2 py-2.5 font-semibold">Pos</th>
                    <th className="px-2 py-2.5 font-semibold">Team</th>
                    {COLUMNS.map((c) => (
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
                  {filtered.map((p) => {
                    const s = parseStats(p.player_seasons[0]?.stats);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-4 py-2 font-medium">
                          <span className="flex items-center gap-2">
                            <PlayerHeadshot espnId={p.espn_id} name={p.name} />
                            {p.name}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {p.position ?? '—'}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">{p.nba_team ?? '—'}</td>
                        <td className="px-2 py-2 text-right tnum text-muted-foreground">{s.rank}</td>
                        {(['gp', 'pts', 'reb', 'ast', 'stl', 'blk', 'tp'] as const).map((k) => (
                          <td key={k} className="px-2 py-2 text-right tnum">
                            {s[k]}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
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
      />
    </div>
  );
}
