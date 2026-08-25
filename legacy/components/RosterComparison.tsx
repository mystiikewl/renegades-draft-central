import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamRosterAnalysis } from './TeamRosterAnalysis';
import { useTeams } from '@/hooks/useTeams';
import { useDraftState } from '@/hooks/useDraftState';
import { Tables } from '@/integrations/supabase/types';
import { useTeamKeepers } from '@/hooks/useTeamKeepers'; // Import useTeamKeepers
import { Skeleton } from '@/components/ui/skeleton';
import { getCombinedPlayersForTeam as getUnifiedPlayers } from '@/utils/playerDataUtils';
import { KeeperPlayer } from '@/utils/playerDataUtils';

interface RosterComparisonProps {
  currentSeason: string;
}

export function RosterComparison({ currentSeason }: RosterComparisonProps) {
  const { data: teamsData = [], isLoading: isLoadingTeams } = useTeams();
  const { draftPicks, isLoadingDraftState } = useDraftState();

  const [team1Id, setTeam1Id] = useState<string | undefined>(undefined);
  const [team2Id, setTeam2Id] = useState<string | undefined>(undefined);

  // Fetch keepers for both teams at the component level
  const { data: team1Keepers = [], isLoading: isLoadingTeam1Keepers } = useTeamKeepers({ teamId: team1Id, season: currentSeason });
  const { data: team2Keepers = [], isLoading: isLoadingTeam2Keepers } = useTeamKeepers({ teamId: team2Id, season: currentSeason });

  // Helper function to get combined players (drafted and keepers) for a specific team
  const getCombinedPlayersForTeam = (teamId: string, keepers: KeeperPlayer[]) => {
    const team = teamsData.find(t => t.id === teamId);
    if (!team) return [];

    // Filter drafted players for the selected team
    const teamDraftPicks = draftPicks.filter(pick => pick.current_team_id === teamId && pick.player);

    // Map drafted players to a consistent format, including overallPick
    const mappedDraftedPlayers = teamDraftPicks.map((pick, index) => ({
      ...pick.player!,
      round: pick.round,
      pick: pick.pick_number,
      overallPick: draftPicks.findIndex(dp => dp.id === pick.id) + 1, // Calculate overallPick based on original draftPicks array
      nbaTeam: pick.player!.nba_team,
    })) as (Tables<'players'> & { round: number; pick: number; overallPick: number; nbaTeam: string; })[];

    // Transform keepers to player format for consistency
    const transformedKeepers = keepers
      .filter(keeper => keeper.player)
      .map(keeper => ({
        ...keeper.player!,
        is_keeper: true,
        is_drafted: true,
        drafted_by_team_id: keeper.team_id
      }));

    // Combine drafted players and transformed keepers
    const allPlayers: Tables<'players'>[] = [
      ...transformedKeepers,
      ...mappedDraftedPlayers,
    ];

    return allPlayers;
  };

  const team1Players = getCombinedPlayersForTeam(team1Id, team1Keepers);
  const team2Players = getCombinedPlayersForTeam(team2Id, team2Keepers);

  const team1Name = teamsData.find(t => t.id === team1Id)?.name || 'Select Team 1';
  const team2Name = teamsData.find(t => t.id === team2Id)?.name || 'Select Team 2';

  if (isLoadingTeams || isLoadingDraftState || isLoadingTeam1Keepers || isLoadingTeam2Keepers) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-[400px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <Card className="p-4 md:p-6 bg-gradient-card shadow-card">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Roster Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Team 1 Selector */}
          <div>
            <Select value={team1Id} onValueChange={setTeam1Id}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Team 1" />
              </SelectTrigger>
              <SelectContent>
                {teamsData.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team 2 Selector */}
          <div>
            <Select value={team2Id} onValueChange={setTeam2Id}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Team 2" />
              </SelectTrigger>
              <SelectContent>
                {teamsData.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Comparison View */}
        {(team1Id && team2Id) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">{team1Name}</h3>
              <TeamRosterAnalysis players={team1Players} />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">{team2Name}</h3>
              <TeamRosterAnalysis players={team2Players} />
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Select two teams to compare their rosters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
