import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { isRookie, parseStats, type StatLine } from '@/lib/stats';
import { useGameLog, type GameLogRow } from '@/api/gameLog';
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

const ageFrom = (birthDate?: string | null): number | null => {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--;
  return age;
};

interface PlayerProfileDialogProps {
  player: PlayerWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** which values to show for counting stats; defaults to per-game averages */
  basis?: 'averages' | 'totals';
  /** draft-day extras: show a pick action when set (only passed on the draft page) */
  canPick?: boolean;
  picking?: boolean;
  onPick?: () => void;
}

export function PlayerStatsDialog({
  player,
  open,
  onOpenChange,
  basis = 'averages',
  canPick,
  picking,
  onPick,
}: PlayerProfileDialogProps) {
  if (!player) return null;
  const raw = parseStats(player.player_seasons[0]?.stats);
  const s = basis === 'totals'
    ? { ...raw, pts: scale(raw.pts, raw.gp), reb: scale(raw.reb, raw.gp), ast: scale(raw.ast, raw.gp), stl: scale(raw.stl, raw.gp), blk: scale(raw.blk, raw.gp), tp: scale(raw.tp, raw.gp), to: scale(raw.to, raw.gp), fgm: scale(raw.fgm, raw.gp) }
    : raw;

  const age = ageFrom(player.birth_date);
  const exp = player.experience;
  const expLabel = exp == null ? null : exp === 0 ? 'Rookie' : `${exp}${exp >= 11 && exp <= 13 ? 'th' : ['th','st','nd','rd'][exp] ?? 'th'} season`;
  // ponytail: one joined string covers bio; structured layout only if this grows
  const bioBits = [
    age != null ? `${age} yrs` : null,
    player.height,
    player.weight != null ? `${player.weight} lbs` : null,
    expLabel,
    player.draft_display,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <PlayerHeadshot espnId={player.espn_id} name={player.name} size={56} />
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">{player.name}</DialogTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">
                  {player.position ?? '—'}
                </Badge>
                {isRookie(player) && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-primary border-primary/40">
                    ROOK
                  </Badge>
                )}
                <span>{player.nba_team ?? '—'}</span>
              </div>
              {bioBits.length > 0 && (
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{bioBits.join(' · ')}</p>
              )}
            </div>
            {canPick && (
              <Button size="sm" className="shrink-0" disabled={picking} onClick={onPick}>
                {picking ? 'Picking…' : `Pick ${player.name.split(' ').pop()}`}
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {STAT_ROWS.map(({ key, label }) => (
            <div key={key} className="rounded-md bg-muted/50 p-2 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="text-sm font-semibold tabular-nums">{s[key] ?? '—'}</div>
            </div>
          ))}
        </div>
        {open && player.espn_id && <GameLogTable espnId={String(player.espn_id)} />}
      </DialogContent>
    </Dialog>
  );
}

const LOG_COLS: { key: keyof GameLogRow; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'opponent', label: 'Opp' },
  { key: 'min', label: 'MIN' },
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'to', label: 'TO' },
];

function GameLogTable({ espnId }: { espnId: string }) {
  const [show, setShow] = useState(false);
  const { data: rows, isLoading } = useGameLog(espnId, show);

  return (
    <div>
      <Button variant="ghost" size="sm" className="w-full" onClick={() => setShow((v) => !v)}>
        {show ? 'Hide' : 'Show'} game log
      </Button>
      {show && (
        isLoading ? (
          <div className="space-y-1 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : !rows?.length ? (
          <p className="py-2 text-center text-xs text-muted-foreground">No games logged.</p>
        ) : (
          // ponytail: max-h with native overflow — no ScrollArea for one table
          <div className="max-h-64 overflow-y-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left uppercase tracking-wide text-muted-foreground">
                  {LOG_COLS.map(({ key, label }) => (
                    <th key={key} className={`px-2 py-1.5 font-semibold ${key !== 'date' && key !== 'opponent' ? 'text-right' : ''}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.gameId} className="border-t border-border/50 tabular-nums">
                    <td className="whitespace-nowrap px-2 py-1">{r.date.slice(5)}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">
                      {r.location}{r.opponent} {r.result}
                    </td>
                    {LOG_COLS.slice(2).map(({ key }) => (
                      <td key={key} className="px-2 py-1 text-right">{r[key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
