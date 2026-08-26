import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Save, Settings2, Trash2, X } from 'lucide-react';
import { useActiveSeason, useDraftSettings, usePlayerPool, useRosters } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';
import { SlotPickerDialog } from '@/components/team-builder/SlotPickerDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  baseline,
  categoryTotals,
  impact,
  INVERTED_CATEGORIES,
  LEAGUE_CATEGORIES,
  type Category,
} from '@/lib/projections';
import { parseStats } from '@/lib/stats';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import type { PlayerWithStats } from '@/api/types';

const ALL_CATEGORIES: Category[] = LEAGUE_CATEGORIES;
const DEFAULT_CATEGORIES: Category[] = LEAGUE_CATEGORIES;
const PERCENTAGE_CATEGORIES = new Set<Category>(['fgPct', 'ftPct', 'tpPct']);

const CAT_LABEL: Record<Category, string> = {
  fgm: 'FGM', fgPct: 'FG%', ftPct: 'FT%', tp: '3PM', tpPct: '3P%', reb: 'REB', ast: 'AST',
  stl: 'STL', blk: 'BLK', to: 'TO', dd: 'DD', td: 'TD', pts: 'PTS',
};

interface SavedBuild {
  name: string;
  categories: Category[];
  rounds: number;
  playerIds: string[];
}

function indexById(pool: PlayerWithStats[], rostered: PlayerWithStats[]): Map<string, PlayerWithStats> {
  const map = new Map<string, PlayerWithStats>();
  for (const player of [...rostered, ...pool]) map.set(player.id, player);
  return map;
}

