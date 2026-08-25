import { useQuery } from '@tanstack/react-query';
import { fetchKeepersByTeam, fetchKeepers, Keeper } from '@/integrations/supabase/services/keepers';
import { transformKeeperData, validateKeeperData, debugKeeperData, KeeperPlayer } from '@/utils/playerDataUtils';

interface UseTeamKeepersProps {
  teamId?: string; // Make teamId optional
  season: string;
}

export const useTeamKeepers = ({ teamId, season }: UseTeamKeepersProps) => {
  return useQuery<KeeperPlayer[]>({
    queryKey: ['teamKeepers', teamId || 'all', season],
    queryFn: async () => {
      try {
        let keepers: any[];

        if (teamId) {
          // Existing logic for fetching keepers for a specific team
          keepers = await fetchKeepersByTeam(teamId);
        } else {
          // Modified logic to always fetch all keepers regardless of user role
          keepers = await fetchKeepers();
        }

        // Filter by season
        const seasonFilteredKeepers = keepers.filter(keeper => keeper.season === season);

        // Debug logging for development
        if (process.env.NODE_ENV === 'development') {
          debugKeeperData(seasonFilteredKeepers, `useTeamKeepers ${teamId || 'all'}`);
        }

        // Transform and validate keeper data
        const transformedKeepers = transformKeeperData(seasonFilteredKeepers);

        // Filter out invalid keepers
        const validKeepers = transformedKeepers.filter(validateKeeperData);

        return validKeepers;
      } catch (error) {
        console.error('Error in useTeamKeepers:', error);
        return [];
      }
    },
    enabled: !!season,
  });
};
