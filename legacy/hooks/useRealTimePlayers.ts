import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPlayers, PlayerWithKeeperInfo } from '@/integrations/supabase/services/players';
import { subscribeToPlayerChanges, removePlayerSubscription } from '@/integrations/supabase/services/playerSubscriptions';

export type Player = PlayerWithKeeperInfo;

export const useRealTimePlayers = (teamId?: string) => {
  const queryClient = useQueryClient();
  
  const queryResult = useQuery<Player[]>({
    queryKey: ['players', teamId],
    queryFn: () => fetchPlayers(teamId ? { teamId } : undefined),
  });

  useEffect(() => {
    // Set up real-time subscription for players table
    const channel = subscribeToPlayerChanges(() => {
      // When a player is updated or inserted, invalidate the players query to refetch the data
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
    }, teamId);

    // Clean up subscription
    return () => {
      removePlayerSubscription(channel);
    };
  }, [queryClient, teamId]);

  return queryResult;
};