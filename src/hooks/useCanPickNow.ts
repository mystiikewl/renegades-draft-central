import { useMemo } from 'react';
import { useDraftPicks, useDraftSettings } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';

/**
 * True when the draft is live (running/paused) and the next unused pick
 * belongs to the current user's team (admins can always pick).
 */
export function useCanPickNow(seasonId: string | undefined): boolean {
  const { profile } = useAuth();
  const { data: settings } = useDraftSettings(seasonId);
  const { data: picks } = useDraftPicks(seasonId);

  return useMemo(() => {
    if (!profile?.is_admin && !profile?.team_id) return false;
    if (settings?.status !== 'running' && settings?.status !== 'paused') return false;
    const next = picks?.find((p) => !p.is_used);
    if (!next) return false;
    return !!profile.is_admin || next.team_id === profile.team_id;
  }, [profile?.team_id, profile?.is_admin, settings?.status, picks]);
}
