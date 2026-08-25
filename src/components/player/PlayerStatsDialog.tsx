import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { isRookie, parseStats, type StatLine } from '@/lib/stats';
import type { PlayerWithStats } from '@/api/types';

/** "8.3" x "69" gp -> totals string, keeping null/— passthrough. */
const scale = (v: string | null, gp: string | null): string | null => {
  if (v == null || gp == null) return v;
  const n = Number(v) * Number(gp);
  return Number.isFinite(n) ? String(Math.round(n)) : v;
};

const STAT_ROWS: { key: keyof StatLine; label: string }[] = [
  { key: 'gp', label: 'GP' },
  { key: 'mpg', label: 'MPG' },
  { key: 'fgm', label: 'FGM' },
  { key: 'fgPct', label: 'FG%' },
  { key: 'ftPct', label: 'FT%' },
  { key: 'tp', label: '3PM' },
  { key: 'tpPct', label: '3P%' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'to', label: 'TO' },
  { key: 'dd', label: 'DD' },
  { key: 'td', label: 'TD' },
  { key: 'pts', label: 'PTS' },
  { key: 'rank', label: 'Rank' },
];

interface PlayerStatsDialogProps {
  player: PlayerWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** which values to show for counting stats; defaults to per-game averages */
  basis?: 'averages' | 'totals';
}

export function PlayerStatsDialog({ player, open, onOpenChange, basis = 'averages' }: PlayerStatsDialogProps) {
  if (!player) return null;
  const raw = parseStats(player.player_seasons[0]?.stats);
  const s = basis === 'totals'
    ? { ...raw, pts: scale(raw.pts, raw.gp), reb: scale(raw.reb, raw.gp), ast: scale(raw.ast, raw.gp), stl: scale(raw.stl, raw.gp), blk: scale(raw.blk, raw.gp), tp: scale(raw.tp, raw.gp), to: scale(raw.to, raw.gp), fgm: scale(raw.fgm, raw.gp) }
    : raw;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <PlayerHeadshot espnId={player.espn_id} name={player.name} size={56} />
            <div className="min-w-0">
              <DialogTitle className="truncate">{player.name}</DialogTitle>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">
                  {player.position ?? '—'}
                </Badge>
                {isRookie(player) && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-primary border-primary/40">
                    ROOK
                  </Badge>
                )}
                {player.nba_team ?? '—'}
              </div>
            </div>
          </div>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {STAT_ROWS.map(({ key, label }) => (
            <div key={key} className="rounded-md bg-muted/50 p-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="text-sm font-semibold tabular-nums">{s[key] ?? '—'}</div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
