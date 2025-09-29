import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLeagueAnalysisData } from '@/hooks/useLeagueAnalysisData';
import { TeamStats } from '@/utils/leagueAnalysis';

export const CategoricalRankings: React.FC = () => {
  const {
    sortedByPoints,
    sortedByRebounds,
    sortedByAssists,
    sortedBySteals,
    sortedByBlocks,
    sortedByThreePointersMade,
    sortedByTurnovers,
    isLoading,
  } = useLeagueAnalysisData();

  const renderTable = (title: string, data: TeamStats[], statKey: keyof TeamStats, isInverseSort = false) => (
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
                <TableHead>Rank</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 10).map((team, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{team.teamName}</TableCell>
                  <TableCell className="text-right">
                    {typeof team[statKey] === 'number' ? (team[statKey] as number).toFixed(1) : team[statKey]}
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
      {renderTable('Top 10 Points', sortedByPoints, 'points')}
      {renderTable('Top 10 Rebounds', sortedByRebounds, 'rebounds')}
      {renderTable('Top 10 Assists', sortedByAssists, 'assists')}
      {renderTable('Top 10 Steals', sortedBySteals, 'steals')}
      {renderTable('Top 10 Blocks', sortedByBlocks, 'blocks')}
      {renderTable('Top 10 Three-Pointers Made', sortedByThreePointersMade, 'three_pointers_made')}
      {renderTable('Turnovers (Lower is Better)', sortedByTurnovers, 'turnovers', true)}
    </div>
  );
};
