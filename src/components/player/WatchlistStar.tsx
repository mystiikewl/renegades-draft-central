import { Star } from 'lucide-react';
import { useFavouriteIds, useToggleFavourite } from '@/api/favourites';
import { useActiveSeason } from '@/api/queries';
import { cn } from '@/lib/utils';

/**
 * Watchlist toggle for one player. Self-contained (own auth/season/data
 * hooks) and click-isolated (stopPropagation + preventDefault) so it can sit
 * inside clickable rows, table cells and Links without triggering them.
 */
export function WatchlistStar({
  playerId,
  playerName,
  className,
}: {
  playerId: string;
  playerName: string;
  className?: string;
}) {
  const { data: season } = useActiveSeason();
  const watched = useFavouriteIds(season?.id).has(playerId);
  const toggle = useToggleFavourite(season?.id);

  return (
    <button
      type="button"
      aria-pressed={watched}
      aria-label={watched ? `Remove ${playerName} from watchlist` : `Add ${playerName} to watchlist`}
      title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
      disabled={toggle.isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle.mutate({ playerId, watch: !watched });
      }}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
        watched ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <Star className="size-4" fill={watched ? 'currentColor' : 'none'} strokeWidth={2} />
    </button>
  );
}
