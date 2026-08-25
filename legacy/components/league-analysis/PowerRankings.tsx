import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { TeamStats } from '@/utils/leagueAnalysis';

interface PowerRankingsProps {
  sortedByFantasyScore: TeamStats[];
}

const PowerRankings: React.FC<PowerRankingsProps> = ({ sortedByFantasyScore }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overall Team Power Rankings (Total Fantasy Score)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Total Fantasy Score</TableHead>
              <TableHead>Avg. Player Score</TableHead>
              <TableHead>Players</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedByFantasyScore.map((team, index) => (
              <TableRow key={team.teamId}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>{team.teamName}</TableCell>
                <TableCell>{team.totalFantasyScore}</TableCell>
                <TableCell>{team.avgFantasyScore}</TableCell>
                <TableCell>{team.playerCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default PowerRankings;
