import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ScatterChart, Scatter, ComposedChart, Line } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamStats, calculateDraftEfficiencyData, calculatePositionalBalanceData, preparePositionalBalanceChartData } from '@/utils/leagueAnalysis';
import { calculateFantasyAnalysis } from '@/utils/fantasyAnalysis';

type RadarChartDataItem = Array<{ subject: string; [key: string]: number | string; fullMark: number }>;

// Custom tooltip with better contrast
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-md p-3 shadow-lg">
        <p className="font-medium text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-medium">{entry.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface VisualizationsProps {
  sortedByFantasyScore: TeamStats[];
  selectedTeamForRadar: string;
  setSelectedTeamForRadar: (teamId: string) => void;
  radarChartData: RadarChartDataItem[]; // Recharts data structure
  teamsData: { id: string; name: string }[];
  selectedTeamName: string;
  draftPicks: any[]; // Draft picks data
  allKeepers: any[]; // Keepers data
  currentSeason: string;
}

const Visualizations: React.FC<VisualizationsProps> = ({
  sortedByFantasyScore,
  selectedTeamForRadar,
  setSelectedTeamForRadar,
  radarChartData,
  teamsData,
  selectedTeamName,
  draftPicks,
  allKeepers,
  currentSeason,
}) => {
  // Calculate data for new charts
  const draftEfficiencyData = React.useMemo(() =>
    calculateDraftEfficiencyData(draftPicks), [draftPicks]
  );

  const positionalBalanceData = React.useMemo(() => {
    if (!selectedTeamForRadar) return [];
    return calculatePositionalBalanceData(
      selectedTeamForRadar,
      currentSeason,
      draftPicks,
      allKeepers,
      selectedTeamName
    );
  }, [selectedTeamForRadar, currentSeason, draftPicks, allKeepers, selectedTeamName]);

  const positionalBalanceChartData = React.useMemo(() =>
    preparePositionalBalanceChartData(positionalBalanceData),
    [positionalBalanceData]
  );

  // Calculate fantasy gaps for stacked bar chart
  const fantasyGapsData = React.useMemo(() => {
    if (!selectedTeamForRadar || sortedByFantasyScore.length === 0) return [];

    const selectedTeam = sortedByFantasyScore.find(team => team.teamId === selectedTeamForRadar);
    if (!selectedTeam) return [];

    // Extract just the player data from the mixed array
    const teamPlayers = (selectedTeam.players || []).map(player =>
      'player' in player ? player.player : player
    );

    const leagueAverages = {
      points: sortedByFantasyScore.reduce((sum, team) => sum + team.points, 0) / sortedByFantasyScore.length,
      rebounds: sortedByFantasyScore.reduce((sum, team) => sum + team.rebounds, 0) / sortedByFantasyScore.length,
      assists: sortedByFantasyScore.reduce((sum, team) => sum + team.assists, 0) / sortedByFantasyScore.length,
      steals: sortedByFantasyScore.reduce((sum, team) => sum + team.steals, 0) / sortedByFantasyScore.length,
      blocks: sortedByFantasyScore.reduce((sum, team) => sum + team.blocks, 0) / sortedByFantasyScore.length,
      three_pointers_made: sortedByFantasyScore.reduce((sum, team) => sum + team.three_pointers_made, 0) / sortedByFantasyScore.length,
      turnovers: sortedByFantasyScore.reduce((sum, team) => sum + team.turnovers, 0) / sortedByFantasyScore.length,
    };

    const analysis = calculateFantasyAnalysis(teamPlayers, leagueAverages);
    return analysis.gaps.slice(0, 5); // Top 5 gaps
  }, [selectedTeamForRadar, sortedByFantasyScore]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {/* Existing Charts */}
      <Card>
        <CardHeader><CardTitle>Team Fantasy Score Comparison</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sortedByFantasyScore}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="teamName"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar
                dataKey="totalFantasyScore"
                fill="hsl(var(--primary))"
                name="Total Fantasy Score"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Strengths & Weaknesses (Radar Chart)</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTeamForRadar} onValueChange={setSelectedTeamForRadar}>
            <SelectTrigger className="w-[200px] mb-4">
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
          {selectedTeamForRadar && radarChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart outerRadius={90} width={730} height={250} data={radarChartData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Radar
                  name={selectedTeamName}
                  dataKey={selectedTeamName}
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.6}
                />
                <Radar
                  name="League Average"
                  dataKey="League Average"
                  stroke="hsl(var(--accent))"
                  fill="hsl(var(--accent))"
                  fillOpacity={0.6}
                />
                <Legend
                  wrapperStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Select a team to view its radar chart.
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Charts */}
      <Card>
        <CardHeader><CardTitle>Draft Efficiency Scatter Plot</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart data={draftEfficiencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="pickNumber"
                name="Pick Number"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                dataKey="fantasyScore"
                name="Fantasy Score"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-md p-3 shadow-lg">
                        <p className="font-medium text-foreground">{data.playerName}</p>
                        <p className="text-sm">Pick: {data.pickNumber}</p>
                        <p className="text-sm">Fantasy Score: {data.fantasyScore.toFixed(1)}</p>
                        <p className="text-sm">Team: {data.teamName}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter
                name="Draft Picks"
                dataKey="fantasyScore"
                fill="hsl(var(--primary))"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Fantasy Gaps Analysis</CardTitle></CardHeader>
        <CardContent>
          {selectedTeamForRadar && fantasyGapsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={fantasyGapsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="category"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="gap"
                  fill="hsl(var(--warning))"
                  name="Gap Size"
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="targetValue"
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  name="Target"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Select a team to view fantasy gaps.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Positional Balance Wheel</CardTitle></CardHeader>
        <CardContent>
          {selectedTeamForRadar && positionalBalanceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart outerRadius={80} data={positionalBalanceChartData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="position"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 'dataMax + 1']}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                />
                <Radar
                  name={selectedTeamName}
                  dataKey={selectedTeamName}
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.6}
                />
                <Radar
                  name="Ideal Balance"
                  dataKey="Ideal Balance"
                  stroke="hsl(var(--accent))"
                  fill="hsl(var(--accent))"
                  fillOpacity={0.4}
                />
                <Legend
                  wrapperStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Select a team to view positional balance.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Visualizations;
