import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { PlayerWithStats } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { fmtStat, statColumnValue } from '@/lib/stats';

const POSITIONS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'] as const;

type PositionFilter = (typeof POSITIONS)[number];

function matchesPosition(player: PlayerWithStats, position: PositionFilter): boolean {
  if (position === 'All') return true;
  const tokens = (player.position ?? '').split(',').map((token) => token.trim());
  return (
    tokens.includes(position) ||
    tokens.includes('ALL') ||
    ((position === 'PG' || position === 'SG') && tokens.includes('G')) ||
    ((position === 'SF' || position === 'PF') && tokens.includes('F'))
  );
}

export function DraftPlayerList({
  players,
  title = 'Available Players',
  subtitle,
  actionLabel = 'Draft',
  disabled = false,
  disabledLabel = 'Waiting',
  onSelect,
}: {
  players: PlayerWithStats[];
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  disabled?: boolean;
  disabledLabel?: string;
  onSelect: (player: PlayerWithStats) => void;
}) {
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<PositionFilter>('All');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return players.filter((player) => {
      if (!matchesPosition(player, position)) return false;
      if (!query) return true;
      return (
        player.name.toLowerCase().includes(query) ||
        (player.nba_team ?? '').toLowerCase().includes(query) ||
        (player.position ?? '').toLowerCase().includes(query)
      );
    });
  }, [players, position, search]);

  return (
    <section className="overflow-hidden border-y bg-card sm:rounded-2xl sm:border">
      <div className="space-y-3 border-b px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {subtitle ?? `${filtered.length} available players`}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search players or teams"
              className="h-10 rounded-full bg-muted/50 pl-9"
              aria-label="Search available players"
            />
          </div>
        </div>

        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-2">
            {POSITIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPosition(item)}
                aria-pressed={position === item}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  position === item
                    ? 'border-foreground bg-foreground text-background'
                    : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No available players found.</p>
      ) : (
        <div className="max-h-[56rem] divide-y divide-border/50 overflow-y-auto sm:max-h-[44rem]">
          {filtered.map((player) => (
            <div
              key={player.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_repeat(5,3rem)_auto] sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <PlayerHeadshot espnId={player.espn_id} name={player.name} size={42} variant="bare" />
                <div className="min-w-0">
                  <div className="line-clamp-1 font-semibold">{player.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {player.nba_team ?? 'FA'} · {player.position ?? '—'}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] tabular-nums text-muted-foreground sm:hidden">
                    <span>{fmtStat('pts', 'averages', statColumnValue(player, 'pts', 'averages'))} PTS</span>
                    <span>{fmtStat('reb', 'averages', statColumnValue(player, 'reb', 'averages'))} REB</span>
                    <span>{fmtStat('ast', 'averages', statColumnValue(player, 'ast', 'averages'))} AST</span>
                  </div>
                </div>
              </div>

              {(['pts', 'reb', 'ast', 'stl', 'blk'] as const).map((key) => (
                <div key={key} className="hidden text-right sm:block">
                  <div className="text-[9px] font-bold uppercase text-muted-foreground">{key}</div>
                  <div className="text-xs font-semibold tabular-nums">
                    {fmtStat(key, 'averages', statColumnValue(player, key, 'averages'))}
                  </div>
                </div>
              ))}

              <Button
                size="sm"
                disabled={disabled}
                onClick={() => onSelect(player)}
                className="min-w-20"
                aria-label={`${actionLabel} ${player.name}`}
              >
                {disabled ? disabledLabel : actionLabel}
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
