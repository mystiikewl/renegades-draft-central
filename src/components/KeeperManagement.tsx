import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { usePlayers } from '@/hooks/usePlayers';
import { Tables } from '@/integrations/supabase/types';
import { useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamKeepers } from '@/hooks/useTeamKeepers';
import { TeamStrengthsWeaknesses } from '@/components/league-analysis/TeamStrengthsWeaknesses';
import { useTeams } from '@/hooks/useTeams';
import { useDraftState } from '@/hooks/useDraftState';
import { getCombinedPlayersForTeam, calculateTeamStats } from '@/utils/leagueAnalysis';
import { EnhancedSearchableSelect, EnhancedSearchableSelectOption } from '@/components/ui/searchable-select';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface KeeperManagementProps {
  teamId?: string;
  season?: string;
  onKeepersSelected?: () => void;
}

export const KeeperManagement = ({ teamId: propTeamId, season = "2025-26", onKeepersSelected }: KeeperManagementProps) => {
  const { profile } = useAuth();
  const currentTeamId = propTeamId || profile?.team_id;
  const { data: availablePlayers = [], isLoading: isLoadingPlayers } = usePlayers();
  const { data: keepers = [], isLoading: isLoadingKeepers, refetch: refetchKeepers } = useTeamKeepers({ teamId: currentTeamId || '', season });
  const { data: teamsData = [] } = useTeams();
  const { draftPicks } = useDraftState();
  const [newKeeperPlayerId, setNewKeeperPlayerId] = useState('');
  const [maxKeepers, setMaxKeepers] = useState(9);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const loading = isLoadingPlayers || isLoadingKeepers;

  // Transform available players for EnhancedSearchableSelect - memoized for performance
   const playerOptions: EnhancedSearchableSelectOption[] = useMemo(() => {
     return availablePlayers
       .filter(
         (player) =>
           !keepers.some((keeper) => keeper.player?.id === player.id)
       )
       .map((player) => {
         const rank = player.rank ? `Rank #${player.rank}` : '';
         return {
           value: player.id,
           label: `${player.name} (${player.position}) - ${player.nba_team}${rank ? ` • ${rank}` : ''}`,
           searchText: `${player.name} ${player.position} ${player.nba_team} ${player.rank || ''} ${player.points || ''} ${player.total_rebounds || ''} ${player.assists || ''}`,
           player: player,
         };
       });
   }, [availablePlayers, keepers]);

  // Get team stats for visualization
  const currentTeam = teamsData.find(t => t.id === currentTeamId);

  // Transform keepers to match KeeperPlayer type expected by getCombinedPlayersForTeam - memoized
   const keeperPlayers: (Tables<'keepers'> & { player: Tables<'players'> })[] = useMemo(() => {
     return keepers.map(keeper => ({
       ...keeper,
       player: keeper.player!
     }));
   }, [keepers]);

  const allPlayersForTeam = currentTeamId ? getCombinedPlayersForTeam(
    currentTeamId,
    season,
    draftPicks,
    keeperPlayers
  ) : [];
  
  const teamStats = currentTeam ? calculateTeamStats(currentTeam.id, currentTeam.name, allPlayersForTeam) : undefined;
  
  // Calculate league average
  const leagueStats = teamsData.map(team => {
    const teamPlayers = getCombinedPlayersForTeam(
      team.id,
      season,
      draftPicks,
      keeperPlayers
    );
    return calculateTeamStats(team.id, team.name, teamPlayers);
  });
  
  const leagueAverageStats = leagueStats.length > 0 ? {
    ...leagueStats[0],
    totalFantasyScore: leagueStats.reduce((sum, team) => sum + team.totalFantasyScore, 0) / leagueStats.length,
    avgFantasyScore: leagueStats.reduce((sum, team) => sum + team.avgFantasyScore, 0) / leagueStats.length,
    points: leagueStats.reduce((sum, team) => sum + team.points, 0) / leagueStats.length,
    rebounds: leagueStats.reduce((sum, team) => sum + team.rebounds, 0) / leagueStats.length,
    assists: leagueStats.reduce((sum, team) => sum + team.assists, 0) / leagueStats.length,
    steals: leagueStats.reduce((sum, team) => sum + team.steals, 0) / leagueStats.length,
    blocks: leagueStats.reduce((sum, team) => sum + team.blocks, 0) / leagueStats.length,
    turnovers: leagueStats.reduce((sum, team) => sum + team.turnovers, 0) / leagueStats.length,
    three_pointers_made: leagueStats.reduce((sum, team) => sum + team.three_pointers_made, 0) / leagueStats.length,
  } : undefined;

  const addKeeper = async () => {
    if (!newKeeperPlayerId) {
      toast({
        title: "Error",
        description: "Please select a player",
        variant: "destructive"
      });
      return;
    }

    if (keepers.length >= maxKeepers) {
      toast({
        title: "Error",
        description: `Maximum of ${maxKeepers} keepers allowed per team`,
        variant: "destructive"
      });
      return;
    }

    // Check if player is already a keeper
    if (keepers.some(keeper => keeper.player?.id === newKeeperPlayerId)) {
      toast({
        title: "Error",
        description: "This player is already a keeper",
        variant: "destructive"
      });
      return;
    }

    console.log('Attempting to add keeper:', { newKeeperPlayerId, teamId: currentTeamId, season });

    const { error } = await supabase
      .from('keepers')
      .insert({
        player_id: newKeeperPlayerId,
        team_id: currentTeamId,
        season: season
      });

    if (error) {
      console.error('Failed to add keeper:', error);
      console.error('Add keeper error details:', error.message);
      toast({
        title: "Error",
        description: `Failed to add keeper: ${error.message}`,
        variant: "destructive"
      });
    } else {
      // Update player status in the players table
      const { error: playerUpdateError } = await supabase
        .from('players')
        .update({ is_keeper: true, is_drafted: true })
        .eq('id', newKeeperPlayerId);

      if (playerUpdateError) {
        console.error('Failed to update player status after adding keeper:', playerUpdateError);
        toast({
          title: "Error",
          description: `Failed to update player status: ${playerUpdateError.message}`,
          variant: "destructive"
        });
        // Consider rolling back keeper addition if player update fails
      } else {
        toast({
          title: "Success",
          description: "Keeper added successfully"
        });
        setNewKeeperPlayerId('');
        refetchKeepers(); // Refetch keepers using the hook's refetch function
        queryClient.invalidateQueries({ queryKey: ['players'] }); // Invalidate players to update their keeper status if needed elsewhere
        queryClient.invalidateQueries({ queryKey: ['teamKeepers'] }); // Invalidate all keepers query for PlayerPool
        queryClient.invalidateQueries({ queryKey: ['players', undefined] }); // Force re-fetch of all players in usePlayers hook
      }
    }
  };

  const removeKeeper = async (playerId: string) => {
    const { error } = await supabase
      .from('keepers')
      .delete()
      .eq('player_id', playerId)
      .eq('team_id', currentTeamId)
      .eq('season', season);

    if (error) {
      console.error('Failed to remove keeper:', error);
      toast({
        title: "Error",
        description: `Failed to remove keeper: ${error.message}`,
        variant: "destructive"
      });
    } else {
      // Update player status in the players table
      const { error: playerUpdateError } = await supabase
        .from('players')
        .update({ is_keeper: false, is_drafted: false })
        .eq('id', playerId);

      if (playerUpdateError) {
        console.error('Failed to update player status after removing keeper:', playerUpdateError);
        toast({
          title: "Error",
          description: `Failed to update player status: ${playerUpdateError.message}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Keeper removed successfully"
        });
        refetchKeepers(); // Refetch keepers using the hook's refetch function
        queryClient.invalidateQueries({ queryKey: ['players'] }); // Invalidate players to update their keeper status if needed elsewhere
        queryClient.invalidateQueries({ queryKey: ['teamKeepers'] }); // Invalidate all keepers query for PlayerPool
        queryClient.invalidateQueries({ queryKey: ['players', undefined] }); // Force re-fetch of all players in usePlayers hook
      }
    }
  };

  return (
    <div className="space-y-6 w-full">
      <Card className="w-full">
        <CardHeader className="pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl">Team Keepers</CardTitle>
              <CardDescription className="mt-1">
                Manage your team's keepers for the {season} season
              </CardDescription>
            </div>
            <div className="text-center sm:text-right flex-shrink-0">
              <div className="text-2xl font-bold text-primary">{keepers.length}/{maxKeepers}</div>
              <div className="text-sm text-muted-foreground">keepers selected</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <span className="text-sm font-medium">Keeper Progress</span>
              <span className="text-sm text-muted-foreground">
                {Math.round((keepers.length / maxKeepers) * 100)}%
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  keepers.length >= maxKeepers
                    ? 'bg-green-500'
                    : keepers.length >= maxKeepers * 0.8
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min((keepers.length / maxKeepers) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 overflow-hidden">
          <div className="bg-muted/50 rounded-lg p-4 border w-full">
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              Add New Keeper
            </h3>
            <div className="space-y-3 w-full">
              <div className="w-full">
                <EnhancedSearchableSelect
                  options={playerOptions}
                  value={newKeeperPlayerId}
                  onValueChange={setNewKeeperPlayerId}
                  placeholder="Search players..."
                  disabled={loading || keepers.length >= maxKeepers}
                  emptyText="No available players found."
                />
              </div>
              <Button
                onClick={addKeeper}
                disabled={loading || keepers.length >= maxKeepers || !newKeeperPlayerId}
                className="w-full transition-all duration-200 hover:scale-105"
                size={isMobile ? "lg" : "default"}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Adding...
                  </div>
                ) : (
                  "Add Keeper"
                )}
              </Button>
              {keepers.length >= maxKeepers && (
                <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span className="w-4 h-4">⚠️</span>
                  Maximum keepers reached
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-muted-foreground">Loading keepers...</p>
            </div>
          ) : keepers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 opacity-50">🏀</div>
              <p className="text-lg font-medium">No keepers selected</p>
              <p className="text-sm">Start building your team by adding keepers above</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground">
                  Current Keepers ({keepers.length})
                </h3>
              </div>
              <div className="w-full">
                {isMobile ? (
                  // Mobile card layout
                  <div className="space-y-3">
                    {keepers.map((keeper) => (
                      <div key={keeper.id} className="bg-card border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-base">{keeper.player?.name}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {keeper.player?.position} • {keeper.player?.nba_team}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-border/50">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="w-full sm:w-auto"
                              >
                                Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="w-[90vw] max-w-[90vw]">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Keeper</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {keeper.player?.name} from your keepers?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeKeeper(keeper.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                                >
                                  Remove Keeper
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Desktop table layout
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-semibold">Player</TableHead>
                          <TableHead className="hidden sm:table-cell font-semibold">Position</TableHead>
                          <TableHead className="hidden md:table-cell font-semibold">Team</TableHead>
                          <TableHead className="text-right font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keepers.map((keeper) => (
                          <TableRow key={keeper.id}>
                            <TableCell className="font-medium">
                              <div>
                                <div>{keeper.player?.name}</div>
                                <div className="sm:hidden text-xs text-muted-foreground">
                                  {keeper.player?.position} - {keeper.player?.nba_team}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">{keeper.player?.position}</TableCell>
                            <TableCell className="hidden md:table-cell">{keeper.player?.nba_team}</TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                  >
                                    Remove
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Keeper</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove {keeper.player?.name} from your keepers?
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => removeKeeper(keeper.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remove Keeper
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
      </Card>

      {/* Keeper Impact Visualization */}
      <TeamStrengthsWeaknesses 
        players={allPlayersForTeam} 
        teamStats={teamStats}
        leagueAverageStats={leagueAverageStats}
      />

      {onKeepersSelected && (
        <Button onClick={onKeepersSelected} className="w-full mt-4">
          Confirm Keepers and Continue
        </Button>
      )}
    </div>
  );
};
