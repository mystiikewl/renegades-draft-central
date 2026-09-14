import { useAuth } from '@/auth/AuthContext';
import { useActiveSeason, useDraftPicks, useDraftSettings } from '@/api/queries';
import { useDraftRealtime } from '@/api/realtime';
import { nextPick } from '@/lib/draftState';
import { useOnTheClockNotification } from '@/hooks/useOnTheClockNotification';

/** Keeps the turn alert active while a manager navigates anywhere in the league. */
export function DraftNotifications() {
  const { profile } = useAuth();
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  useDraftRealtime(seasonId);
  const { data: settings } = useDraftSettings(seasonId);
  const { data: picks } = useDraftPicks(seasonId);
  const onClock = picks ? nextPick(picks) : null;

  useOnTheClockNotification({
    isMyTurn:
      settings?.status === 'running' &&
      !!profile?.team_id &&
      !!onClock &&
      onClock.team_id === profile.team_id,
    pickNumber: onClock?.pick_number,
    seasonLabel: season?.label,
  });

  return null;
}
