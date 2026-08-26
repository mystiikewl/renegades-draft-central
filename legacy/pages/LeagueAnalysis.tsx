import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeagueAnalysisData } from '@/hooks/useLeagueAnalysisData';
import PowerRankings from '@/components/league-analysis/PowerRankings';
import { CategoricalRankings } from '@/components/league-analysis/CategoricalRankings';
import Visualizations from '@/components/league-analysis/Visualizations';
import { TeamStrengthsWeaknesses } from '@/components/league-analysis/TeamStrengthsWeaknesses';
import { TopPerformers } from '@/components/league-analysis/TopPerformers';
import { useIsMobile } from '@/hooks/use-mobile';

export default function LeagueAnalysis() {
  const {
    allTeamStats,
    sortedByFantasyScore,
    sortedByPoints,
    sortedByRebounds,
    sortedByAssists,
    sortedBySteals,
    sortedByBlocks,
    sortedByTurnovers,
    sortedByThreePointersMade,
    selectedTeamForRadar,
    setSelectedTeamForRadar,
    radarChartData,
    teamsData,
    selectedTeamName,
    isLoading,
    draftPicks,
    allKeepers,
    currentSeason,
  } = useLeagueAnalysisData();

  const [activeTab, setActiveTab] = useState('power-rankings');
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-12 w-1/2 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    );
  }

  const tabs = [
    { value: 'power-rankings', label: 'Power Rankings' },
    { value: 'categorical-rankings', label: 'Categorical Rankings' },
    { value: 'visualizations', label: 'Visualisations' },
    { value: 'top-performers', label: 'Top Performers' },
    { value: 'team-strengths-weaknesses', label: 'Team Strengths & Weaknesses' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">League Analysis</h1>

      {isMobile ? (
        <div className="space-y-6">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select analysis view" />
            </SelectTrigger>
            <SelectContent>
              {tabs.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div>
            {activeTab === 'power-rankings' && (
              <PowerRankings sortedByFantasyScore={sortedByFantasyScore} />
            )}
            {activeTab === 'categorical-rankings' && (
              <CategoricalRankings />
            )}
            {activeTab === 'visualizations' && (
              <Visualizations
                sortedByFantasyScore={sortedByFantasyScore}
                selectedTeamForRadar={selectedTeamForRadar}
                setSelectedTeamForRadar={setSelectedTeamForRadar}
                radarChartData={radarChartData}
                teamsData={teamsData}
                selectedTeamName={selectedTeamName}
                draftPicks={draftPicks}
                allKeepers={allKeepers}
                currentSeason={currentSeason}
              />
            )}
            {activeTab === 'top-performers' && (
              <TopPerformers />
            )}
            {activeTab === 'team-strengths-weaknesses' && (
              <TeamStrengthsWeaknesses
                players={allTeamStats.find(t => t.teamId === selectedTeamForRadar)?.players || []}
                teamStats={allTeamStats.find(t => t.teamId === selectedTeamForRadar)}
                leagueAverageStats={allTeamStats.length > 0 ? {
                  ...allTeamStats[0],
                  totalFantasyScore: allTeamStats.reduce((sum, team) => sum + team.totalFantasyScore, 0) / allTeamStats.length,
                  avgFantasyScore: allTeamStats.reduce((sum, team) => sum + team.avgFantasyScore, 0) / allTeamStats.length,
                  points: allTeamStats.reduce((sum, team) => sum + team.points, 0) / allTeamStats.length,
                  rebounds: allTeamStats.reduce((sum, team) => sum + team.rebounds, 0) / allTeamStats.length,
                  assists: allTeamStats.reduce((sum, team) => sum + team.assists, 0) / allTeamStats.length,
                  steals: allTeamStats.reduce((sum, team) => sum + team.steals, 0) / allTeamStats.length,
                  blocks: allTeamStats.reduce((sum, team) => sum + team.blocks, 0) / allTeamStats.length,
                  turnovers: allTeamStats.reduce((sum, team) => sum + team.turnovers, 0) / allTeamStats.length,
                  three_pointers_made: allTeamStats.reduce((sum, team) => sum + team.three_pointers_made, 0) / allTeamStats.length,
                  players: [], // This will be ignored as it's a calculated average, but required by interface
                } : undefined}
              />
            )}
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="power-rankings">Power Rankings</TabsTrigger>
            <TabsTrigger value="categorical-rankings">Categorical Rankings</TabsTrigger>
            <TabsTrigger value="visualizations">Visualisations</TabsTrigger>
            <TabsTrigger value="top-performers">Top Performers</TabsTrigger>
            <TabsTrigger value="team-strengths-weaknesses">Team Strengths & Weaknesses</TabsTrigger>
          </TabsList>

          <TabsContent value="power-rankings">
            <PowerRankings sortedByFantasyScore={sortedByFantasyScore} />
          </TabsContent>

          <TabsContent value="categorical-rankings">
            <CategoricalRankings />
          </TabsContent>

          <TabsContent value="visualizations">
            <Visualizations
              sortedByFantasyScore={sortedByFantasyScore}
              selectedTeamForRadar={selectedTeamForRadar}
              setSelectedTeamForRadar={setSelectedTeamForRadar}
              radarChartData={radarChartData}
              teamsData={teamsData}
              selectedTeamName={selectedTeamName}
              draftPicks={draftPicks}
              allKeepers={allKeepers}
              currentSeason={currentSeason}
            />
          </TabsContent>

          <TabsContent value="top-performers">
            <TopPerformers />
          </TabsContent>

          <TabsContent value="team-strengths-weaknesses">
            <TeamStrengthsWeaknesses
              players={allTeamStats.find(t => t.teamId === selectedTeamForRadar)?.players || []}
              teamStats={allTeamStats.find(t => t.teamId === selectedTeamForRadar)}
              leagueAverageStats={allTeamStats.length > 0 ? {
                ...allTeamStats[0],
                totalFantasyScore: allTeamStats.reduce((sum, team) => sum + team.totalFantasyScore, 0) / allTeamStats.length,
                avgFantasyScore: allTeamStats.reduce((sum, team) => sum + team.avgFantasyScore, 0) / allTeamStats.length,
                points: allTeamStats.reduce((sum, team) => sum + team.points, 0) / allTeamStats.length,
                rebounds: allTeamStats.reduce((sum, team) => sum + team.rebounds, 0) / allTeamStats.length,
                assists: allTeamStats.reduce((sum, team) => sum + team.assists, 0) / allTeamStats.length,
                steals: allTeamStats.reduce((sum, team) => sum + team.steals, 0) / allTeamStats.length,
                blocks: allTeamStats.reduce((sum, team) => sum + team.blocks, 0) / allTeamStats.length,
                turnovers: allTeamStats.reduce((sum, team) => sum + team.turnovers, 0) / allTeamStats.length,
                three_pointers_made: allTeamStats.reduce((sum, team) => sum + team.three_pointers_made, 0) / allTeamStats.length,
                players: [], // This will be ignored as it's a calculated average, but required by interface
              } : undefined}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
