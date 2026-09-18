import { useMemo, useState, type RefObject } from 'react';
import { Search } from 'lucide-react';
import { useFavouriteIds } from '@/api/favourites';
import { useActiveSeason } from '@/api/queries';
import type { PlayerWithStats } from '@/api/types';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { WatchlistStar } from '@/components/player/WatchlistStar';
import { Input } from '@/components/ui/input';
import { matchesSearch } from '@/lib/playerFilters';

const MAX_RESULTS = 8;
const MAX_QUICK_PICKS = 6;

/**
 * Shared player autocomplete: watchlist quick picks on focus, watchlist-first
 * ordering while searching. Callers pass their (whole) pool; filtering stays
 * client-side. Star toggles sit beside the pick button so a click on one
 * never selects the player.
 */
export function PlayerSearch({
  players,
  onPick,
  placeholder = 'Search player…',
  withWatchlist = true,
  compact = false,
  inputRef,
  className,
}: {
  players: PlayerWithStats[];
  onPick: (id: string) => void;
  placeholder?: string;
  withWatchlist?: boolean;
  /** Slimmer input for dense surfaces (e.g. the sticky switcher bar). */
  compact?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { data: season } = useActiveSeason();
  const favouriteIds = useFavouriteIds(season?.id);

  const watchlistPlayers = useMemo(
    () => (withWatchlist ? players.filter((player) => favouriteIds.has(player.id)) : []),
    [players, favouriteIds, withWatchlist],
  );

  const searching = query.trim().length > 0;
  const results = useMemo(() => {
    if (!searching) return [];
    return players
      .filter((player) => matchesSearch(player, query))
      .sort((a, b) => Number(favouriteIds.has(b.id)) - Number(favouriteIds.has(a.id)))
      .slice(0, MAX_RESULTS);
  }, [players, query, searching, favouriteIds]);

  const quickPicks = searching ? [] : watchlistPlayers.slice(0, MAX_QUICK_PICKS);
  const showDropdown = open && (searching ? results.length > 0 : quickPicks.length > 0);

  function pick(id: string) {
    onPick(id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className={className}>
      <div className="relative w-full">
        <Search className={`pointer-events-none absolute left-3 size-4 text-muted-foreground ${compact ? 'top-2.5' : 'top-3.5'}`} />
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setQuery('');
              setOpen(false);
              event.currentTarget.blur();
            }
          }}
          placeholder={placeholder}
          aria-label="Search players"
          className={compact ? 'h-9 pl-9' : 'h-11 pl-9'}
        />
        {showDropdown && (
          <div
            className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-xl"
            onMouseDown={(event) => event.preventDefault()}
          >
            {!searching && (
              <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Watchlist
              </div>
            )}
            {(searching ? results : quickPicks).map((player) => (
              <div key={player.id} className="flex w-full items-center gap-1 rounded-lg pr-1 hover:bg-muted">
                <button
                  type="button"
                  onClick={() => pick(player.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm"
                >
                  <PlayerHeadshot espnId={player.espn_id} name={player.name} size={30} variant="bare" />
                  <span className="min-w-0 truncate">{player.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{player.nba_team ?? 'FA'}</span>
                </button>
                <WatchlistStar playerId={player.id} playerName={player.name} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
