import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserFavouriteIds,
  getUserFavouritesWithPlayers,
  addFavourite,
  removeFavourite,
  toggleFavourite,
  FavouriteWithPlayer
} from '@/integrations/supabase/services/favourites';
import { Tables } from '@/integrations/supabase/types';

type FavouritePlayer = Tables<'players'> & { isFavourite?: boolean };

export interface UseFavouritesReturn {
  favouriteIds: string[];
  favouritePlayers: FavouritePlayer[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  toggleFavouriteMutation: ReturnType<typeof useMutation>;
  refetchFavourites: () => void;
  isFavourite: (playerId: string) => boolean;
}

export const useFavourites = (): UseFavouritesReturn => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch favourite player IDs
  const {
    data: favouriteIds = [],
    isLoading: isFavouriteIdsLoading,
    error: favouriteIdsError,
    refetch: refetchFavouriteIds
  } = useQuery({
    queryKey: ['userFavourites', user?.id],
    queryFn: getUserFavouriteIds,
    enabled: !!user,
  });

  // Fetch favourite players with details
  const {
    data: favouritePlayersData = [],
    isLoading: isFavouritePlayersLoading,
    error: favouritePlayersError,
    refetch: refetchFavouritePlayers
  } = useQuery({
    queryKey: ['userFavouritesWithPlayers', user?.id],
    queryFn: getUserFavouritesWithPlayers,
    enabled: !!user,
  });

  // Process favourite players to include isFavourite flag
  const favouritePlayers = favouritePlayersData.map(fav => ({
    ...fav.players,
    isFavourite: true,
  })) as FavouritePlayer[];

  // Toggle favourite mutation with optimistic updates
  const toggleFavouriteMutation = useMutation({
    mutationFn: toggleFavourite,
    onMutate: async (playerId: string) => {
      // Cancel any outgoing refetches for favourites
      await queryClient.cancelQueries({ queryKey: ['userFavourites', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['userFavouritesWithPlayers', user?.id] });

      // Snapshot the previous values
      const previousFavouriteIds = queryClient.getQueryData(['userFavourites', user?.id]) as string[];
      const previousFavouritePlayers = queryClient.getQueryData(['userFavouritesWithPlayers', user?.id]);

      // Optimistically update favourite IDs
      const isCurrentlyFavourite = previousFavouriteIds?.includes(playerId);
      const newFavouriteIds = isCurrentlyFavourite
        ? previousFavouriteIds.filter(id => id !== playerId)
        : [...(previousFavouriteIds || []), playerId];

      queryClient.setQueryData(['userFavourites', user?.id], newFavouriteIds);

      // Optimistically update favourite players
      let newFavouritePlayers = previousFavouritePlayers;
      if (previousFavouritePlayers) {
        if (isCurrentlyFavourite) {
          // Remove from favourited players
          newFavouritePlayers = (previousFavouritePlayers as FavouriteWithPlayer[]).filter(
            fav => fav.players?.id !== playerId
          );
        } else {
          // In this case, we don't have the full player data to add
          // We'll just invalidate the query to refetch
          newFavouritePlayers = previousFavouritePlayers;
        }
      }

      queryClient.setQueryData(['userFavouritesWithPlayers', user?.id], newFavouritePlayers);

      // Return context for rollback
      return { previousFavouriteIds, previousFavouritePlayers };
    },
    onError: (err, playerId, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousFavouriteIds) {
        queryClient.setQueryData(['userFavourites', user?.id], context.previousFavouriteIds);
        queryClient.setQueryData(['userFavouritesWithPlayers', user?.id], context.previousFavouritePlayers);
      }
    },
    onSettled: () => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({ queryKey: ['userFavourites', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['userFavouritesWithPlayers', user?.id] });
    },
  });

  const isLoading = isFavouriteIdsLoading || isFavouritePlayersLoading;
  const error = favouriteIdsError || favouritePlayersError;

  const refetchFavourites = () => {
    refetchFavouriteIds();
    refetchFavouritePlayers();
  };

  const isFavourite = (playerId: string): boolean => {
    return favouriteIds.includes(playerId);
  };

  return {
    favouriteIds,
    favouritePlayers,
    isLoading,
    isError: !!error,
    error: error as Error,
    toggleFavouriteMutation,
    refetchFavourites,
    isFavourite,
  };
};