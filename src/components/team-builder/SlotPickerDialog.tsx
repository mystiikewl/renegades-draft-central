import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { parseStats } from '@/lib/stats';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import type { PlayerWithStats } from '@/api/types';
import type { CategoryImpact } from '@/lib/projections';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: PlayerWithStats[];
  /** Player already assigned to the slot being edited (shown for comparison). */
  current: PlayerWithStats | null;
  /** Per-candidate impact preview rows (delta per category + baseline flips). */
  impactFor?: (player: PlayerWithStats) => CategoryImpact[];
  onPick: (player: PlayerWithStats) => void;
}

/** Search-and-pick dialog for filling a roster slot, with impact preview. */
export function SlotPickerDialog({ open, onOpenChange, pool, current, impactFor, onPick }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pool.slice(0, 25);
    return pool.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 25);
  }, [pool, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Pick a player{current ? ` (replacing ${current.name})` : ''}
          </DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto rounded-md border">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No players found.</p>
          ) : (
            filtered.map((p) => {
              const s = parseStats(p.player_seasons[0]?.stats);
              const imp = impactFor?.(p);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onPick(p);
                    onOpenChange(false);
                  }}
                  disabled={current?.id === p.id}
                  className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <PlayerHeadshot espnId={p.espn_id} name={p.name} />
                    <span className="truncate font-medium">{p.name}</span>
                    <Badge variant="outline">{p.position ?? '?'}</Badge>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {s.pts}p {s.reb}r {s.ast}a
                    </span>
                  </span>
                  {imp && (
                    <span className="flex shrink-0 flex-wrap justify-end gap-x-2 text-xs tabular-nums">
                      {imp.map((i) => (
                        <span
                          key={i.cat}
                          title={`Total ${i.before.toFixed(1)} → ${i.after.toFixed(1)}`}
                          className={
                            i.flipsVsBaseline
                              ? 'font-semibold text-primary'
                              : i.delta > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {i.cat} {i.delta >= 0 ? '+' : ''}
                          {i.cat.endsWith('Pct') ? i.delta.toFixed(3) : Math.round(i.delta)}
                          {i.flipsVsBaseline && ' ⇅'}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <p className="text-xs text-muted-foreground">⇅ = flips this category vs the average-team baseline.</p>
      </DialogContent>
    </Dialog>
  );
}
