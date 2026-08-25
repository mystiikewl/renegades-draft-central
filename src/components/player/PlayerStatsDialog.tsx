import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'to', label: 'TO' },
  { key: 'fgm', label: 'FGM' },
  { key: 'fgPct', label: 'FG%' },
  { key: 'tp', label: '3PM' },
  { key: 'tpPct', label: '3P%' },
  { key: 'ftPct', label: 'FT%' },
  { key: 'dd', label: 'DD' },
  { key: 'td', label: 'TD' },
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
  /** draft-day extras: show a pick action when set (only passed on the pool page) */
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
  const expLabel =
    exp == null ? null : exp === 0 ? 'Rookie' : `${exp}${exp >= 11 && exp <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][exp] ?? 'th'} season`;
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
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-2xl">
        {/* Header band — headshot + identity */}
        <div className="flex items-center gap-4 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-5 sm:p-6">
          <PlayerHeadshot espnId={player.espn_id} name={player.name} size={72} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold tracking-tight">{player.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary" className="text-[11px] font-semibold">
                {player.position ?? '—'}
              </Badge>
              <span className="font-medium text-foreground/80">{player.nba_team ?? '—'}</span>
              {isRookie(player) && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-primary border-primary/40">
                  ROOK
                </Badge>
              )}
            </div>
            {bioBits.length > 0 && (
              <p className="mt-1 truncate text-xs text-muted-foreground">{bioBits.join(' · ')}</p>
            )}
          </div>
          {canPick && (
            <Button size="lg" className="shrink-0" disabled={picking} onClick={onPick}>
              {picking ? 'Picking…' : `Draft ${player.name.split(' ').pop()}`}
            </Button>
          )}
        </div>

        {/* Body — season stats + game log */}
        <div className="space-y-4 p-5 sm:p-6">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Season stats
            </h3>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {STAT_ROWS.map(({ key, label }) => (
                <div key={key} className="rounded-lg bg-muted/60 p-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className="text-sm font-semibold tabular-nums">{s[key] ?? '—'}</div>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section>{open && player.espn_id && <GameLogTable espnId={String(player.espn_id)} />}</section>
        </div>
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
      <Button variant="ghost" size="sm" className="-ml-2 px-2" onClick={() => setShow((v) => !v)}>
        {show ? '▾ Hide game log' : '▸ Show game log'}
      </Button>
      {show && (
        isLoading ? (
          <div className="mt-2 space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : !rows?.length ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">No games logged.</p>
        ) : (
          // ponytail: max-h with native overflow — no ScrollArea for one table
          <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card shadow-[0_1px_0_0_var(--border)]">
                <tr className="text-left uppercase tracking-wide text-muted-foreground">
                  {LOG_COLS.map(({ key, label }) => (
                    <th
                      key={key}
                      className={`px-2.5 py-2 font-semibold ${key !== 'date' && key !== 'opponent' ? 'text-right' : ''}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.gameId} className="border-t border-border/40 transition-colors hover:bg-muted/40">
                    <td className="whitespace-nowrap px-2.5 py-1.5">{r.date.slice(5)}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">
                      {r.location}
                      {r.opponent}{' '}
                      <span className={r.result === 'W' ? 'font-semibold text-emerald-600 dark:text-emerald-400' : r.result === 'L' ? 'text-red-500 dark:text-red-400' : ''}>
                        {r.result}
                      </span>
                    </td>
                    {LOG_COLS.slice(2).map(({ key }) => (
                      <td key={key} className="px-2.5 py-1.5 text-right tabular-nums">{r[key]}</td>
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
