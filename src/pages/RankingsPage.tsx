import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { usePlayerPool, useActiveSeason } from '@/api/queries';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { rememberFocusedPlayer } from '@/lib/analysisNavigation';
import { STRATEGY_PRESETS, type StrategyKey } from '@/lib/draftIntelligence';
import { isRookie } from '@/lib/stats';
import { matchesSearch } from '@/lib/playerFilters';
import { loadJsonPref, loadStringPref, removePref, saveJsonPref, saveStringPref } from '@/lib/prefs';
import { FilterChip } from '@/components/ui/filter-chip';
import { valueScores, zScores, LEAGUE_CATEGORIES, type Basis, type Category } from '@/lib/projections';
import { CATEGORY_LABELS } from '@/lib/leagueCategories';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { WatchlistStar } from '@/components/player/WatchlistStar';

const CATS = LEAGUE_CATEGORIES;
type Cat = Category;

const DEFAULT_WEIGHTS: Record<Cat, number> = {
  fgm: 1, fgPct: 1, ftPct: 1, tp: 1, tpPct: 1, reb: 1, ast: 1, stl: 1,
  blk: 1, to: 1, dd: 1, td: 1, pts: 1,
};

const weightsKey = (seasonId: string) => `rankings:${seasonId}`;
const basisKey = (seasonId: string) => `rankings:${seasonId}:basis`;
const presetKey = (seasonId: string) => `rankings:${seasonId}:preset`;

function loadWeights(seasonId?: string): Record<Cat, number> {
  return seasonId ? loadJsonPref(weightsKey(seasonId), DEFAULT_WEIGHTS) : DEFAULT_WEIGHTS;
}

function loadBasis(seasonId?: string): Basis {
  const raw = seasonId ? loadStringPref(basisKey(seasonId)) : null;
  return raw === 'averages' || raw === 'totals' ? raw : 'totals';
}

function loadPreset(seasonId?: string): StrategyKey | null {
  const raw = seasonId ? loadStringPref(presetKey(seasonId)) : null;
  return STRATEGY_PRESETS.some((preset) => preset.key === raw) ? raw as StrategyKey : null;
}

