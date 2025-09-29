import { useQuery } from '@tanstack/react-query';
import { fetchPlayers, PlayerWithKeeperInfo } from '@/integrations/supabase/services/players';

export type Player = PlayerWithKeeperInfo;

export const usePlayers = (teamId?: string) => {
  return useQuery<Player[]>({
    queryKey: ['players', teamId],
    queryFn: () => fetchPlayers(teamId ? { teamId } : undefined),
  });
};
