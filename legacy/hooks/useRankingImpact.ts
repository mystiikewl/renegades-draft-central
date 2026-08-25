import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import {
  calculateRankingImpact,
  RankingImpactResult,
  LeagueStandings
} from '@/utils/rankingImpactCalculator';

interface UseRankingImpactProps {
  player: Tables<'players'> | null;
  teamId: string;
  season: string;
}

/**
 * Custom hook to calculate ranking impact of adding a player to a team
 */
export const useRankingImpact = ({ player, teamId, season }: UseRankingImpactProps) => {
  // Fetch current team stats for ranking calculations
  const { data: currentTeamStats, isLoading: isLoadingTeamStats } = useQuery({
    queryKey: ['teamStatsForRanking', teamId, season],
    queryFn: async () => {
      if (!teamId) {
        throw new Error('No team ID provided for ranking impact calculation');
      }

      // Get draft picks for the team
      const { data: picksData, error: picksError } = await supabase
        .from('draft_picks')
        .select('player_id')
        .eq('current_team_id', teamId)
        .eq('season', season) as { data: { player_id: string | null }[] | null; error: any };

      if (picksError) throw picksError;

      // Get keepers
      const { data: keepersData, error: keepersError } = await supabase
        .from('keepers')
        .select('player_id')
        .eq('team_id', teamId)
        .eq('season', season) as { data: { player_id: string }[] | null; error: any };

      if (keepersError) throw keepersError;

      // Combine player IDs from picks and keepers, remove duplicates
      const draftPlayerIds = picksData?.map(pick => pick.player_id).filter(Boolean) || [];
      const keeperPlayerIds = keepersData?.map(keeper => keeper.player_id) || [];
      const playerIds = [...new Set([...draftPlayerIds, ...keeperPlayerIds])];

      if (playerIds.length === 0) {
        return getEmptyTeamStats();
      }

      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .in('id', playerIds);

      if (playersError) throw playersError;

      return calculateTeamStatsFromPlayers(playersData || []);
    },
    enabled: !!teamId && !!season,
  });

  // Fetch league standings
  const { data: leagueStandings, isLoading: isLoadingLeague } = useQuery({
    queryKey: ['leagueStandings', season],
    queryFn: async (): Promise<LeagueStandings> => {
      // Get all teams
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*');

      if (teamsError) throw teamsError;

      const standings: LeagueStandings['teams'] = [];

      for (const team of teams) {
        // Get draft picks
        const { data: picksData, error: picksError } = await supabase
          .from('draft_picks')
          .select('player_id')
          .eq('current_team_id', team.id)
          .eq('season', season) as { data: { player_id: string | null }[] | null; error: any };

        if (picksError) {
          console.warn(`Error fetching picks for team ${team.id}:`, picksError);
          continue;
        }

        // Get keepers
        const { data: teamKeepers, error: keepersError } = await supabase
          .from('keepers')
          .select('player_id')
          .eq('team_id', team.id)
          .eq('season', season) as { data: { player_id: string }[] | null; error: any };

        if (keepersError) {
          console.warn(`Error fetching keepers for team ${team.id}:`, keepersError);
        }

        // Combine player IDs from picks and keepers, remove duplicates
        const draftPlayerIds = picksData?.map(pick => pick.player_id).filter(Boolean) || [];
        const keeperPlayerIds = teamKeepers?.map(keeper => keeper.player_id) || [];
        const playerIds = [...new Set([...draftPlayerIds, ...keeperPlayerIds])];

        let calculatedStats = getEmptyTeamStats();

        if (playerIds.length > 0) {
          const { data: playersData, error: playersError } = await supabase
            .from('players')
            .select('*')
            .in('id', playerIds);

          if (!playersError && playersData) {
            calculatedStats = calculateTeamStatsFromPlayers(playersData);
          } else {
            console.warn(`Error fetching players for team ${team.id}:`, playersError);
          }
        }

        standings.push({
          id: team.id,
          name: team.name,
          totalFantasyScore: calculateFantasyScore(calculatedStats),
          categoryStats: {
            points: calculatedStats.points,
            rebounds: calculatedStats.rebounds,
            assists: calculatedStats.assists,
            steals: calculatedStats.steals,
            blocks: calculatedStats.blocks,
            three_pointers_made: calculatedStats.three_pointers_made,
            field_goal_percentage: calculatedStats.field_goal_percentage,
            free_throw_percentage: calculatedStats.free_throw_percentage,
          },
        });
      }

      return { teams: standings };
    },
    enabled: !!season,
  });

  // Calculate ranking impact
  const rankingImpact = useMemo((): RankingImpactResult | null => {
    if (!player || !currentTeamStats || !leagueStandings) return null;

    try {
      return calculateRankingImpact(player, currentTeamStats, leagueStandings, teamId);
    } catch (error) {
      console.error('Error calculating ranking impact:', error);
      return null;
    }
  }, [player, currentTeamStats, leagueStandings, teamId]);

  const isLoading = isLoadingTeamStats || isLoadingLeague;

  return {
    rankingImpact,
    currentTeamStats,
    leagueStandings,
    isLoading,
    error: null, // Add proper error handling if needed
  };
};

