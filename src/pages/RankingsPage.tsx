import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { usePlayerPool, useActiveSeason } from '@/api/queries';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { isRookie } from '@/lib/stats';
import { zScores, LEAGUE_CATEGORIES, type Basis, type Category } from '@/lib/projections';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';

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
  `shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all active:scale-[0.98] ${
    active
      ? 'border-foreground bg-foreground text-background shadow-sm'
      : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;

export function RankingsPage() {
  const { data: season } = useActiveSeason();
  const { data: players, isLoading } = usePlayerPool(season?.id);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<Cat | 'composite'>('composite');
  const [weights, setWeights] = useState<Record<Cat, number>>(DEFAULT_WEIGHTS);
  const [basis, setBasis] = useState<Basis>('totals');
  const [rookiesOnly, setRookiesOnly] = useState(false);
  const [showWeights, setShowWeights] = useState(false);

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

  const sortLabel = sortKey === 'composite' ? 'Score' : LABELS[sortKey];

  return (
    <div className="mx-auto max-w-7xl space-y-3 px-0 py-3 sm:px-4 md:space-y-4 md:p-6">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Rankings</h1>
        <Badge variant="outline" className="font-mono text-[10px]">{basis === 'totals' ? 'TOTAL' : 'AVG'}</Badge>
      </div>

      <div className="border-y bg-card/70 py-3 sm:rounded-xl sm:border">
        <div className="flex items-center gap-2 px-4 sm:px-3">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search players or teams"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-full bg-muted/60 pl-9"
            />
          </div>
          <button
            type="button"
            aria-expanded={showWeights}
            onClick={() => setShowWeights((v) => !v)}
            className={`flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors active:scale-[0.98] ${
              showWeights ? 'border-foreground bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="size-4" />
            <span className="sr-only">Category weights</span>
          </button>
        </div>

        <div className="mt-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-3">
          <div className="flex w-max items-center gap-2">
            <button onClick={() => setRookiesOnly((v) => !v)} aria-pressed={rookiesOnly} className={chip(rookiesOnly)}>
              Rookies
            </button>
            <div className="flex overflow-hidden rounded-full border bg-background">
              {(['totals', 'averages'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => changeBasis(b)}
                  aria-pressed={basis === b}
                  className={`px-3.5 py-2 text-xs font-semibold transition-colors active:scale-[0.98] ${
                    basis === b ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {b === 'totals' ? 'Totals' : 'Avg'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {showWeights && (
          <div className="mt-3 border-t px-4 pt-3 sm:px-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-7">
              {CATS.map((cat) => (
                <label key={cat} className="space-y-1 text-[11px] font-medium text-muted-foreground">
                  <span className="flex items-center justify-between gap-2">
                    <span>{LABELS[cat]}</span>
                    <span className="font-mono text-foreground">{weights[cat]}</span>
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
            </div>
          </div>
        )}
      </div>

      <section className="overflow-hidden border-y bg-card sm:rounded-xl sm:border">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide">Ranked players</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{rows.length} players · sorted by {sortLabel}</div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-1 p-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No players found.</p>
        ) : (
          <div className="max-h-[calc(100dvh-15rem)] overflow-auto sm:max-h-[72vh]">
            <table className="w-full min-w-[48rem] border-collapse text-sm sm:min-w-[64rem]">
              <thead className="sticky top-0 z-30 bg-card shadow-[0_1px_0_0_var(--border)]">
                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="sticky left-0 z-40 w-[15rem] bg-card px-3 py-2 text-left font-bold sm:w-[19rem] sm:px-4">Player</th>
                  <th className="min-w-[4.5rem] px-2 py-2 text-right font-bold">
                    <button onClick={() => setSortKey('composite')} className={sortKey === 'composite' ? 'text-primary' : ''}>Score</button>
                  </th>
                  {CATS.map((cat) => (
                    <th key={cat} className="min-w-[3.7rem] px-2 py-2 text-right font-bold">
                      <button onClick={() => setSortKey(cat)} className={sortKey === cat ? 'text-primary' : ''}>{LABELS[cat]}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.player.id} className={`border-b border-border/50 transition-colors hover:bg-muted/50 ${i % 2 ? 'bg-muted/[0.18]' : ''}`}>
                    <td className={`sticky left-0 z-20 px-3 py-2 shadow-[6px_0_12px_-12px_hsl(var(--foreground))] sm:px-4 ${i % 2 ? 'bg-muted/[0.18]' : 'bg-card'} hover:bg-muted/50`}>
                      <div className="flex items-center gap-3">
                        <span className="w-6 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                        <PlayerHeadshot espnId={r.player.espn_id} name={r.player.name} size={38} variant="bare" />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="line-clamp-1 font-semibold leading-tight">{r.player.name}</span>
                            {isRookie(r.player) && (
                              <Badge variant="outline" className="shrink-0 border-primary/40 px-1 py-0 text-[9px] text-primary">R</Badge>
                            )}
                          </div>
                          <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{r.player.nba_team ?? 'FA'} · {r.player.position ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`whitespace-nowrap px-2 py-3 text-right font-bold tabular-nums ${sortKey === 'composite' ? 'text-primary' : ''}`}>{r.composite.toFixed(2)}</td>
                    {CATS.map((c) => (
                      <td key={c} className={`whitespace-nowrap px-2 py-3 text-right text-xs tabular-nums ${sortKey === c ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{r.zs[c].toFixed(2)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
