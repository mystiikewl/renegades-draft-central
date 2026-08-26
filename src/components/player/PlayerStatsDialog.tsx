import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight } from 'lucide-react';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { useIsMobile } from '@/hooks/useIsMobile';
import { isRookie, parseStats, type StatLine } from '@/lib/stats';
import { useGameLog, type GameLogRow } from '@/api/gameLog';
import type { PlayerWithStats } from '@/api/types';

const scale = (v: string | null, gp: string | null): string | null => {
  if (v == null || gp == null) return v;
  const n = Number(v) * Number(gp);
  return Number.isFinite(n) ? String(Math.round(n)) : v;
};

const PRIMARY_STATS: { key: keyof StatLine; label: string }[] = [
  { key: 'mpg', label: 'MIN' },
  { key: 'fgm', label: 'FGM' },
  { key: 'fgPct', label: 'FG%' },
  { key: 'ftPct', label: 'FT%' },
  { key: 'tp', label: '3PM' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'to', label: 'TO' },
  { key: 'pts', label: 'PTS' },
];

const SECONDARY_STATS: { key: keyof StatLine; label: string }[] = [
  { key: 'gp', label: 'GP' },
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
  basis?: 'averages' | 'totals';
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
  const isMobile = useIsMobile();
  if (!player) return null;

  const body = (
    <PlayerProfileBody
      player={player}
      basis={basis}
      canPick={canPick}
      picking={picking}
      onPick={onPick}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95dvh] overflow-hidden">{body}</DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">{body}</DialogContent>
    </Dialog>
  );
}

