import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { parseStats, type StatLine } from '@/lib/stats';
import type { PlayerWithStats } from '@/api/types';

const STAT_ROWS: { key: keyof StatLine; label: string }[] = [
  { key: 'gp', label: 'GP' },
  { key: 'mpg', label: 'MPG' },
  { key: 'pts', label: 'PPG' },
  { key: 'reb', label: 'RPG' },
  { key: 'ast', label: 'APG' },
  { key: 'stl', label: 'SPG' },
  { key: 'blk', label: 'BPG' },
  { key: 'tp', label: '3PM' },
  { key: 'to', label: 'TO' },
  { key: 'fgPct', label: 'FG%' },
  { key: 'ftPct', label: 'FT%' },
  { key: 'rank', label: 'Rank' },
];

interface PlayerStatsDialogProps {
  player: PlayerWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlayerStatsDialog({ player, open, onOpenChange }: PlayerStatsDialogProps) {
  if (!player) return null;
  const s = parseStats(player.player_seasons[0]?.stats);

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
