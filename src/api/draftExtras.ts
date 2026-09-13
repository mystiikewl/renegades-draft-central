import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { invalidateTables } from './invalidation';

export function useSkipPick(seasonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('skip_pick', { p_season_id: seasonId });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      invalidateTables(qc, seasonId, 'draft_picks', 'draft_settings', 'rosters');
      toast.success('Pick skipped');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
