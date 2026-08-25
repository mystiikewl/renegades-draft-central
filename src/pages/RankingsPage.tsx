import { useEffect, useMemo, useState } from 'react';
import { usePlayerPool, useActiveSeason } from '@/api/queries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { isRookie } from '@/lib/stats';
import { zScores, LEAGUE_CATEGORIES, type Basis, type Category } from '@/lib/projections';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';

/** The league's 13 ROTO categories, in standings order. */
const CATS = LEAGUE_CATEGORIES;
type Cat = Category;

const LABELS: Record<Cat, string> = {
  fgm: 'FGM', fgPct: 'FG%', ftPct: 'FT%', tp: '3PM', tpPct: '3P%', reb: 'REB',
  ast: 'AST', stl: 'STL', blk: 'BLK', to: 'TO', dd: 'DD', td: 'TD', pts: 'PTS',
};
const DEFAULT_WEIGHTS: Record<Cat, number> = {
  fgm: 1, fgPct: 1, ftPct: 1, tp: 1, tpPct: 1, reb: 1, ast: 1, stl: 1,
  blk: 1, to: 1, dd: 1, td: 1, pts: 1,
};

function loadWeights(seasonId?: string): Record<Cat, number> {
  try {
    const raw = seasonId ? localStorage.getItem(`rankings:${seasonId}`) : null;
    return raw ? { ...DEFAULT_WEIGHTS, ...JSON.parse(raw) } : DEFAULT_WEIGHTS;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

function loadBasis(seasonId?: string): Basis {
  try {
    const raw = seasonId ? localStorage.getItem(`rankings:${seasonId}:basis`) : null;
    return raw === 'averages' || raw === 'totals' ? raw : 'totals';
  } catch {
    return 'totals';
  }
}

const chip = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
  }`;

export function RankingsPage() {
  const { data: season } = useActiveSeason();
  const { data: players, isLoading } = usePlayerPool(season?.id);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<Cat | 'composite'>('composite');
  const [weights, setWeights] = useState<Record<Cat, number>>(DEFAULT_WEIGHTS);
  const [basis, setBasis] = useState<Basis>('totals');
  const [rookiesOnly, setRookiesOnly] = useState(false);

  // load saved weights/basis once the season id is known; persist per season on change
  useEffect(() => {
    if (!season?.id) return;
    setWeights(loadWeights(season.id));
    setBasis(loadBasis(season.id));
  }, [season?.id]);

  const zByCat = useMemo(() => {
    const map = {} as Record<Cat, Map<string, number>>;
    if (!players) return map;
    for (const cat of CATS) map[cat] = zScores(players, cat, basis);
    return map;
  }, [players, basis]);

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
    if (rookiesOnly) pool = pool.filter(isRookie);
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
  }, [players, search, rookiesOnly, weights, sortKey, zByCat]);

  const setWeight = (cat: Cat, v: number) => {
    const next = { ...weights, [cat]: v };
    setWeights(next);
    if (season?.id) localStorage.setItem(`rankings:${season.id}`, JSON.stringify(next));
  };

  const changeBasis = (b: Basis) => {
    setBasis(b);
    if (season?.id) localStorage.setItem(`rankings:${season.id}:basis`, b);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Rankings</h1>
        <p className="text-sm text-muted-foreground">
          Z-score rankings over the {season?.label ?? ''} player pool, valued on{' '}
          {basis === 'totals' ? "last season's totals (ROTO)" : 'per-game averages'}. Tune the
          category weights to get your own composite ranking.
        </p>
      </div>

      {/* Weight sliders */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
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
        <button
          onClick={() => setRookiesOnly((v) => !v)}
          aria-pressed={rookiesOnly}
          className={chip(rookiesOnly)}
        >
          Rookies
        </button>
        <span className="ml-auto flex items-center gap-3">
          <span className="text-sm tabular-nums text-muted-foreground">{rows.length} players</span>
          <span className="flex overflow-hidden rounded-md border">
            {(['totals', 'averages'] as const).map((b) => (
              <button
                key={b}
                onClick={() => changeBasis(b)}
                aria-pressed={basis === b}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  basis === b ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted/60'
                }`}
              >
                {b === 'totals' ? 'Totals' : 'Avg'}
              </button>
            ))}
          </span>
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
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="sticky left-0 z-20 bg-card px-4 py-2.5 font-semibold">#</th>
                    <th className="sticky left-12 z-20 bg-card px-2 py-2.5 font-semibold">Player</th>
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
                  {rows.map((r, i) => (
                    <tr
                      key={r.player.id}
                      className={`border-b border-border/50 last:border-0 hover:bg-muted/40 ${
                        sortKey === 'composite' && i < 12 ? 'bg-primary/[0.04]' : ''
                      }`}
                    >
                      <td className="sticky left-0 z-10 bg-card px-4 py-2 tabular-nums text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="sticky left-12 z-10 bg-card px-2 py-2 font-medium shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.15)] hover:bg-muted/40">
                        <span className="flex items-center gap-2">
                          <span className="hidden sm:inline-flex">
                            <PlayerHeadshot espnId={r.player.espn_id} name={r.player.name} />
                          </span>
                          {r.player.name}
                          {isRookie(r.player) && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-primary border-primary/40">
                              ROOK
                            </Badge>
                          )}
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
                        <td key={c} className="whitespace-nowrap px-2 py-2 text-right tnum text-muted-foreground">
                          {r.zs[c].toFixed(2)}
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
    </div>
  );
}
