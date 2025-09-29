import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Trophy, Star, Download } from 'lucide-react';
import { useDraftPageData } from '@/hooks/useDraftPageData';
import { useTeamKeepers } from '@/hooks/useTeamKeepers';
import { Tables } from '@/integrations/supabase/types';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamRosterAnalysis } from './TeamRosterAnalysis';
import { exportToCsv } from '@/utils/exportToCsv';
import { getCombinedPlayersForTeam as getUnifiedPlayers } from '@/utils/playerDataUtils';

export type Player = Tables<'players'>;

interface TeamRosterProps {
  teamName: string;
  teamId: string;
  season: string;
}

export function TeamRoster({ teamName, teamId, season }: TeamRosterProps) {
  const {
    players: allPlayers,
    getDraftedPlayersForTeam,
    draftPicks,
    isLoading: isLoadingDraftData
  } = useDraftPageData();

  // Fetch team-specific keeper data
  const { data: teamKeepers = [], isLoading: isLoadingKeepers } = useTeamKeepers({
    teamId,
    season
  });

  // Extract team-specific data using the consistent processing
  const draftedPlayers = getDraftedPlayersForTeam(teamName);

  // Transform keeper data to match player format and filter out null players
  const keepers = teamKeepers
    .filter(keeper => keeper.player) // Remove keepers with null players
    .map(keeper => ({
      ...keeper.player!,
      is_keeper: true,
      is_drafted: true // Keepers are considered drafted
    }));

  // Get unified player data for analysis
  const unifiedPlayers = getUnifiedPlayers(draftedPlayers, keepers);

  const isLoading = isLoadingDraftData || isLoadingKeepers;

  return (
    <Card className="p-4 md:p-6 bg-gradient-card shadow-card">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-court rounded-lg">
          <Trophy className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-xl font-bold">{teamName}</h3>
          <p className="text-sm text-muted-foreground">
            {draftedPlayers.length + keepers.length} player{draftedPlayers.length + keepers.length !== 1 ? 's' : ''} on roster
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCsv(`${teamName}_Roster_${season}.csv`, [...draftedPlayers, ...keepers])}
          className="ml-auto flex items-center gap-2"
        >
          <Download className="h-4 w-4" /> Export Roster
        </Button>
      </div>

      {/* Keepers Section */}
      <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Star className="h-5 w-5 text-yellow-500" /> Keepers ({keepers.length})
      </h4>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : keepers.length > 0 ? (
        <div className="space-y-3 mb-6">
          {keepers.map((keeper) => (
            <div
              key={keeper.id}
              className="flex items-center justify-between p-3 border-yellow-200 rounded-lg border"
            >
              <div className="flex-1">
                <div className="font-semibold text-sm mb-1">{keeper.name}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs bg-draft-active text-draft-active-foreground">
                    {keeper.position} (Keeper)
                  </Badge>
                  {keeper.is_rookie && (
                    <Badge variant="default" className="text-xs bg-blue-600 text-white">
                      Rookie
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {keeper.nba_team}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground mb-6">
          No keepers set for this team
        </div>
      )}

      {/* Drafted Players Section */}
      <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Users className="h-5 w-5 text-blue-500" /> Draft Picks ({draftedPlayers.length})
      </h4>
      {draftedPlayers.length > 0 ? (
        <div className="space-y-3">
          {draftedPlayers.map((player) => (
            <div
              key={player.id}
              className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 bg-gradient-card rounded-lg border"
            >
              <div className="flex-1 mb-2 md:mb-0">
                <div className="font-semibold text-sm mb-1">{player.name}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {player.position}
                  </Badge>
                  {player.is_rookie && (
                    <Badge variant="default" className="text-xs bg-blue-600 text-white">
                      Rookie
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {player.nba_team}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No players drafted yet</p>
        </div>
      )}

      {/* Team Roster Analysis Section */}
      <TeamRosterAnalysis players={unifiedPlayers} />
    </Card>
  );
}
