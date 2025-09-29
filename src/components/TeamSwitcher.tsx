import { useState, useEffect } from 'react';
import { useTeams } from '@/hooks/useTeams';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamRoster } from '@/components/TeamRoster';
import { KeeperManagement } from '@/components/KeeperManagement';
import { useDraftPicks } from '@/hooks/useDraftPicks';
import { Tables } from '@/integrations/supabase/types';

export const TeamSwitcher = () => {
  const { data: teamsData = [], isLoading: isLoadingTeams } = useTeams();
  const [selectedTeam, setSelectedTeam] = useState<string | undefined>(undefined);
  const { data: draftPicksData = [], isLoading: isLoadingDraftPicks } = useDraftPicks();

  useEffect(() => {
    if (teamsData.length > 0) {
      setSelectedTeam(teamsData[0].id);
    }
  }, [teamsData]);

  const getDraftedPlayersForTeam = (teamId: string) => {
    return draftPicksData
      .filter((pick) => pick.current_team.id === teamId && pick.player_id)
      .map((pick) => {
        const player = pick.player as Tables<'players'>;
        return {
          ...player,
          round: pick.round,
          pick: pick.pick_number,
          overallPick: pick.overall_pick,
          nbaTeam: player.nba_team,
        };
      });
  };

  if (isLoadingTeams || isLoadingDraftPicks) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Select onValueChange={setSelectedTeam} value={selectedTeam}>
        <SelectTrigger>
          <SelectValue placeholder="Select a team" />
        </SelectTrigger>
        <SelectContent>
          {teamsData.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedTeam && (
        <>
          <TeamRoster
            teamName={teamsData.find((team) => team.id === selectedTeam)?.name || ''}
            teamId={selectedTeam}
            season="2025-26"
          />
          <KeeperManagement teamId={selectedTeam} season="2025-26" />
        </>
      )}
    </div>
  );
};
