import { useQuery } from '@tanstack/react-query';
import { fetchTeams, Team } from '@/integrations/supabase/services/teams';

export const useTeams = () => {
  return useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => fetchTeams(),
  });
};
