import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLeagueAnalysisData } from '@/hooks/useLeagueAnalysisData';
import { useAllPlayers } from '@/hooks/useAllPlayers';
import { TeamStats } from '@/utils/leagueAnalysis';
import { calculateFantasyScore } from '@/utils/fantasyScore';

interface PlayerStats {
  id: string;
  name: string;
  team: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  three_pointers_made: number;
  turnovers: number;
  fantasyScore: number;
}

export const TopPerformers: React.FC = () => {
  const {
    sortedByPoints: teamSortedByPoints,
    sortedByRebounds: teamSortedByRebounds,
    sortedByAssists: teamSortedByAssists,
    sortedBySteals: teamSortedBySteals,
    sortedByBlocks: teamSortedByBlocks,
    sortedByThreePointersMade: teamSortedByThreePointersMade,
    sortedByTurnovers: teamSortedByTurnovers,
    isLoading: isTeamsLoading,
  } = useLeagueAnalysisData();
  
  const { data: allPlayers = [], isLoading: isPlayersLoading } = useAllPlayers();
  
  // Transform player data to include fantasy score
  const playersWithStats: PlayerStats[] = React.useMemo(() => {
    if (!allPlayers || allPlayers.length === 0) return [];
    
    return allPlayers.map(player => ({
      id: player.id,
      name: player.name,
      team: player.nba_team || 'N/A',
      points: player.points || 0,
      rebounds: player.total_rebounds || 0,
      assists: player.assists || 0,
      steals: player.steals || 0,
      blocks: player.blocks || 0,
      three_pointers_made: player.three_pointers_made || 0,
      turnovers: player.turnovers || 0,
      fantasyScore: calculateFantasyScore(player),
    })).sort((a, b) => b.fantasyScore - a.fantasyScore);
  }, [allPlayers]);
  
  // Sort players by each category
  const sortedByPoints = React.useMemo(() => 
    [...playersWithStats].sort((a, b) => b.points - a.points), 
    [playersWithStats]
  );
  
  const sortedByRebounds = React.useMemo(() => 
    [...playersWithStats].sort((a, b) => b.rebounds - a.rebounds), 
    [playersWithStats]
  );
  
  const sortedByAssists = React.useMemo(() => 
    [...playersWithStats].sort((a, b) => b.assists - a.assists), 
    [playersWithStats]
  );
  
  const sortedBySteals = React.useMemo(() => 
    [...playersWithStats].sort((a, b) => b.steals - a.steals), 
    [playersWithStats]
  );
  
  const sortedByBlocks = React.useMemo(() => 
    [...playersWithStats].sort((a, b) => b.blocks - a.blocks), 
    [playersWithStats]
  );
  
  const sortedByThreePointersMade = React.useMemo(() => 
    [...playersWithStats].sort((a, b) => b.three_pointers_made - a.three_pointers_made), 
    [playersWithStats]
  );
  
  const sortedByTurnovers = React.useMemo(() => 
    [...playersWithStats].sort((a, b) => a.turnovers - b.turnovers), 
    [playersWithStats]
  );
  
  const sortedByFantasyScore = React.useMemo(() => 
    [...playersWithStats].sort((a, b) => b.fantasyScore - a.fantasyScore), 
    [playersWithStats]
  );

  const isLoading = isTeamsLoading || isPlayersLoading;

  const renderTopPlayersTable = (title: string, data: PlayerStats[], statKey: keyof PlayerStats, isInverseSort = false) => (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 10).map((player, index) => (
                <TableRow key={`${player.id}-${index}`}>
                  <TableCell className="font-medium">{player.name}</TableCell>
                  <TableCell>{player.team}</TableCell>
                  <TableCell className="text-right">
                    {typeof player[statKey] === 'number' ? (player[statKey] as number).toFixed(1) : player[statKey]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {renderTopPlayersTable('Fantasy Leaders', sortedByFantasyScore, 'fantasyScore')}
      {renderTopPlayersTable('Points Leaders', sortedByPoints, 'points')}
      {renderTopPlayersTable('Rebounds Leaders', sortedByRebounds, 'rebounds')}
      {renderTopPlayersTable('Assists Leaders', sortedByAssists, 'assists')}
      {renderTopPlayersTable('Steals Leaders', sortedBySteals, 'steals')}
      {renderTopPlayersTable('Blocks Leaders', sortedByBlocks, 'blocks')}
      {renderTopPlayersTable('3PM Leaders', sortedByThreePointersMade, 'three_pointers_made')}
      {renderTopPlayersTable('Turnovers (Lowest is Better)', sortedByTurnovers, 'turnovers', true)}
    </div>
  );
};
