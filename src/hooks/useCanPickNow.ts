import { useMemo } from 'react';
import { useDraftPicks, useDraftSettings } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';

/** True only when the draft is actively running and the current slot belongs to the user. */
export function useCanPickNow(seasonId: string | undefined): boolean {
  const { profile } = useAuth();
  const { data: settings } = useDraftSettings(seasonId);
  const { data: picks } = useDraftPicks(seasonId);

  return useMemo(() => {
    if (!profile?.is_admin && !profile?.team_id) return false;
    if (settings?.status !== 'running') return false;
    const next = picks?.find((p) => !p.is_used);
    if (!next) return false;
    return !!profile.is_admin || next.team_id === profile.team_id;
  }, [profile?.team_id, profile?.is_admin, settings?.status, picks]);
}