export function RankingsPage() {
  const { data: season } = useActiveSeason();
  const { data: players, isLoading } = usePlayerPool(season?.id);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<Cat | 'composite'>('composite');
  const [weights, setWeights] = useState<Record<Cat, number>>(DEFAULT_WEIGHTS);
  const [basis, setBasis] = useState<Basis>('totals');
  const [rookiesOnly, setRookiesOnly] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [activePreset, setActivePreset] = useState<StrategyKey | null>('balanced');

  useEffect(() => {
    if (!season?.id) return;
    setWeights(loadWeights(season.id));
    setBasis(loadBasis(season.id));
    setActivePreset(loadPreset(season.id));
  }, [season?.id]);

  const zByCat = useMemo(() => {
    const map = {} as Record<Cat, Map<string, number>>;
    if (!players) return map;
    for (const cat of CATS) map[cat] = zScores(players, cat, basis);
    return map;
  }, [players, basis]);

  const rows = useMemo(() => {
    if (!players) return [];
    let pool = players.filter((player) => matchesSearch(player, search));
    if (rookiesOnly) pool = pool.filter(isRookie);
    const composites = valueScores(pool, { scoreUniverse: players, weights, basis });
    const scored = pool.map((player) => {
      const categoryScores = {} as Record<Cat, number>;
      for (const cat of CATS) categoryScores[cat] = zByCat[cat]?.get(player.id) ?? 0;
      return { player, zs: categoryScores, composite: composites.get(player.id) ?? 0 };
    });
    return scored.sort((a, b) =>
      sortKey === 'composite' ? b.composite - a.composite : b.zs[sortKey] - a.zs[sortKey],
    );
  }, [players, search, rookiesOnly, weights, sortKey, basis, zByCat]);

  const setWeight = (cat: Cat, value: number) => {
    const next = { ...weights, [cat]: value };
    setWeights(next);
    setActivePreset(null);
    if (season?.id) {
      saveJsonPref(weightsKey(season.id), next);
      removePref(presetKey(season.id));
    }
  };

  const applyPreset = (key: StrategyKey) => {
    const preset = STRATEGY_PRESETS.find((item) => item.key === key);
    if (!preset) return;
    setWeights(preset.weights);
    setActivePreset(key);
    if (season?.id) {
      saveJsonPref(weightsKey(season.id), preset.weights);
      saveStringPref(presetKey(season.id), key);
    }
  };

  const changeBasis = (nextBasis: Basis) => {
    setBasis(nextBasis);
    if (season?.id) saveStringPref(basisKey(season.id), nextBasis);
  };

  const sortLabel = sortKey === 'composite' ? 'Score' : CATEGORY_LABELS[sortKey];

  return (
    <div className="mx-auto max-w-7xl space-y-3 px-0 py-3 sm:px-4 md:space-y-4 md:p-6">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Rankings</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Build a board from a strategy preset, then customise individual categories.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">{basis === 'totals' ? 'TOTAL' : 'AVG'}</Badge>
          <Link to="/analysis" className="hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted sm:flex">
            Decision Board <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="border-y bg-card/70 py-3 sm:rounded-xl sm:border">
        <div className="flex items-center gap-2 px-4 sm:px-3">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search players or teams"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 rounded-full bg-muted/60 pl-9"
            />
          </div>
          <button
            type="button"
            aria-expanded={showWeights}
            onClick={() => setShowWeights((value) => !value)}
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
            <FilterChip active={rookiesOnly} onClick={() => setRookiesOnly((value) => !value)}>
              Rookies
            </FilterChip>
            <div className="flex overflow-hidden rounded-full border bg-background">
              {(['totals', 'averages'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => changeBasis(value)}
                  aria-pressed={basis === value}
                  className={`px-3.5 py-2 text-xs font-semibold transition-colors active:scale-[0.98] ${
                    basis === value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {value === 'totals' ? 'Totals' : 'Avg'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto border-t px-4 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-3">
          <div className="flex w-max gap-2">
            {STRATEGY_PRESETS.map((preset) => (
              <FilterChip
                key={preset.key}
                active={activePreset === preset.key}
                onClick={() => applyPreset(preset.key)}
                title={preset.detail}
              >
                {preset.shortLabel}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="mt-3 overflow-x-auto border-t px-4 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-3">
          <div className="flex w-max items-center gap-1.5">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Sort</span>
            <FilterChip active={sortKey === 'composite'} onClick={() => setSortKey('composite')}>Score</FilterChip>
            {CATS.map((cat) => (
              <FilterChip key={cat} active={sortKey === cat} onClick={() => setSortKey(cat)}>{CATEGORY_LABELS[cat]}</FilterChip>
            ))}
          </div>
        </div>

        {showWeights && (
          <div className="mt-3 border-t px-4 pt-3 sm:px-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-7">
              {CATS.map((cat) => (
                <label key={cat} className="space-y-1 text-[11px] font-medium text-muted-foreground">
                  <span className="flex items-center justify-between gap-2">
                    <span>{CATEGORY_LABELS[cat]}</span>
                    <span className="font-mono text-foreground">{weights[cat]}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={weights[cat]}
                    onChange={(event) => setWeight(cat, Number(event.target.value))}
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
            {Array.from({ length: 12 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No players found.</p>
        ) : (
          <>
            <div className="divide-y sm:hidden">
              {rows.map((row, index) => {
                const strengths = CATS
                  .map((cat) => ({ cat, score: row.zs[cat] }))
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 3);
                return (
                  <div
                    key={row.player.id}
                    className="flex items-start gap-1 py-3 pl-4 pr-2 transition-colors hover:bg-muted/40"
                  >
                    <Link
                      to="/player-lab"
                      onClick={() => rememberFocusedPlayer(row.player.id)}
                      className="flex min-w-0 flex-1 items-start gap-3"
                    >
                      <span className="w-6 shrink-0 pt-2 text-right font-mono text-xs font-bold text-muted-foreground">{index + 1}</span>
                      <PlayerHeadshot espnId={row.player.espn_id} name={row.player.name} size={44} variant="bare" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{row.player.name}</span>
                          {isRookie(row.player) && <Badge variant="outline" className="border-primary/40 px-1 py-0 text-[9px] text-primary">R</Badge>}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{row.player.nba_team ?? 'FA'} · {row.player.position ?? '—'}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {strengths.map(({ cat, score }) => (
                            <Badge key={cat} variant="secondary" className="text-[9px]">{CATEGORY_LABELS[cat]} {score > 0 ? '+' : ''}{score.toFixed(1)}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-black">{row.composite.toFixed(2)}</div>
                        <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">score</div>
                      </div>
                    </Link>
                    <WatchlistStar playerId={row.player.id} playerName={row.player.name} className="mt-1" />
                  </div>
                );
              })}
            </div>

            <div className="hidden max-h-[72vh] overflow-auto sm:block">
              <table className="w-full min-w-[64rem] border-collapse text-sm">
                <thead className="sticky top-0 z-30 bg-card shadow-[0_1px_0_0_var(--border)]">
                  <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="sticky left-0 z-40 w-[19rem] bg-card px-4 py-2 text-left font-bold">Player</th>
                    <th className="min-w-[4.5rem] px-2 py-2 text-right font-bold">
                      <button onClick={() => setSortKey('composite')} className={sortKey === 'composite' ? 'text-primary' : ''}>Score</button>
                    </th>
                    {CATS.map((cat) => (
                      <th key={cat} className="min-w-[3.7rem] px-2 py-2 text-right font-bold">
                        <button onClick={() => setSortKey(cat)} className={sortKey === cat ? 'text-primary' : ''}>{CATEGORY_LABELS[cat]}</button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.player.id} className={`border-b border-border/50 transition-colors hover:bg-muted/50 ${index % 2 ? 'bg-muted/[0.18]' : ''}`}>
                      <td className={`sticky left-0 z-20 px-4 py-2 shadow-[6px_0_12px_-12px_hsl(var(--foreground))] ${index % 2 ? 'bg-muted/[0.18]' : 'bg-card'} hover:bg-muted/50`}>
                        <div className="flex items-center gap-1">
                          <Link
                            to="/player-lab"
                            onClick={() => rememberFocusedPlayer(row.player.id)}
                            className="flex min-w-0 flex-1 items-center gap-3"
                          >
                            <span className="w-6 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-muted-foreground">{index + 1}</span>
                            <PlayerHeadshot espnId={row.player.espn_id} name={row.player.name} size={38} variant="bare" />
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="line-clamp-1 font-semibold leading-tight">{row.player.name}</span>
                                {isRookie(row.player) && (
                                  <Badge variant="outline" className="shrink-0 border-primary/40 px-1 py-0 text-[9px] text-primary">R</Badge>
                                )}
                              </div>
                              <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{row.player.nba_team ?? 'FA'} · {row.player.position ?? '—'}</div>
                            </div>
                          </Link>
                          <WatchlistStar playerId={row.player.id} playerName={row.player.name} />
                        </div>
                      </td>
                      <td className={`whitespace-nowrap px-2 py-3 text-right font-bold tabular-nums ${sortKey === 'composite' ? 'text-primary' : ''}`}>{row.composite.toFixed(2)}</td>
                      {CATS.map((cat) => (
                        <td key={cat} className={`whitespace-nowrap px-2 py-3 text-right text-xs tabular-nums ${sortKey === cat ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{row.zs[cat].toFixed(2)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
