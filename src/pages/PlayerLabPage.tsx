import { useMemo, useState } from 'react';
import { Search, Sparkles, Swords, Target } from 'lucide-react';
import { useActiveSeason } from '@/api/queries';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import type { PlayerWithStats } from '@/api/types';
import { pickStatsSeason } from '@/lib/stats';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { buildPlayerShapes, closestShapeMatches, shapeSimilarity, type PlayerShape } from '@/lib/playerShape';

function usePlayerLabPool(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['player-lab-pool', seasonId ?? 'none'],
    enabled: !!seasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*, player_seasons(season_id, stats, seasons(label))')
        .not('espn_id', 'is', null)
        .order('name');
      if (error) throw error;
      return (data as PlayerWithStats[]).map((player) => {
        const best = pickStatsSeason(player.player_seasons ?? [], seasonId!);
        return { ...player, player_seasons: best ? [best as PlayerWithStats['player_seasons'][number]] : [] };
      }).filter((player) => player.player_seasons.length > 0);
    },
  });
}

export function PlayerLabPage() {
  const { data: season } = useActiveSeason();
  const { data: players = [], isLoading } = usePlayerLabPool(season?.id);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);

  const shapes = useMemo(() => buildPlayerShapes(players), [players]);
  const initialPlayer = players[0] ?? null;
  const selected = players.find((player) => player.id === selectedId) ?? initialPlayer;
  const comparison = players.find((player) => player.id === compareId) ?? null;
  const selectedShape = selected ? shapes.get(selected.id) ?? null : null;
  const compareShape = comparison ? shapes.get(comparison.id) ?? null : null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return players.slice(0, 8);
    return players.filter((player) => `${player.name} ${player.nba_team ?? ''} ${player.position ?? ''}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [players, query]);

  const matches = selected
    ? closestShapeMatches(selected.id, shapes, 5)
        .map((match) => ({ ...match, player: players.find((player) => player.id === match.playerId) }))
        .filter((match): match is typeof match & { player: PlayerWithStats } => !!match.player)
    : [];

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground">Loading Player Lab…</div>;
  if (!selected || !selectedShape) return <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground">No player data available.</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 md:py-6">
      <header className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <Target className="size-3.5" /> Player Lab
          </div>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-4xl">Player Shape</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Visualise fantasy strengths, compare profiles and find similar players across the league pool.</p>
        </div>
        <PlayerSearch players={filtered} query={query} setQuery={setQuery} onPick={(id) => { setSelectedId(id); setCompareId(null); setQuery(''); }} />
      </header>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.65fr)]">
          <div className="relative min-h-[34rem] overflow-hidden border-b p-4 lg:border-b-0 lg:border-r lg:p-6">
            <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:32px_32px]" />
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{selected.nba_team ?? 'FA'} · {selected.position ?? '—'}</div>
                <h2 className="mt-1 text-3xl font-black leading-none sm:text-5xl">{selected.name}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedShape.tags.map((tag) => <Badge key={tag} variant="secondary" className="uppercase tracking-wide">{tag}</Badge>)}
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
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Shape read</div>
              <div className="mt-3 space-y-2">
                {selectedShape.strongest.map((metric) => <MetricRow key={metric.key} label={metric.shortLabel} value={`${metric.percentile}th pct`} tone="strong" />)}
                {selectedShape.weakest.map((metric) => <MetricRow key={metric.key} label={metric.shortLabel} value={`${metric.percentile}th pct`} tone="weak" />)}
              </div>
            </div>

            <div className="border-t pt-5">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"><Swords className="size-3.5" /> Compare</div>
              <select
                value={compareId ?? ''}
                onChange={(event) => setCompareId(event.target.value || null)}
                className="mt-3 h-11 w-full rounded-xl border bg-background px-3 text-sm"
              >
                <option value="">Select another player</option>
                {players.filter((player) => player.id !== selected.id).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
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

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2"><Sparkles className="size-4" /><h2 className="font-bold">Similar player shapes</h2></div>
        <p className="mt-1 text-xs text-muted-foreground">Closest fantasy profiles by eight-axis percentile shape.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-5">
          {matches.map(({ player, similarity }) => {
            const shape = shapes.get(player.id);
            return (
              <button key={player.id} type="button" onClick={() => { setCompareId(player.id); }} className="rounded-xl border p-3 text-left transition-colors hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <PlayerHeadshot espnId={player.espn_id} name={player.name} size={40} variant="bare" />
                  <div className="min-w-0"><div className="truncate text-sm font-bold">{player.name}</div><div className="text-[10px] text-muted-foreground">{player.nba_team ?? 'FA'} · {player.position ?? '—'}</div></div>
                </div>
                <div className="mt-3 text-2xl font-black tabular-nums">{similarity}%</div>
                <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">match</div>
                {shape && <div className="mt-2 text-[10px] text-muted-foreground">Best: <span className="font-bold text-foreground">{shape.strongest[0]?.shortLabel}</span></div>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PlayerSearch({ players, query, setQuery, onPick }: { players: PlayerWithStats[]; query: string; setQuery: (value: string) => void; onPick: (id: string) => void }) {
  return (
    <div className="relative w-full md:max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player…" className="h-11 pl-9" />
      {query && <div className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-xl">
        {players.map((player) => <button key={player.id} type="button" onClick={() => onPick(player.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><PlayerHeadshot espnId={player.espn_id} name={player.name} size={30} variant="bare" /><span>{player.name}</span><span className="ml-auto text-[10px] text-muted-foreground">{player.nba_team ?? 'FA'}</span></button>)}
      </div>}
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
        {[0.25,0.5,0.75,1].map((ratio) => <polygon key={ratio} points={ring(ratio)} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth="1" />)}
        {shape.metrics.map((metric, index) => {
          const angle = -Math.PI / 2 + index * (Math.PI * 2 / shape.metrics.length);
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          const lx = center + Math.cos(angle) * (radius + 48);
          const ly = center + Math.sin(angle) * (radius + 48);
          return <g key={metric.key}><line x1={center} y1={center} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.08} /><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-current text-[13px] font-black">{metric.shortLabel}</text><text x={lx} y={ly + 16} textAnchor="middle" className="fill-current text-[9px] opacity-50">{metric.percentile}TH PCTL</text></g>;
        })}
        <polygon points={pointsFor(shape)} fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeWidth="4" className="text-primary" />
        {comparison && <polygon points={pointsFor(comparison)} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="8 7" className="text-foreground" opacity={0.75} />}
      </svg>
    </div>
  );
}

function MetricRow({ label, value, tone }: { label: string; value: string; tone: 'strong' | 'weak' }) {
  return <div className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0"><span className="font-bold">{label}</span><span className={tone === 'strong' ? 'font-black text-primary' : 'font-bold text-muted-foreground'}>{value}</span></div>;
}
