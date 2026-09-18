import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from './queries';
import { invalidateTables } from './invalidation';

/**
 * Trade notifications are written exclusively inside SECURITY DEFINER trade
 * RPCs (plus the system-cancel trigger on trades); the client reads its own
 * team's rows (RLS) and flips read_at through mark_notifications_read.
 */

/** Exact unread count for the caller's team (head request, no row payloads). */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [...qk.notifications, 'unread-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** No ids = mark everything unread for the caller's team. */
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      const { error } = await supabase.rpc('mark_notifications_read', {
        p_ids: ids ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateTables(qc, undefined, 'notifications'),
  });
}
