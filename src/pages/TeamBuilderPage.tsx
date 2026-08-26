import { useEffect, useMemo, useState } from 'react';
import { useActiveSeason, useDraftSettings, usePlayerPool, useRosters } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';
import { SlotPickerDialog } from '@/components/team-builder/SlotPickerDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { X } from 'lucide-react';
import type { PlayerWithStats } from '@/api/types';

const ALL_CATEGORIES: Category[] = LEAGUE_CATEGORIES;
/** league default: all 13 ROTO cats on */
const DEFAULT_CATEGORIES: Category[] = LEAGUE_CATEGORIES;

interface SavedBuild {
  name: string;
  categories: Category[];
  rounds: number;
  playerIds: string[];
}

/** byId lookup over pool + rostered players so saved/mid-draft picks resolve. */
function indexById(pool: PlayerWithStats[], rostered: PlayerWithStats[]): Map<string, PlayerWithStats> {
  const m = new Map<string, PlayerWithStats>();
  // later wins: pool (which carries season stats) beats bare roster stubs
  for (const p of [...rostered, ...pool]) m.set(p.id, p);
  return m;
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
  const [picks, setPicks] = useState<(string | null)[] | null>(null); // null until prefill decided
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [buildName, setBuildName] = useState('');
  const [savedBuilds, setSavedBuilds] = useState<SavedBuild[]>([]);
  const buildsKey = seasonId ? `tbuilder:${seasonId}:builds` : null;

  // Defaults from draft_settings once loaded.
  useEffect(() => setRounds(liveRounds), [liveRounds]);
  // Load saved builds per season.
  useEffect(() => {
    if (!buildsKey) return;
    try {
      setSavedBuilds(JSON.parse(localStorage.getItem(buildsKey) ?? '[]'));
    } catch {
      setSavedBuilds([]);
    }
  }, [buildsKey]);

  // Mid-draft prefill: my real roster fills the first slots.
  const rosteredById = useMemo(() => {
    if (!picks || !rosters || !profile?.team_id) return new Map<string, PlayerWithStats>();
    return indexById(
      [],
      rosters
        .filter((r) => r.team_id === profile.team_id)
        .flatMap((r) =>
          r.players && r.player_id
            ? [{ id: r.player_id, name: r.players.name, position: r.players.position, espn_id: r.players.espn_id ?? null }]
            : [],
        )
        .map((p) => ({
          ...p,
          espn_id: p.espn_id ?? null,
          nba_team: null,
          image_url: null,
          created_at: '',
          player_seasons: [], // stats come via the pool map below when available
        })) as PlayerWithStats[],
    );
  }, [picks, rosters, profile?.team_id]);

  const byId = useMemo(() => indexById(pool ?? [], [...rosteredById.values()]), [pool, rosteredById]);

  useEffect(() => {
    if (picks !== null) return; // user edits after init are theirs
    if (!rosters || liveRounds < 1) return;
    const mine =
      profile?.team_id
        ? rosters.filter((r) => r.team_id === profile.team_id).map((r) => r.player_id)
        : [];
    setPicks([
      ...mine.slice(0, liveRounds),
      ...Array<string | null>(Math.max(0, liveRounds - mine.length)).fill(null),
    ]);
  }, [picks, profile?.team_id, rosters, liveRounds]);

  const teamPlayers = useMemo(() => {
    const list = (picks ?? []).map((id) => (id ? byId.get(id) ?? null : null));
    return list.filter((p): p is PlayerWithStats => p !== null);
  }, [picks, byId]);

  const cats = useMemo(() => ALL_CATEGORIES.filter((c) => categories.includes(c)), [categories]);
  const base = useMemo(() => baseline(pool ?? [], settings?.league_size ?? 10, cats), [pool, settings, cats]);
  const totals = useMemo(() => categoryTotals(teamPlayers, cats), [teamPlayers, cats]);
  // ponytail: full league-team ranking table would be nicer; baseline-crossing is the cheap proxy
  const impactFor = (candidate: PlayerWithStats) =>
    impact(teamPlayers.filter((p) => p.id !== picks?.[pickerSlot ?? -1]), candidate, base, cats);

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

  function loadBuild(b: SavedBuild) {
    setCategories(b.categories);
    setRounds(b.rounds);
    setPicks(b.playerIds.slice(0, b.rounds).map((id) => id));
  }

  function deleteBuild(name: string) {
    const next = savedBuilds.filter((b) => b.name !== name);
    localStorage.setItem(buildsKey!, JSON.stringify(next));
    setSavedBuilds(next);
  }

  if (poolLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <h1 className="text-2xl font-bold">Team Builder</h1>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Team Builder</h1>
        <p className="text-sm text-muted-foreground">
          Map out your draft. Totals compare against an average team drawn evenly from the pool.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-1">
            <Label className="mr-2 text-xs text-muted-foreground">Categories:</Label>
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  setCategories((prev) =>
                    prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
                  )
                }
                disabled={categories.length === 1 && categories[0] === cat}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  categories.includes(cat)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="rounds" className="text-xs text-muted-foreground">
              Rounds:
            </Label>
            <Input
              id="rounds"
              type="number"
              min={1}
              max={settings?.roster_size ?? 18}
              value={rounds}
              onChange={(e) => {
                const n = Math.max(1, Math.min(settings?.roster_size ?? 18, Number(e.target.value) || 1));
                setRounds(n);
                setPicks((prev) => {
                  const cur = prev ?? Array(n).fill(null);
                  return n > cur.length ? [...cur, ...Array(n - cur.length).fill(null)] : cur.slice(0, n);
                });
              }}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">
              ({liveRounds} live rounds from draft settings · league of {settings?.league_size ?? 10})
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Roster slots</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
            {(picks ?? []).map((id, i) => {
              const p = id ? byId.get(id) : null;
              const s = p ? parseStats(p.player_seasons[0]?.stats) : null;
              return (
                <button
                  key={i}
                  onClick={() => setPickerSlot(i)}
                  className={`rounded-md border p-2 text-left transition-all active:scale-[0.98] hover:border-primary ${
                    p ? '' : 'border-dashed text-muted-foreground'
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                    R{i + 1}
                  </span>
                  {p ? (
                    <>
                      <span className="flex items-center gap-2">
                        <PlayerHeadshot espnId={p.espn_id} name={p.name} size={24} />
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {s?.pts}p {s?.reb}r {s?.ast}a
                      </span>
                    </>
                  ) : (
                    <span className="block py-2 text-sm">+ pick</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Projected totals vs average team ({teamPlayers.length}/{rounds} slots filled)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium"></th>
                {cats.map((c) => (
                  <th key={c} className="px-3 py-2 font-medium">
                    {c}
                    {INVERTED_CATEGORIES.has(c) && (
                      <span title="lower is better" aria-label="(lower is better)">
                        {' '}
                        ↓
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b last:border-b-0">
                <td className="px-3 py-2 font-medium">Your team</td>
                {cats.map((c) => (
                  <td key={c} className="px-3 py-2">
                    {cats.includes(c) ? totals[c]?.toFixed(c.endsWith('Pct') ? 3 : 1) : '—'}
                  </td>
                ))}
              </tr>
              <tr className="border-b last:border-b-0">
                <td className="px-3 py-2 text-muted-foreground">Avg team</td>
                {cats.map((c) => (
                  <td key={c} className="px-3 py-2 text-muted-foreground">
                    {base[c]?.toFixed(c.endsWith('Pct') ? 3 : 1)}
                  </td>
                ))}
              </tr>
              <tr className="last:border-b-0">
                <td className="px-3 py-2 font-medium">Diff</td>
                {cats.map((c) => {
                  const d = (totals[c] ?? 0) - (base[c] ?? 0);
                  return (
                    <td
                      key={c}
                      className={`px-3 py-2 ${d >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                    >
                      {d >= 0 ? '+' : ''}
                      {d.toFixed(c.endsWith('Pct') ? 3 : 1)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Save / load builds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Build name…"
              value={buildName}
              onChange={(e) => setBuildName(e.target.value)}
              className="max-w-xs"
              onKeyDown={(e) => e.key === 'Enter' && saveBuild()}
            />
            <Button size="sm" className="transition-transform active:scale-[0.98]" onClick={saveBuild}>
              Save current
            </Button>
          </div>
          {savedBuilds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved builds yet.</p>
          ) : (
            <ul className="space-y-1">
              {savedBuilds.map((b) => (
                <li key={b.name} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{b.name}</span>{' '}
                    <Badge variant="outline">{b.rounds}r</Badge>{' '}
                    <span className="text-xs text-muted-foreground">{b.categories.join(', ')}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => loadBuild(b)}>
                      Load
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Delete build ${b.name}`} className="px-2 transition-colors hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteBuild(b.name)}>
                      <X className="size-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SlotPickerDialog
        open={pickerSlot !== null}
        onOpenChange={(open) => setPickerSlot(open ? pickerSlot : null)}
        pool={(pool ?? []).filter((p) => !(picks ?? []).includes(p.id))}
        current={pickerSlot !== null && picks?.[pickerSlot] ? byId.get(picks[pickerSlot]!) ?? null : null}
        impactFor={impactFor}
        onPick={(player) =>
          setPicks((prev) => {
            const next = [...(prev ?? [])];
            next[pickerSlot!] = player.id;
            return next;
          })
        }
      />
    </div>
  );
}
