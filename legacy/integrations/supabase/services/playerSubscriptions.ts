import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Tables } from '@/integrations/supabase/types';

type Player = Tables<'players'>;

export const subscribeToPlayerChanges = (
  callback: (payload: RealtimePostgresChangesPayload<Player>) => void,
  teamId?: string
): RealtimeChannel => {
  // Set up real-time subscription for players table
  const channel = supabase
    .channel('players-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'players',
      },
      callback
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'players',
      },
      callback
    )
    .subscribe();

  return channel;
};

export const removePlayerSubscription = (channel: RealtimeChannel) => {
  supabase.removeChannel(channel);
};