function PlayerProfileBody({
  player,
  basis,
  canPick,
  picking,
  onPick,
}: Required<Pick<PlayerProfileDialogProps, 'basis'>> &
  Pick<PlayerProfileDialogProps, 'canPick' | 'picking' | 'onPick'> & {
    player: PlayerWithStats;
  }) {
  const raw = parseStats(player.player_seasons[0]?.stats);
  const s = basis === 'totals'
    ? {
        ...raw,
        pts: scale(raw.pts, raw.gp),
        reb: scale(raw.reb, raw.gp),
        ast: scale(raw.ast, raw.gp),
        stl: scale(raw.stl, raw.gp),
        blk: scale(raw.blk, raw.gp),
        tp: scale(raw.tp, raw.gp),
        to: scale(raw.to, raw.gp),
        fgm: scale(raw.fgm, raw.gp),
      }
    : raw;

  const age = ageFrom(player.birth_date);
  const exp = player.experience;
  const expLabel = exp == null ? null : exp === 0 ? 'Rookie' : `${exp} yr`;
  const bioBits = [
    age != null ? `${age} yrs` : null,
    player.height,
    player.weight != null ? `${player.weight} lbs` : null,
    expLabel,
  ].filter(Boolean);

  const teamLogo = player.nba_team
    ? `https://a.espncdn.com/i/teamlogos/nba/500/${LOGO_ABBREV[player.nba_team] ?? player.nba_team.toLowerCase()}.png`
    : null;

  return (
    <div className="flex max-h-[inherit] flex-col overflow-y-auto bg-background">
      <div className="relative min-h-44 shrink-0 overflow-hidden border-b bg-gradient-to-br from-muted via-background to-muted/40 px-4 pb-4 pt-5 pr-12 sm:min-h-48 sm:px-6 sm:pt-6 sm:pr-14">
        {teamLogo && (
          <img
            src={teamLogo}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -left-10 top-1/2 w-64 -translate-y-1/2 opacity-[0.07] dark:opacity-[0.12]"
          />
        )}
        <div className="absolute bottom-0 right-2 sm:right-8">
          <PlayerHeadshot
            espnId={player.espn_id}
            name={player.name}
            size={142}
            variant="bare"
            className="sm:hidden"
          />
          <PlayerHeadshot
            espnId={player.espn_id}
            name={player.name}
            size={168}
            variant="bare"
            className="hidden sm:inline-block"
          />
        </div>

        <div className="relative z-10 max-w-[62%] sm:max-w-[58%]">
          <h2 className="line-clamp-2 text-xl font-black uppercase leading-tight tracking-tight sm:text-2xl">
            {player.name}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <span>{player.nba_team ?? 'FA'}</span>
            <span>·</span>
            <span>{player.position ?? '—'}</span>
            {isRookie(player) && (
              <Badge variant="outline" className="border-primary/40 px-1.5 py-0 text-[9px] text-primary">
                ROOK
              </Badge>
            )}
          </div>
          {bioBits.length > 0 && (
            <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
              {bioBits.join(' · ')}
            </p>
          )}
          {player.draft_display && (
            <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">{player.draft_display}</p>
          )}

          {canPick && (
            <Button
              size="sm"
              className="mt-4 rounded-full px-5 font-bold transition-transform active:scale-[0.98] sm:hidden"
              disabled={picking}
              onClick={onPick}
            >
              {picking ? 'Picking…' : `Draft ${player.name.split(' ').pop()}`}
            </Button>
          )}
        </div>
      </div>

      <div className="border-b bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 text-center">
            <SummaryStat label="Rank" value={s.rank} />
            <SummaryStat label="PTS" value={s.pts} />
            <SummaryStat label="REB" value={s.reb} />
          </div>
          {canPick && (
            <Button
              size="sm"
              className="hidden shrink-0 rounded-full px-5 font-bold transition-transform active:scale-[0.98] sm:inline-flex"
              disabled={picking}
              onClick={onPick}
            >
              {picking ? 'Picking…' : `Draft ${player.name.split(' ').pop()}`}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="text-xs font-bold uppercase tracking-wide">Season stats</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-xs">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wide text-muted-foreground">
                  {PRIMARY_STATS.map(({ key, label }) => (
                    <th key={key} className="px-3 py-2 text-right font-bold first:text-left">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {PRIMARY_STATS.map(({ key }) => (
                    <td key={key} className="px-3 py-3 text-right font-semibold tabular-nums first:text-left">
                      {s[key] ?? '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-4 border-t bg-muted/20">
            {SECONDARY_STATS.map(({ key, label }) => (
              <div key={key} className="border-r px-3 py-3 text-center last:border-r-0">
                <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{s[key] ?? '—'}</div>
              </div>
            ))}
          </div>
        </section>

        {player.espn_id && <GameLogTable espnId={String(player.espn_id)} />}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 border-r last:border-r-0">
      <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-base font-bold tabular-nums">{value ?? '—'}</div>
    </div>
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
    <section className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
        onClick={() => setShow((v) => !v)}
      >
        <span className="text-xs font-bold uppercase tracking-wide">Game log</span>
        <ChevronRight className={`size-4 text-muted-foreground transition-transform ${show ? 'rotate-90' : ''}`} />
      </button>
      {show && (
        isLoading ? (
          <div className="space-y-1 border-t p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !rows?.length ? (
          <p className="border-t py-8 text-center text-xs text-muted-foreground">No games logged.</p>
        ) : (
          <div className="max-h-80 overflow-auto border-t">
            <table className="w-full min-w-[34rem] text-xs">
              <thead className="sticky top-0 bg-card shadow-[0_1px_0_0_var(--border)]">
                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {LOG_COLS.map(({ key, label }) => (
                    <th
                      key={key}
                      className={`whitespace-nowrap px-3 py-2 font-bold ${key !== 'date' && key !== 'opponent' ? 'text-right' : 'text-left'}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, index) => (
                  <tr key={r.gameId} className={`border-t border-border/40 ${index % 2 ? 'bg-muted/[0.18]' : ''}`}>
                    <td className="whitespace-nowrap px-3 py-2">{r.date.slice(5)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {r.location}{r.opponent}{' '}
                      <span className={r.result === 'W' ? 'font-semibold text-emerald-600 dark:text-emerald-400' : r.result === 'L' ? 'text-red-500 dark:text-red-400' : ''}>
                        {r.result}
                      </span>
                    </td>
                    {LOG_COLS.slice(2).map(({ key }) => (
                      <td key={key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r[key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}