export function TeamBuilderPage() {
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  const { profile } = useAuth();
  const { data: settings } = useDraftSettings(seasonId);
  const { data: pool, isLoading: poolLoading } = usePlayerPool(seasonId);
  const { data: rosters } = useRosters(seasonId);

  const liveRounds = settings ? Math.max(1, settings.roster_size - settings.keeper_limit) : 9;
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [rounds, setRounds] = useState(liveRounds);
  const [picks, setPicks] = useState<(string | null)[] | null>(null);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [buildName, setBuildName] = useState('');
  const [savedBuilds, setSavedBuilds] = useState<SavedBuild[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const buildsKey = seasonId ? `tbuilder:${seasonId}:builds` : null;

  useEffect(() => setRounds(liveRounds), [liveRounds]);

  useEffect(() => {
    if (!buildsKey) return;
    try {
      setSavedBuilds(JSON.parse(localStorage.getItem(buildsKey) ?? '[]'));
    } catch {
      setSavedBuilds([]);
    }
  }, [buildsKey]);

  const rosteredById = useMemo(() => {
    if (!rosters || !profile?.team_id) return new Map<string, PlayerWithStats>();
    return indexById(
      [],
      rosters
        .filter((entry) => entry.team_id === profile.team_id)
        .flatMap((entry) =>
          entry.players && entry.player_id
            ? [{
                id: entry.player_id,
                name: entry.players.name,
                position: entry.players.position,
                nba_team: entry.players.nba_team ?? null,
                espn_id: entry.players.espn_id ?? null,
              }]
            : [],
        )
        .map((player) => ({
          ...player,
          image_url: null,
          created_at: '',
          player_seasons: [],
        })) as PlayerWithStats[],
    );
  }, [rosters, profile?.team_id]);

  const byId = useMemo(() => indexById(pool ?? [], [...rosteredById.values()]), [pool, rosteredById]);

  useEffect(() => {
    if (picks !== null || !rosters || liveRounds < 1) return;
    const mine = profile?.team_id
      ? rosters.filter((entry) => entry.team_id === profile.team_id).map((entry) => entry.player_id)
      : [];
    setPicks([
      ...mine.slice(0, liveRounds),
      ...Array<string | null>(Math.max(0, liveRounds - mine.length)).fill(null),
    ]);
  }, [picks, profile?.team_id, rosters, liveRounds]);

  const teamPlayers = useMemo(() => {
    const list = (picks ?? []).map((id) => (id ? byId.get(id) ?? null : null));
    return list.filter((player): player is PlayerWithStats => player !== null);
  }, [picks, byId]);

  const cats = useMemo(() => ALL_CATEGORIES.filter((cat) => categories.includes(cat)), [categories]);
  const base = useMemo(
    () => baseline(pool ?? [], settings?.league_size ?? 10, cats),
    [pool, settings?.league_size, cats],
  );
  const totals = useMemo(() => categoryTotals(teamPlayers, cats), [teamPlayers, cats]);
  const completion = rounds > 0 ? teamPlayers.length / rounds : 0;
  const paceBase = useMemo(() => {
    const scaled = {} as Record<Category, number>;
    for (const cat of cats) {
      scaled[cat] = PERCENTAGE_CATEGORIES.has(cat) ? base[cat] : base[cat] * completion;
    }
    return scaled;
  }, [base, cats, completion]);

  const balance = useMemo(
    () =>
      cats.map((cat) => {
        const target = paceBase[cat] ?? 0;
        const value = totals[cat] ?? 0;
        const rawDiff = value - target;
        const healthy = INVERTED_CATEGORIES.has(cat) ? rawDiff <= 0 : rawDiff >= 0;
        const magnitude = Math.abs(rawDiff) / Math.max(Math.abs(target), 1);
        return { cat, value, target, rawDiff, healthy, magnitude };
      }),
    [cats, paceBase, totals],
  );

  const strengths = balance.filter((item) => item.healthy).sort((a, b) => b.magnitude - a.magnitude);
  const needsWork = balance.filter((item) => !item.healthy).sort((a, b) => b.magnitude - a.magnitude);

  const impactFor = (candidate: PlayerWithStats) =>
    impact(
      teamPlayers.filter((player) => player.id !== picks?.[pickerSlot ?? -1]),
      candidate,
      base,
      cats,
    );

  function resizeRounds(nextRounds: number) {
    setRounds(nextRounds);
    setPicks((previous) => {
      const current = previous ?? Array(nextRounds).fill(null);
      return nextRounds > current.length
        ? [...current, ...Array(nextRounds - current.length).fill(null)]
        : current.slice(0, nextRounds);
    });
  }

  function saveBuild() {
    if (!buildsKey) return;
    const build: SavedBuild = {
      name: buildName.trim() || `Build ${savedBuilds.length + 1}`,
      categories,
      rounds,
      playerIds: picks?.filter((id): id is string => id !== null) ?? [],
    };
    const next = [...savedBuilds, build];
    localStorage.setItem(buildsKey, JSON.stringify(next));
    setSavedBuilds(next);
    setBuildName('');
  }

  function loadBuild(build: SavedBuild) {
    setCategories(build.categories);
    setRounds(build.rounds);
    setPicks([
      ...build.playerIds.slice(0, build.rounds),
      ...Array<string | null>(Math.max(0, build.rounds - build.playerIds.length)).fill(null),
    ]);
  }

  function deleteBuild(name: string) {
    if (!buildsKey) return;
    const next = savedBuilds.filter((build) => build.name !== name);
    localStorage.setItem(buildsKey, JSON.stringify(next));
    setSavedBuilds(next);
  }

  if (poolLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-3 px-4 py-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-3 px-0 py-3 sm:px-4 md:space-y-4 md:p-6">
      <header className="flex items-start justify-between gap-3 px-4 sm:px-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Team Builder</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{teamPlayers.length}/{rounds} slots filled</p>
        </div>
        <button
          type="button"
          aria-expanded={showSettings}
          onClick={() => setShowSettings((value) => !value)}
          className={`flex size-10 items-center justify-center rounded-full border transition-colors active:scale-[0.98] ${
            showSettings ? 'border-foreground bg-foreground text-background' : 'bg-card text-muted-foreground'
          }`}
        >
          <Settings2 className="size-4" />
          <span className="sr-only">Builder settings</span>
        </button>
      </header>

      {showSettings && (
        <section className="border-y bg-card px-4 py-4 sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Builder settings</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Tune only when your league format differs.</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Slots
              <Input
                type="number"
                min={1}
                max={settings?.roster_size ?? 18}
                value={rounds}
                onChange={(event) =>
                  resizeRounds(Math.max(1, Math.min(settings?.roster_size ?? 18, Number(event.target.value) || 1)))
                }
                className="h-9 w-16"
              />
            </label>
          </div>
          <div className="mt-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-1.5">
              {ALL_CATEGORIES.map((cat) => {
                const active = categories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() =>
                      setCategories((previous) =>
                        previous.includes(cat) ? previous.filter((item) => item !== cat) : [...previous, cat],
                      )
                    }
                    disabled={categories.length === 1 && active}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                      active ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground'
                    }`}
                  >
                    {CAT_LABEL[cat]}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.75fr)]">
        <section className="overflow-hidden border-y bg-card sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="font-bold">Build roster</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Tap a slot to add or replace a player.</p>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">{teamPlayers.length}/{rounds}</Badge>
          </div>

          <div className="divide-y divide-border/50 sm:grid sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
            {(picks ?? []).map((id, index) => {
              const player = id ? byId.get(id) : null;
              const stats = player ? parseStats(player.player_seasons[0]?.stats) : null;
              return (
                <div key={index} className="relative min-h-16 border-border/50 sm:border-b sm:border-r">
                  <button
                    type="button"
                    onClick={() => setPickerSlot(index)}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
                  >
                    <span className="w-7 shrink-0 font-mono text-[10px] font-bold text-muted-foreground">R{index + 1}</span>
                    {player ? (
                      <>
                        <PlayerHeadshot espnId={player.espn_id} name={player.name} size={40} variant="bare" />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-sm font-semibold leading-tight">{player.name}</span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {player.nba_team ?? 'FA'} · {player.position ?? '—'} · {stats?.pts ?? '—'} PTS · {stats?.reb ?? '—'} REB · {stats?.ast ?? '—'} AST
                          </span>
                        </span>
                      </>
                    ) : (
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="text-sm font-semibold">Add player</span>
                        <span className="text-lg text-muted-foreground">+</span>
                      </span>
                    )}
                  </button>
                  {player && (
                    <button
                      type="button"
                      aria-label={`Remove ${player.name}`}
                      onClick={() =>
                        setPicks((previous) => (previous ?? []).map((value, slot) => (slot === index ? null : value)))
                      }
                      className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="space-y-3">
          <section className="overflow-hidden border-y bg-card sm:rounded-2xl sm:border">
            <div className="border-b px-4 py-3">
              <h2 className="font-bold">Category balance</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Compared with average-team pace at {Math.round(completion * 100)}% roster completion.</p>
            </div>

            {teamPlayers.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">Add a player to start analysing the build.</div>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <BalanceGroup title="Strengths" items={strengths.slice(0, 5)} />
                  <BalanceGroup title="Needs work" items={needsWork.slice(0, 5)} />
                </div>

                <button
                  type="button"
                  aria-expanded={showDetails}
                  onClick={() => setShowDetails((value) => !value)}
                  className="mt-4 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted/40"
                >
                  Full category detail
                  <ChevronDown className={`size-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                </button>

                {showDetails && (
                  <div className="mt-3 overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[30rem] text-xs tabular-nums">
                      <thead>
                        <tr className="border-b bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2 text-left">Category</th>
                          <th className="px-3 py-2 text-right">Build</th>
                          <th className="px-3 py-2 text-right">Pace avg</th>
                          <th className="px-3 py-2 text-right">Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balance.map((item) => (
                          <tr key={item.cat} className="border-b last:border-b-0">
                            <td className="px-3 py-2 font-semibold">{CAT_LABEL[item.cat]}{INVERTED_CATEGORIES.has(item.cat) ? ' ↓' : ''}</td>
                            <td className="px-3 py-2 text-right">{formatCategory(item.cat, item.value)}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{formatCategory(item.cat, item.target)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatSigned(item.cat, item.rawDiff)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="overflow-hidden border-y bg-card sm:rounded-2xl sm:border">
            <div className="border-b px-4 py-3">
              <h2 className="font-bold">Saved builds</h2>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Build name"
                  value={buildName}
                  onChange={(event) => setBuildName(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && saveBuild()}
                />
                <Button size="sm" onClick={saveBuild} className="shrink-0 gap-1.5 active:scale-[0.98]">
                  <Save className="size-3.5" /> Save
                </Button>
              </div>

              {savedBuilds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved builds yet.</p>
              ) : (
                <div className="divide-y divide-border/50 rounded-xl border">
                  {savedBuilds.map((build) => (
                    <div key={build.name} className="flex items-center gap-3 px-3 py-2.5">
                      <button type="button" onClick={() => loadBuild(build)} className="min-w-0 flex-1 text-left">
                        <div className="line-clamp-1 text-sm font-semibold">{build.name}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{build.playerIds.length}/{build.rounds} players · {build.categories.length} cats</div>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete build ${build.name}`}
                        onClick={() => deleteBuild(build.name)}
                        className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <SlotPickerDialog
        open={pickerSlot !== null}
        onOpenChange={(open) => setPickerSlot(open ? pickerSlot : null)}
        pool={(pool ?? []).filter((player) => !(picks ?? []).includes(player.id))}
        current={pickerSlot !== null && picks?.[pickerSlot] ? byId.get(picks[pickerSlot]!) ?? null : null}
        impactFor={impactFor}
        onPick={(player) =>
          setPicks((previous) => {
            const next = [...(previous ?? [])];
            next[pickerSlot!] = player.id;
            return next;
          })
        }
      />
    </div>
  );
}

function BalanceGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ cat: Category; magnitude: number }>;
}) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-xs text-muted-foreground">None yet</span>
        ) : (
          items.map((item) => (
            <Badge key={item.cat} variant="secondary" className="px-2 py-0.5 text-[10px]">{CAT_LABEL[item.cat]}</Badge>
          ))
        )}
      </div>
    </div>
  );
}

function formatCategory(cat: Category, value: number) {
  return value.toFixed(cat.endsWith('Pct') ? 3 : 1);
}

function formatSigned(cat: Category, value: number) {
  return `${value > 0 ? '+' : ''}${formatCategory(cat, value)}`;
}
