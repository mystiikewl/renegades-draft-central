import { useMemo } from 'react';
import { getTeamColorPalette } from '@/lib/teams';
import type { DraftPickWithRelations } from '@/integrations/supabase/types/draftPicks';

interface DraftStats {
  totalPicks: number;
  completedPicks: number;
  availablePlayers: number;
  progress: number;
}

interface UseDraftStatusProps {
  draftStats: DraftStats;
  currentPick: DraftPickWithRelations | null;
  teams: string[];
  canMakePick: boolean;
}

export const useDraftStatus = ({ draftStats, currentPick, teams, canMakePick }: UseDraftStatusProps) => {
  return useMemo(() => {
    const isComplete = draftStats.totalPicks > 0 &&
                      draftStats.completedPicks >= draftStats.totalPicks;

    const isOnClock = !isComplete && currentPick && canMakePick;

    const currentTeam = currentPick?.current_team;
    const teamPalette = currentTeam?.name ?
      getTeamColorPalette(currentTeam.name, teams) : null;

    return {
      isComplete,
      isOnClock,
      currentTeam,
      teamPalette
    };
  }, [draftStats, currentPick, teams, canMakePick]);
};