import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { qk } from './queries';

export function useSkipPick(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('skip_pick', { p_season_id: seasonId });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.draftPicks(seasonId) });
      qc.invalidateQueries({ queryKey: qk.draftSettings(seasonId) });
      qc.invalidateQueries({ queryKey: qk.rosters(seasonId) });
      toast.success('Pick skipped');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
