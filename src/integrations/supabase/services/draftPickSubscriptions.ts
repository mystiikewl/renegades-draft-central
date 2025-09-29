import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { DraftPickWithRelations } from '@/integrations/supabase/types/draftPicks';

export const fetchDraftPicksWithRealtime = async (): Promise<DraftPickWithRelations[]> => {
  const { data, error } = await supabase
    .from('draft_picks')
    .select(`
      *,
      player:players(*),
      original_team:teams!draft_picks_original_team_id_fkey(*),
      current_team:teams!draft_picks_current_team_id_fkey(*)
    `)
    .order('round', { ascending: true })
    .order('pick_number', { ascending: true });
  
  if (error) throw error;
  return data as DraftPickWithRelations[];
};

export const subscribeToDraftPickChanges = (
  callback: (payload: RealtimePostgresChangesPayload<DraftPickWithRelations>) => void
): RealtimeChannel => {
  const channel = supabase
    .channel('draft_picks_changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'draft_picks',
      },
      callback
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'draft_picks',
      },
      callback
    )
    .subscribe();

  return channel;
};

export const removeDraftPickSubscription = (channel: RealtimeChannel) => {
  supabase.removeChannel(channel);
};