/**
 * Calculate team stats from array of players
 */
function calculateTeamStatsFromPlayers(players: Tables<'players'>[]) {
  const gamesPlayed = Math.max(1, players.reduce((sum, p) => sum + (p.games_played || 0), 0) / Math.max(1, players.length));

  return {
    points: players.reduce((sum, p) => sum + (p.points || 0), 0),
    rebounds: players.reduce((sum, p) => sum + (p.total_rebounds || 0), 0),
    assists: players.reduce((sum, p) => sum + (p.assists || 0), 0),
    steals: players.reduce((sum, p) => sum + (p.steals || 0), 0),
    blocks: players.reduce((sum, p) => sum + (p.blocks || 0), 0),
    three_pointers_made: players.reduce((sum, p) => sum + (p.three_pointers_made || 0), 0),
    field_goal_percentage: calculateAveragePercentage(players.map(p => p.field_goal_percentage)),
    free_throw_percentage: calculateAveragePercentage(players.map(p => p.free_throw_percentage)),
    turnovers: players.reduce((sum, p) => sum + (p.turnovers || 0), 0),
    games_played: gamesPlayed,
    playerCount: players.length,
  };
}

/**
 * Get empty team stats structure
 */
function getEmptyTeamStats() {
  return {
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    three_pointers_made: 0,
    field_goal_percentage: 0,
    free_throw_percentage: 0,
    turnovers: 0,
    games_played: 0,
    playerCount: 0,
  };
}

/**
 * Calculate average percentage from array of percentages
 */
function calculateAveragePercentage(percentages: (number | null)[]): number {
  const validPercentages = percentages.filter(p => p !== null && !isNaN(p)) as number[];
  if (validPercentages.length === 0) return 0;

  return validPercentages.reduce((sum, p) => sum + p, 0) / validPercentages.length;
}

/**
 * Calculate fantasy score from team stats
 */
function calculateFantasyScore(teamStats: any): number {
  const FANTASY_WEIGHTS = {
    points: 1.0,
    rebounds: 1.2,
    assists: 1.5,
    steals: 2.0,
    blocks: 2.0,
    turnovers: -1.0,
    three_pointers_made: 0.5,
  };

  const gamesPlayed = teamStats.games_played || 1;
  const ppg = teamStats.points / gamesPlayed;
  const rpg = teamStats.rebounds / gamesPlayed;
  const apg = teamStats.assists / gamesPlayed;
  const spg = teamStats.steals / gamesPlayed;
  const bpg = teamStats.blocks / gamesPlayed;
  const tpg = teamStats.turnovers / gamesPlayed;
  const tpm = teamStats.three_pointers_made / gamesPlayed;

  return (
    ppg * FANTASY_WEIGHTS.points +
    rpg * FANTASY_WEIGHTS.rebounds +
    apg * FANTASY_WEIGHTS.assists +
    spg * FANTASY_WEIGHTS.steals +
    bpg * FANTASY_WEIGHTS.blocks +
    tpg * FANTASY_WEIGHTS.turnovers +
    tpm * FANTASY_WEIGHTS.three_pointers_made
  );
}
