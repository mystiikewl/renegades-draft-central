import { useMemo, useState } from 'react';
import { useTeams } from '@/hooks/useTeams';
import { useDraftState } from '@/hooks/useDraftState';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCombinedPlayersForTeam, calculateTeamStats, prepareRadarChartData, TeamStats } from '@/utils/leagueAnalysis';
import { Tables } from '@/integrations/supabase/types';
import { Team } from '@/types/team';

type KeeperPlayer = Tables<'keepers'> & { player: Tables<'players'> };

interface RadarChartDataItem {
  subject: string;
  [key: string]: number | string; // Dynamic keys for team names
  fullMark: number;
}

// Custom hook to fetch all keepers for all teams in a season
const useAllKeepers = (season: string) => {
  return useQuery<KeeperPlayer[]>({
    queryKey: ['allKeepers', season],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keepers')
        .select('*, player:players(*)')
        .eq('season', season);

      if (error) {
        console.error('Error fetching all keepers:', error);
        throw error;
      }

      return data as KeeperPlayer[];
    },
    enabled: !!season,
  });
};

interface LeagueAnalysisData {
  allTeamStats: TeamStats[];
  sortedByFantasyScore: TeamStats[];
  sortedByPoints: TeamStats[];
  sortedByRebounds: TeamStats[];
  sortedByAssists: TeamStats[];
  sortedBySteals: TeamStats[];
  sortedByBlocks: TeamStats[];
  sortedByTurnovers: TeamStats[];
  sortedByThreePointersMade: TeamStats[];
  selectedTeamForRadar: string;
  setSelectedTeamForRadar: (teamId: string) => void;
  radarChartData: RadarChartDataItem[];
  teamsData: { id: string; name: string }[];
  selectedTeamName: string;
  isLoading: boolean;
  draftPicks: (Tables<'draft_picks'> & { player: Tables<'players'> | null; original_team: Tables<'teams'>; current_team: Tables<'teams'>; })[];
  allKeepers: KeeperPlayer[];
  currentSeason: string;
  // New data for enhanced visualizations
  draftEfficiencyData: any[];
  positionalBalanceData: any[];
  fantasyGapsData: any[];
}

export const useLeagueAnalysisData = (): LeagueAnalysisData => {
  const { data: teamsData = [], isLoading: isLoadingTeams } = useTeams();
  const { draftPicks, isLoadingDraftState } = useDraftState();
  const currentSeason = '2025-26'; // This should ideally come from draft settings
  const { data: allKeepers = [], isLoading: isLoadingKeepers } = useAllKeepers(currentSeason);

  const [selectedTeamForRadar, setSelectedTeamForRadar] = useState<string>('');

  const allTeamStats = useMemo(() => {
    if (isLoadingTeams || isLoadingDraftState || isLoadingKeepers) return [];

    const stats: TeamStats[] = [];
    (teamsData as Team[]).forEach(team => {
      const combinedPlayers = getCombinedPlayersForTeam(team.id, currentSeason, draftPicks, allKeepers);
      if (combinedPlayers.length > 0) {
        stats.push(calculateTeamStats(team.id, team.name, combinedPlayers));
      }
    });
    return stats;
  }, [teamsData, draftPicks, allKeepers, isLoadingTeams, isLoadingDraftState, isLoadingKeepers, currentSeason]);

  const sortedByFantasyScore = useMemo(() => {
    return [...allTeamStats].sort((a, b) => b.totalFantasyScore - a.totalFantasyScore);
  }, [allTeamStats]);

  const sortedByPoints = useMemo(() => {
    return [...allTeamStats].sort((a, b) => b.points - a.points);
  }, [allTeamStats]);

  const sortedByRebounds = useMemo(() => {
    return [...allTeamStats].sort((a, b) => b.rebounds - a.rebounds);
  }, [allTeamStats]);

  const sortedByAssists = useMemo(() => {
    return [...allTeamStats].sort((a, b) => b.assists - a.assists);
  }, [allTeamStats]);

  const sortedBySteals = useMemo(() => {
    return [...allTeamStats].sort((a, b) => b.steals - a.steals);
  }, [allTeamStats]);

  const sortedByBlocks = useMemo(() => {
    return [...allTeamStats].sort((a, b) => b.blocks - a.blocks);
  }, [allTeamStats]);

  const sortedByTurnovers = useMemo(() => {
    return [...allTeamStats].sort((a, b) => a.turnovers - b.turnovers); // Lower is better for turnovers
  }, [allTeamStats]);

  const sortedByThreePointersMade = useMemo(() => {
    return [...allTeamStats].sort((a, b) => b.three_pointers_made - a.three_pointers_made);
  }, [allTeamStats]);

  const selectedTeamName = (teamsData as Team[]).find(t => t.id === selectedTeamForRadar)?.name || '';
  const radarChartData = useMemo(() => prepareRadarChartData(selectedTeamForRadar, allTeamStats, selectedTeamName), [selectedTeamForRadar, allTeamStats, selectedTeamName]);

  const isLoading = isLoadingTeams || isLoadingDraftState || isLoadingKeepers;

  return {
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
    draftEfficiencyData: [], // Will be calculated in component
    positionalBalanceData: [], // Will be calculated in component
    fantasyGapsData: [], // Will be calculated in component
  };
};
