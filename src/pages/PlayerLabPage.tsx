import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Eye, Sparkles, Swords, Target } from 'lucide-react';
import { useActiveSeason, useStatsEnrichedPlayers } from '@/api/queries';
import { useFavouriteIds } from '@/api/favourites';
import type { PlayerWithStats } from '@/api/types';
import { CategoryMarketPanel } from '@/components/player/CategoryMarketPanel';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { PlayerSearch } from '@/components/player/PlayerSearch';
import { PlayerSwitcherBar } from '@/components/player/PlayerSwitcherBar';
import { TeamImpactPanel } from '@/components/player/TeamImpactPanel';
import { WatchlistStar } from '@/components/player/WatchlistStar';
import { Badge } from '@/components/ui/badge';
import { readFocusedPlayer, rememberFocusedPlayer } from '@/lib/analysisNavigation';
import { buildPlayerShapes, closestShapeMatches, shapeSimilarity, type PlayerShape } from '@/lib/playerShape';

export function PlayerLabPage() {
  const { data: season } = useActiveSeason();
  const { data: allPlayers = [], isLoading } = useStatsEnrichedPlayers(season?.id);
  const players = useMemo(() => allPlayers.filter((p) => p.player_seasons.length > 0), [allPlayers]);
  const [selectedId, setSelectedId] = useState<string | null>(() => readFocusedPlayer());
  const [compareId, setCompareId] = useState<string | null>(null);

  // Sticky switcher bar: appears once the header (with its big search) is
  // scrolled away; "/" focuses whichever search is on screen.
  const headerRef = useRef<HTMLElement>(null);
  const headerSearchInputRef = useRef<HTMLInputElement>(null);
  const switcherInputRef = useRef<HTMLInputElement>(null);
  const [switcherVisible, setSwitcherVisible] = useState(false);
  useEffect(() => {
    const sentinel = headerRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setSwitcherVisible(!entry.isIntersecting),
      // Appear once the header clears the tool nav + switcher bar height.
      { rootMargin: '-96px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== '/' || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      event.preventDefault();
      (switcherVisible ? switcherInputRef.current : headerSearchInputRef.current)?.focus();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [switcherVisible]);

  const shapes = useMemo(() => buildPlayerShapes(players), [players]);
  const initialPlayer = useMemo(
    () => [...players].sort(
      (a, b) =>
        (shapes.get(b.id)?.overall ?? 0) - (shapes.get(a.id)?.overall ?? 0) ||
        a.name.localeCompare(b.name),
    )[0] ?? null,
    [players, shapes],
  );
  const selected = players.find((player) => player.id === selectedId) ?? initialPlayer;
  const comparison = players.find((player) => player.id === compareId) ?? null;
  const selectedShape = selected ? shapes.get(selected.id) ?? null : null;
  const compareShape = comparison ? shapes.get(comparison.id) ?? null : null;
  const favouriteIds = useFavouriteIds(season?.id);

  // Compare list: watched players pinned under their own group, not duplicated.
  const [watchedCompare, restCompare] = useMemo(() => {
    const eligible = players.filter((player) => player.id !== selected?.id);
    return [
      eligible.filter((player) => favouriteIds.has(player.id)),
      eligible.filter((player) => !favouriteIds.has(player.id)),
    ];
  }, [players, selected?.id, favouriteIds]);

  const matches = selected
    ? closestShapeMatches(selected.id, shapes, 5)
        .map((match) => ({ ...match, player: players.find((player) => player.id === match.playerId) }))
        .filter((match): match is typeof match & { player: PlayerWithStats } => !!match.player)
    : [];

  function selectPlayer(id: string) {
    setSelectedId(id);
    setCompareId(null);
    rememberFocusedPlayer(id);
  }

  if (isLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground">Loading Player Lab…</div>;
  }
  if (!selected || !selectedShape) {
    return <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground">No player data available.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 md:py-6">
      <header ref={headerRef} className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <Target className="size-3.5" /> Player Lab
          </div>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-4xl">Player Shape</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Visualise fantasy strengths, compare profiles and carry a player directly into the Decision Board or Team Builder.
          </p>
        </div>
        <div className="w-full space-y-2 lg:max-w-md">
          <PlayerSearch players={players} onPick={selectPlayer} inputRef={headerSearchInputRef} />
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/analysis"
              className="flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
            >
              Decision Board <ArrowRight className="size-3.5" />
            </Link>
            <Link
              to="/team-builder"
              onClick={() => rememberFocusedPlayer(selected.id)}
              className="flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
            >
              Test this player <Sparkles className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {switcherVisible && (
        <PlayerSwitcherBar player={selected} pool={players} onPick={selectPlayer} inputRef={switcherInputRef} />
      )}

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.65fr)]">
          <div className="relative min-h-[34rem] overflow-hidden border-b p-4 lg:border-b-0 lg:border-r lg:p-6">
            <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:32px_32px]" />
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  {selected.nba_team ?? 'FA'} · {selected.position ?? '—'}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-black leading-none sm:text-5xl">{selected.name}</h2>
                  <WatchlistStar playerId={selected.id} playerName={selected.name} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedShape.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="uppercase tracking-wide">{tag}</Badge>
                  ))}
                </div>
              </div>
              <PlayerHeadshot espnId={selected.espn_id} name={selected.name} size={112} variant="bare" />
            </div>

            <div className="relative z-10 mt-6">
              <Radar shape={selectedShape} comparison={compareShape} />
            </div>
          </div>

          <aside className="space-y-5 p-4 lg:p-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Player profile</div>
              <div className="mt-4 text-xs font-black uppercase tracking-[0.12em]">Draft edges</div>
              <div className="mt-1 space-y-1">
                {selectedShape.strongest.map((metric) => (
                  <MetricRow key={metric.key} metric={metric} tone="strong" />
                ))}
              </div>
              <div className="mt-4 text-xs font-black uppercase tracking-[0.12em]">Build risks</div>
              <div className="mt-1 space-y-1">
                {selectedShape.weakest.map((metric) => (
                  <MetricRow key={metric.key} metric={metric} tone="weak" />
                ))}
              </div>
              <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
                Ranks use projected season totals within this projection pool. FG% and FT% rank shooting impact, including volume—not raw percentage.
              </p>
            </div>

            <div className="border-t pt-5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <Swords className="size-3.5" /> Compare
              </div>
              <select
                value={compareId ?? ''}
                onChange={(event) => setCompareId(event.target.value || null)}
                className="mt-3 h-11 w-full rounded-xl border bg-background px-3 text-sm"
              >
                <option value="">Select another player</option>
                {watchedCompare.length > 0 && (
                  <optgroup label="★ Watchlist">
                    {watchedCompare.map((player) => (
                      <option key={player.id} value={player.id}>{player.name}</option>
                    ))}
                  </optgroup>
                )}
                {restCompare.map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
              {comparison && compareShape && (
                <div className="mt-3 rounded-xl border bg-muted/20 p-3">
                  <div className="text-sm font-bold">{comparison.name}</div>
                  <div className="mt-1 text-3xl font-black tabular-nums">{shapeSimilarity(selectedShape, compareShape)}%</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">shape match</div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      <TeamImpactPanel candidate={selected} pool={players} />

      <CategoryMarketPanel candidate={selected} pool={players} />

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2"><Sparkles className="size-4" /><h2 className="font-bold">Similar player shapes</h2></div>
        <p className="mt-1 text-xs text-muted-foreground">Closest fantasy profiles by eight-axis percentile shape.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-5" data-testid="similar-matches">
          {matches.map(({ player, similarity }) => {
            const shape = shapes.get(player.id);
            return (
              <div key={player.id} className="relative rounded-xl border p-3 transition-colors hover:bg-muted/40">
                <button
                  type="button"
                  onClick={() => setCompareId(player.id)}
                  aria-label={`Compare ${player.name}`}
                  className="block w-full text-left"
                >
                  <div className="flex items-center gap-2 pr-7">
                    <PlayerHeadshot espnId={player.espn_id} name={player.name} size={40} variant="bare" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{player.name}</div>
                      <div className="text-[10px] text-muted-foreground">{player.nba_team ?? 'FA'} · {player.position ?? '—'}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-black tabular-nums">{similarity}%</div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">match</div>
                  {shape && (
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      Best: <span className="font-bold text-foreground">{shape.strongest[0]?.shortLabel}</span>
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => selectPlayer(player.id)}
                  aria-label={`View ${player.name}`}
                  title="Set as main player"
                  className="absolute right-2 top-2 rounded-lg border bg-background p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Eye className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Radar({ shape, comparison }: { shape: PlayerShape; comparison: PlayerShape | null }) {
  const size = 520;
  const center = size / 2;
  const radius = 178;
  const pointsFor = (target: PlayerShape) => target.metrics.map((metric, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / target.metrics.length);
    const r = radius * (metric.percentile / 100);
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
  }).join(' ');
  const ring = (ratio: number) => shape.metrics.map((_, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / shape.metrics.length);
    return `${center + Math.cos(angle) * radius * ratio},${center + Math.sin(angle) * radius * ratio}`;
  }).join(' ');

  return (
    <div className="mx-auto max-w-[42rem]">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full" role="img" aria-label="Player fantasy percentile radar">
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <polygon key={ratio} points={ring(ratio)} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth="1" />
        ))}
        {shape.metrics.map((metric, index) => {
          const angle = -Math.PI / 2 + index * (Math.PI * 2 / shape.metrics.length);
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          const labelX = center + Math.cos(angle) * (radius + 48);
          const labelY = center + Math.sin(angle) * (radius + 48);
          return (
            <g key={metric.key}>
              <line x1={center} y1={center} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.08} />
              <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" className="fill-current text-[13px] font-black">{metric.shortLabel}</text>
              <text x={labelX} y={labelY + 16} textAnchor="middle" className="fill-current text-[9px] opacity-60">#{metric.rank} of {metric.poolSize}</text>
            </g>
          );
        })}
        <polygon points={pointsFor(shape)} fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeWidth="4" className="text-primary" />
        {comparison && (
          <polygon points={pointsFor(comparison)} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="8 7" className="text-foreground" opacity={0.75} />
        )}
      </svg>
    </div>
  );
}

function MetricRow({ metric, tone }: { metric: PlayerShape['metrics'][number]; tone: 'strong' | 'weak' }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0">
      <div>
        <div className="text-sm font-bold">{metric.label}</div>
        <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">{metric.draftRead}</div>
      </div>
      <div className="text-right">
        <div className={tone === 'strong' ? 'text-sm font-black text-primary' : 'text-sm font-black text-foreground'}>
          #{metric.rank} of {metric.poolSize}
        </div>
        <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{metric.percentile}th percentile</div>
      </div>
    </div>
  );
}
