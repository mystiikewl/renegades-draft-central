import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { parseStats } from '@/lib/stats';
import { INVERTED_CATEGORIES, type CategoryImpact } from '@/lib/projections';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { PlayerWithStats } from '@/api/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: PlayerWithStats[];
  current: PlayerWithStats | null;
  impactFor?: (player: PlayerWithStats) => CategoryImpact[];
  onPick: (player: PlayerWithStats) => void;
}

const CAT_LABEL: Record<CategoryImpact['cat'], string> = {
  fgm: 'FGM', fgPct: 'FG%', ftPct: 'FT%', tp: '3PM', tpPct: '3P%', reb: 'REB', ast: 'AST',
  stl: 'STL', blk: 'BLK', to: 'TO', dd: 'DD', td: 'TD', pts: 'PTS',
};

function isHelpful(item: CategoryImpact) {
  return INVERTED_CATEGORIES.has(item.cat) ? item.delta < 0 : item.delta > 0;
}

function FitSummary({ impact }: { impact: CategoryImpact[] }) {
  const helpful = impact.filter(isHelpful);
  const risks = impact.filter((item) => item.delta !== 0 && !isHelpful(item));
  const flips = impact.filter((item) => item.flipsVsBaseline && isHelpful(item));
  const score = helpful.length - risks.length;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
      <Badge variant="outline" className="px-1.5 py-0.5 font-mono">
        {score > 0 ? '+' : ''}{score} fit
      </Badge>
      {flips.slice(0, 2).map((item) => (
        <span key={item.cat} className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
          boosts {CAT_LABEL[item.cat]}
        </span>
      ))}
      {flips.length === 0 && helpful.slice(0, 2).map((item) => (
        <span key={item.cat} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
          + {CAT_LABEL[item.cat]}
        </span>
      ))}
      {risks.slice(0, 1).map((item) => (
        <span key={item.cat} className="rounded-full border px-2 py-0.5 text-muted-foreground">
          watch {CAT_LABEL[item.cat]}
        </span>
      ))}
    </div>
  );
}

export function SlotPickerDialog({ open, onOpenChange, pool, current, impactFor, onPick }: Props) {
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pool.slice(0, 40);
    return pool
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nba_team ?? '').toLowerCase().includes(q) ||
        (p.position ?? '').toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [pool, search]);

  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-3 sm:px-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus={!isMobile}
            placeholder="Search name, team or position"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full bg-muted/60 pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t sm:max-h-[32rem] sm:rounded-xl sm:border">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No players found.</p>
        ) : (
          filtered.map((p, index) => {
            const s = parseStats(p.player_seasons[0]?.stats);
            const imp = impactFor?.(p) ?? [];
            return (
              <button
                key={p.id}
                onClick={() => {
                  onPick(p);
                  onOpenChange(false);
                }}
                disabled={current?.id === p.id}
                className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50 active:bg-muted disabled:opacity-50 ${index % 2 ? 'bg-muted/[0.12]' : ''}`}
              >
                <PlayerHeadshot espnId={p.espn_id} name={p.name} size={42} variant="bare" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="line-clamp-1 font-semibold leading-tight">{p.name}</span>
                    {current?.id === p.id && <Badge variant="secondary" className="shrink-0 text-[9px]">Current</Badge>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {p.nba_team ?? 'FA'} · {p.position ?? '—'} · {s.pts ?? '—'} PTS · {s.reb ?? '—'} REB · {s.ast ?? '—'} AST
                  </div>
                  {imp.length > 0 && <FitSummary impact={imp} />}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh] overflow-hidden">
          <DrawerHeader className="text-left">
            <DrawerTitle>{current ? `Replace ${current.name}` : 'Add a player'}</DrawerTitle>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-3 overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{current ? `Replace ${current.name}` : 'Add a player'}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
