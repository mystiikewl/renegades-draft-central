import { useQuery } from '@tanstack/react-query';
import { fetchAllPlayers, PlayerWithKeeperInfo } from '@/integrations/supabase/services/players';

export type Player = PlayerWithKeeperInfo;

export const useAllPlayers = () => {
  return useQuery<Player[]>({
    queryKey: ['allPlayers'],
    queryFn: () => fetchAllPlayers(),
  });
};