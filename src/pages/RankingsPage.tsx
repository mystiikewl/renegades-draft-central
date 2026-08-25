import { useEffect, useMemo, useState } from 'react';
import { usePlayerPool, useActiveSeason } from '@/api/queries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { parseStats } from '@/lib/stats';
import { zScores, type Category } from '@/lib/projections';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import type { PlayerWithStats } from '@/api/types';

/** ponytail: counting cats only — pct cats need game-weighted z handling, add if asked */
const CATS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tp'] as const;
type Cat = Extract<Category, (typeof CATS)[number]>;

const LABELS: Record<Cat, string> = {
  pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', tp: '3PM',
};
const DEFAULT_WEIGHTS: Record<Cat, number> = { pts: 1, reb: 1, ast: 1, stl: 1, blk: 1, tp: 1 };

function loadWeights(seasonId?: string): Record<Cat, number> {
  try {
    const raw = seasonId ? localStorage.getItem(`rankings:${seasonId}`) : null;
    return raw ? { ...DEFAULT_WEIGHTS, ...JSON.parse(raw) } : DEFAULT_WEIGHTS;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

export function RankingsPage() {
  const { data: season } = useActiveSeason();
  const { data: players, isLoading } = usePlayerPool(season?.id);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<Cat | 'composite'>('composite');
  const [weights, setWeights] = useState<Record<Cat, number>>(DEFAULT_WEIGHTS);

  // load saved weights once the season id is known; persist per season on change
  useEffect(() => {
    if (!season?.id) return;
    setWeights(loadWeights(season.id));
  }, [season?.id]);

  const zByCat = useMemo(() => {
    const map = {} as Record<Cat, Map<string, number>>;
    if (!players) return map;
    for (const cat of CATS) map[cat] = zScores(players, cat);
    return map;
  }, [players]);

  const rows = useMemo(() => {
    if (!players) return [];
    const q = search.trim().toLowerCase();
    const wSum = CATS.reduce((s, c) => s + weights[c], 0);
    let pool = q
      ? players.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.nba_team ?? '').toLowerCase().includes(q),
        )
      : players;
    const scored = pool.map((p) => {
      const zs = {} as Record<Cat, number>;
      for (const c of CATS) zs[c] = zByCat[c]?.get(p.id) ?? 0;
      const composite =
        wSum > 0 ? CATS.reduce((s, c) => s + zs[c] * weights[c], 0) / wSum : 0;
      return { player: p, zs, composite };
    });
    return scored.sort((a, b) =>
      sortKey === 'composite' ? b.composite - a.composite : b.zs[sortKey] - a.zs[sortKey],
    );
  }, [players, search, weights, sortKey, zByCat]);

  const setWeight = (cat: Cat, v: number) => {
    const next = { ...weights, [cat]: v };
    setWeights(next);
    if (season?.id) localStorage.setItem(`rankings:${season.id}`, JSON.stringify(next));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Rankings</h1>
        <p className="text-sm text-muted-foreground">
          Z-score rankings over the {season?.label ?? ''} player pool. Tune the category
          weights to get your own composite ranking.
        </p>
      </div>

      {/* Weight sliders */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATS.map((cat) => (
            <label key={cat} className="space-y-1 text-xs font-medium text-muted-foreground">
              <span className="flex justify-between">
                {LABELS[cat]}
                <span className="tabular-nums">{weights[cat]}</span>
              </span>
              <input
                type="range"
                min={0}
                max={5}
                step={1}
                value={weights[cat]}
                onChange={(e) => setWeight(cat, Number(e.target.value))}
                className="w-full accent-primary"
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name or team…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {rows.length} players
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
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No players found.</p>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-semibold">#</th>
                    <th className="px-2 py-2.5 font-semibold">Player</th>
                    <th className="px-2 py-2.5 font-semibold">Pos</th>
                    <th className="px-2 py-2.5 text-right font-semibold">
                      <button
                        onClick={() => setSortKey('composite')}
                        className={`hover:text-foreground ${sortKey === 'composite' ? 'text-primary' : ''}`}
                      >
                        Score
                      </button>
                    </th>
                    {CATS.map((cat) => (
                      <th key={cat} className="px-2 py-2.5 text-right font-semibold">
                        <button
                          onClick={() => setSortKey(cat)}
                          className={`hover:text-foreground ${sortKey === cat ? 'text-primary' : ''}`}
                        >
                          {LABELS[cat]}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const s = parseStats(r.player.player_seasons[0]?.stats);
                    return (
                      <tr
                        key={r.player.id}
                        className={`border-b border-border/50 last:border-0 hover:bg-muted/40 ${
                          sortKey === 'composite' && i < 12 ? 'bg-primary/[0.04]' : ''
                        }`}
                      >
                        <td className="px-4 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-2 font-medium">
                          <span className="flex items-center gap-2">
                            <PlayerHeadshot espnId={r.player.espn_id} name={r.player.name} />
                            {r.player.name}
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {s.gp != null && `${s.gp}gp`}
                            </span>
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {r.player.position ?? '—'}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">
                          {r.composite.toFixed(2)}
                        </td>
                        {CATS.map((c) => (
                          <td key={c} className="px-2 py-2 text-right tnum text-muted-foreground">
                            {r.zs[c].toFixed(2)}
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
    </div>
  );
}
