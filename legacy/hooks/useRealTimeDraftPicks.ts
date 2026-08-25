import { useEffect, useState } from 'react';
import { 
  fetchDraftPicksWithRealtime, 
  subscribeToDraftPickChanges, 
  removeDraftPickSubscription
} from '@/integrations/supabase/services/draftPickSubscriptions';
import { DraftPickWithRelations } from '@/integrations/supabase/types/draftPicks';

export type { DraftPickWithRelations };

export const useRealTimeDraftPicks = () => {
  const [draftPicks, setDraftPicks] = useState<DraftPickWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    const fetchDraftPicks = async () => {
      try {
        const data = await fetchDraftPicksWithRealtime();
        setDraftPicks(data);
      } catch (error) {
        console.error('Error fetching draft picks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDraftPicks();

    // Set up real-time subscription
    const channel = subscribeToDraftPickChanges((payload) => {
      // When a pick is updated, re-fetch the full pick with its relations
      const fetchUpdatedPick = async () => {
        try {
          const data = await fetchDraftPicksWithRealtime();
          setDraftPicks(data);
        } catch (error) {
          console.error('Error fetching updated draft picks:', error);
        }
      };
      fetchUpdatedPick();
    });

    // Clean up subscription
    return () => {
      removeDraftPickSubscription(channel);
    };
  }, []);

  return { draftPicks, loading };
};
