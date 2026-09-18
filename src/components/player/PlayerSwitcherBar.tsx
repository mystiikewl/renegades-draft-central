import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RefObject } from 'react';
import { useActiveSeason } from '@/api/queries';
import { useFavouriteIds } from '@/api/favourites';
import type { PlayerWithStats } from '@/api/types';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { PlayerSearch } from '@/components/player/PlayerSearch';

const cycleButtonClass =
  'rounded-lg border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40';

/**
 * Compact player switcher for Player Lab: current-player chip (tap = back to
 * top), watchlist cycling and the shared search, rendered by the page only
 * once the header search has scrolled away. Presentational — visibility is
 * the page's concern (IntersectionObserver on the header sentinel).
 */
export function PlayerSwitcherBar({
  player,
  pool,
  onPick,
  inputRef,
}: {
  player: PlayerWithStats;
  pool: PlayerWithStats[];
  onPick: (id: string) => void;
  inputRef?: RefObject<HTMLInputElement>;
}) {
  const { data: season } = useActiveSeason();
  const favouriteIds = useFavouriteIds(season?.id);

  // Cycle the watchlist when there is one; otherwise browse the whole pool.
  // Name-sorted so the order is stable across renders.
  const cycleList = useMemo(() => {
    const watched = pool.filter((candidate) => favouriteIds.has(candidate.id));
    return [...(watched.length > 0 ? watched : pool)].sort((a, b) => a.name.localeCompare(b.name));
  }, [pool, favouriteIds]);

  function cycle(direction: 1 | -1) {
    if (cycleList.length === 0) return;
    const index = cycleList.findIndex((candidate) => candidate.id === player.id);
    const next = cycleList[(((index + direction) % cycleList.length) + cycleList.length) % cycleList.length];
    onPick(next.id);
  }

  return (
    <div className="sticky top-12 z-20 -mx-4 border-b bg-background/95 px-4 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 py-2">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Back to top"
          className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-lg px-1 py-0.5 transition-colors hover:bg-muted"
        >
          <PlayerHeadshot espnId={player.espn_id} name={player.name} size={22} variant="bare" />
          <span className="max-w-[7rem] truncate text-xs font-bold sm:max-w-[14rem]">{player.name}</span>
          <span className="hidden text-[10px] text-muted-foreground lg:inline">{player.nba_team ?? 'FA'} · {player.position ?? '—'}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => cycle(-1)}
            disabled={cycleList.length === 0}
            aria-label="Previous player"
            className={cycleButtonClass}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => cycle(1)}
            disabled={cycleList.length === 0}
            aria-label="Next player"
            className={cycleButtonClass}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <PlayerSearch players={pool} onPick={onPick} compact inputRef={inputRef} />
        </div>
      </div>
    </div>
  );
}
