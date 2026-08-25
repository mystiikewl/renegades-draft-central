import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight } from 'lucide-react';
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

const LOGO_ABBREV: Record<string, string> = { UTA: 'utah' };

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

  // ponytail: ESPN CDN logo URL derived from the abbrev — tiny alias map for
  // the variants in our data ESPN doesn't use (UTA/PHX/etc); FA has no logo.
  const teamLogo = player.nba_team
    ? `https://a.espncdn.com/i/teamlogos/nba/500/${LOGO_ABBREV[player.nba_team] ?? player.nba_team.toLowerCase()}.png`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        {/* Header band — headshot + bio left, draft action right. Zero bottom
            padding so the image sits flush against the body content. Right
            padding clears the dialog's close (X) button. */}
        <div className="relative flex items-center gap-4 overflow-hidden px-5 pb-0 pt-5 pr-12 sm:px-6 sm:pt-6 sm:pr-14">
          {teamLogo && (
            <img
              src={teamLogo}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -left-6 top-1/2 w-56 -translate-y-1/2 opacity-10 sm:w-64 dark:opacity-[0.13]"
            />
          )}
          <PlayerHeadshot espnId={player.espn_id} name={player.name} size={104} variant="bare" />
          <div className="relative min-w-0 flex-1">
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
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{bioBits.join(' · ')}</p>
            )}
          </div>
          {canPick && (
            <Button
              size="lg"
              className="shrink-0 transition-transform active:scale-[0.98]"
              disabled={picking}
              onClick={onPick}
            >
              {picking ? 'Picking…' : `Draft ${player.name.split(' ').pop()}`}
            </Button>
          )}
        </div>

        {/* Body — season stats + game log; flush against the header image */}
        <div className="space-y-4 px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Season stats
            </h3>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {STAT_ROWS.map(({ key, label }) => {
                // ponytail: rank is the only cross-category stat we have, so
                // it's the anchor tile — tinted whenever the value exists.
                const anchor = key === 'rank' && s.rank != null && s.rank !== '—';
                return (
                  <div
                    key={key}
                    className={`rounded-lg p-2.5 text-center ${
                      anchor ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted/60'
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                    <div className="text-sm font-semibold tabular-nums">{s[key] ?? '—'}</div>
                  </div>
                );
              })}
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
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 gap-1 px-2 [&_svg]:transition-transform"
        onClick={() => setShow((v) => !v)}
      >
        <ChevronRight className={`size-4 ${show ? 'rotate-90' : ''}`} />
        {show ? 'Hide game log' : 'Show game log'}
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
