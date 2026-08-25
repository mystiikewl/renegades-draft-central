import { useQuery } from '@tanstack/react-query';
import { fetchDraftPicks, DraftPick } from '@/integrations/supabase/services/draftPicks';

export type DraftPick = DraftPick;

export const useDraftPicks = () => {
  return useQuery<DraftPick[]>({
    queryKey: ['draftPicks'],
    queryFn: () => fetchDraftPicks(),
  });
};
