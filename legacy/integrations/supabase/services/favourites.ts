import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type UserFavourite = Tables<'user_favourites'>;
export type FavouriteWithPlayer = UserFavourite & {
  players?: Tables<'players'>;
};

/**
 * Get all favourite player IDs for the current user
 */
export const getUserFavouriteIds = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('user_favourites')
    .select('player_id');

  if (error) throw error;
  return data.map(fav => fav.player_id);
};

/**
 * Get all user favourites with player details
 */
export const getUserFavouritesWithPlayers = async (): Promise<FavouriteWithPlayer[]> => {
  const { data, error } = await supabase
    .from('user_favourites')
    .select(`
      *,
      players (*)
    `);

  if (error) throw error;
  return data as FavouriteWithPlayer[];
};

/**
 * Add a player to user's favourites using database function
 */
export const addFavourite = async (playerId: string): Promise<UserFavourite> => {
  const { data, error } = await supabase.rpc('insert_user_favourite', {
    target_player_id: playerId
  });

  if (error) throw error;

  // Handle the JSON response from the database function
  const response = data as any;
  if (response?.error) {
    throw new Error(response.error);
  }

  return response as UserFavourite;
};

/**
 * Remove a player from user's favourites
 */
export const removeFavourite = async (playerId: string): Promise<void> => {
  const { error } = await supabase
    .from('user_favourites')
    .delete()
    .eq('player_id', playerId);

  if (error) throw error;
};

/**
 * Toggle favourite status for a player
 */
export const toggleFavourite = async (playerId: string): Promise<boolean> => {
  const { data: existing } = await supabase
    .from('user_favourites')
    .select('id')
    .eq('player_id', playerId)
    .maybeSingle();

  if (existing) {
    await removeFavourite(playerId);
    return false; // No longer favourited
  } else {
    await addFavourite(playerId);
    return true; // Now favourited
  }
};

/**
 * Check if a player is favourited by current user
 */
export const isPlayerFavourited = async (playerId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('user_favourites')
    .select('id')
    .eq('player_id', playerId)
    .maybeSingle();

  return !!data;
};