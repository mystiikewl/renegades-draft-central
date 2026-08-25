import { Tables } from '@/integrations/supabase/types';
import { calculateFantasyScore } from '@/utils/fantasyScore';

export interface FantasyImpact {
  category: string;
  currentValue: number;
  projectedValue: number;
  improvement: number;
  improvementPercent: number;
  leaguePercentile: number;
  categoryRank: number;
  newCategoryRank: number;
  rankChange: number;
}

export interface TeamStats {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  three_pointers_made: number;
  field_goal_percentage: number;
  free_throw_percentage: number;
  turnovers: number;
  games_played: number;
  playerCount: number;
}

export interface FantasyImpactResult {
  impacts: FantasyImpact[];
  totalFantasyScore: number;
  newTotalFantasyScore: number;
  fantasyScoreImprovement: number;
  overallRank: number;
  newOverallRank: number;
  overallRankChange: number;
}

/**
 * Calculate fantasy impact of adding a player to a team for ESPN 8-category dynasty scoring
 */
export function calculateFantasyImpact(
  player: Tables<'players'>,
  currentTeamStats: TeamStats,
  leagueStats: TeamStats[],
  currentOverallRank: number
): FantasyImpactResult {
  const ESPN_CATEGORIES = [
    { key: 'points', name: 'Points', weight: 1.0 },
    { key: 'rebounds', name: 'Rebounds', weight: 1.2 },
    { key: 'assists', name: 'Assists', weight: 1.5 },
    { key: 'steals', name: 'Steals', weight: 2.0 },
    { key: 'blocks', name: 'Blocks', weight: 2.0 },
    { key: 'three_pointers_made', name: '3PM', weight: 0.5 },
    { key: 'field_goal_percentage', name: 'FG%', weight: 0.1, isPercentage: true },
    { key: 'free_throw_percentage', name: 'FT%', weight: 0.1, isPercentage: true },
  ];

  // Calculate projected team stats with new player
  const projectedTeamStats = calculateProjectedTeamStats(player, currentTeamStats);

  // Calculate current fantasy score
  const currentFantasyScore = calculateFantasyScoreFromStats(currentTeamStats);

  // Calculate new fantasy score
  const newFantasyScore = calculateFantasyScoreFromStats(projectedTeamStats);

  // Calculate impacts for each category
  const impacts: FantasyImpact[] = ESPN_CATEGORIES.map(category => {
    const currentValue = currentTeamStats[category.key as keyof TeamStats] as number;
    const projectedValue = projectedTeamStats[category.key as keyof TeamStats] as number;

    // Calculate improvement
    let improvement = 0;
    if (category.isPercentage) {
      improvement = projectedValue - currentValue; // For percentages, use direct difference
    } else {
      improvement = projectedValue - currentValue;
    }

    const improvementPercent = currentValue > 0 ? (improvement / currentValue) * 100 : 0;

    // Calculate league percentile for this category
    const categoryValues = leagueStats.map(team => team[category.key as keyof TeamStats] as number);
    const categoryRank = calculatePercentileRank(categoryValues, currentValue);
    const newCategoryRank = calculatePercentileRank(categoryValues, projectedValue);
    const rankChange = categoryRank - newCategoryRank; // Positive = improvement

    return {
      category: category.name,
      currentValue,
      projectedValue,
      improvement,
      improvementPercent,
      leaguePercentile: categoryRank,
      categoryRank,
      newCategoryRank,
      rankChange,
    };
  });

  // Calculate new overall rank based on fantasy score improvement
  const fantasyScores = leagueStats.map(team => calculateFantasyScoreFromStats(team));
  const newOverallRank = calculateFantasyScoreRank(fantasyScores, newFantasyScore);
  const overallRankChange = currentOverallRank - newOverallRank;

  return {
    impacts,
    totalFantasyScore: currentFantasyScore,
    newTotalFantasyScore: newFantasyScore,
    fantasyScoreImprovement: newFantasyScore - currentFantasyScore,
    overallRank: currentOverallRank,
    newOverallRank,
    overallRankChange,
  };
}

/**
 * Calculate projected team stats with new player added
 */
function calculateProjectedTeamStats(
  player: Tables<'players'>,
  currentTeamStats: TeamStats
): TeamStats {
  // Calculate average games played from current roster
  const avgGamesPlayed = currentTeamStats.playerCount > 0
    ? currentTeamStats.games_played / currentTeamStats.playerCount
    : 0;

  // Remaining games for player contribution (assuming 60-game fantasy season)
  const remainingGames = Math.max(0, 60 - avgGamesPlayed);

  // Player per-game averages
  const playerGamesPlayed = Math.max(1, player.games_played || 1);
  const playerPerGame = {
    points: (player.points || 0) / playerGamesPlayed,
    rebounds: (player.total_rebounds || 0) / playerGamesPlayed,
    assists: (player.assists || 0) / playerGamesPlayed,
    steals: (player.steals || 0) / playerGamesPlayed,
    blocks: (player.blocks || 0) / playerGamesPlayed,
    three_pointers_made: (player.three_pointers_made || 0) / playerGamesPlayed,
    turnovers: (player.turnovers || 0) / playerGamesPlayed,
  };

  // Prorated player contribution based on remaining games
  const playerContribution = {
    points: playerPerGame.points * remainingGames,
    rebounds: playerPerGame.rebounds * remainingGames,
    assists: playerPerGame.assists * remainingGames,
    steals: playerPerGame.steals * remainingGames,
    blocks: playerPerGame.blocks * remainingGames,
    three_pointers_made: playerPerGame.three_pointers_made * remainingGames,
    turnovers: playerPerGame.turnovers * remainingGames,
  };

  // Weighted percentage averages using games played as weights
  const teamWeight = currentTeamStats.playerCount * avgGamesPlayed;
  const playerWeight = playerGamesPlayed;
  const totalWeight = teamWeight + playerWeight;

  const newFieldGoalPercentage = totalWeight > 0
    ? ((currentTeamStats.field_goal_percentage * teamWeight) + (player.field_goal_percentage * playerWeight)) / totalWeight
    : player.field_goal_percentage || 0;

  const newFreeThrowPercentage = totalWeight > 0
    ? ((currentTeamStats.free_throw_percentage * teamWeight) + (player.free_throw_percentage * playerWeight)) / totalWeight
    : player.free_throw_percentage || 0;

  // Calculate new totals
  const newTotalStats = {
    points: currentTeamStats.points + playerContribution.points,
    rebounds: currentTeamStats.rebounds + playerContribution.rebounds,
    assists: currentTeamStats.assists + playerContribution.assists,
    steals: currentTeamStats.steals + playerContribution.steals,
    blocks: currentTeamStats.blocks + playerContribution.blocks,
    three_pointers_made: currentTeamStats.three_pointers_made + playerContribution.three_pointers_made,
    turnovers: currentTeamStats.turnovers + playerContribution.turnovers,
  };

  // Update games played for projected team (average across all players including new one)
  const projectedGamesPlayed = currentTeamStats.playerCount > 0
    ? (currentTeamStats.games_played + remainingGames) / (currentTeamStats.playerCount + 1)
    : remainingGames;

  return {
    ...currentTeamStats,
    ...newTotalStats,
    field_goal_percentage: newFieldGoalPercentage,
    free_throw_percentage: newFreeThrowPercentage,
    games_played: projectedGamesPlayed,
    playerCount: currentTeamStats.playerCount + 1,
  };
}

/**
 * Calculate fantasy score from team stats
 */
function calculateFantasyScoreFromStats(teamStats: TeamStats): number {
  const FANTASY_WEIGHTS = {
    points: 1.0,
    total_rebounds: 1.2,
    assists: 1.5,
    steals: 2.0,
    blocks: 2.0,
    turnovers: -1.0,
    three_pointers_made: 0.5,
  };

  let score = 0;

  // Calculate per-game averages for consistent scoring
  const gamesPlayed = teamStats.games_played || 1;
  const ppg = teamStats.points / gamesPlayed;
  const rpg = teamStats.rebounds / gamesPlayed;
  const apg = teamStats.assists / gamesPlayed;
  const spg = teamStats.steals / gamesPlayed;
  const bpg = teamStats.blocks / gamesPlayed;
  const tpg = teamStats.turnovers / gamesPlayed;
  const tpm = teamStats.three_pointers_made / gamesPlayed;

  score += ppg * FANTASY_WEIGHTS.points;
  score += rpg * FANTASY_WEIGHTS.total_rebounds;
  score += apg * FANTASY_WEIGHTS.assists;
  score += spg * FANTASY_WEIGHTS.steals;
  score += bpg * FANTASY_WEIGHTS.blocks;
  score += tpg * FANTASY_WEIGHTS.turnovers;
  score += tpm * FANTASY_WEIGHTS.three_pointers_made;

  return score;
}

/**
 * Calculate percentile rank (0-100, where 100 is best)
 */
function calculatePercentileRank(values: number[], value: number): number {
  if (values.length === 0) return 50;

  const sortedValues = [...values].sort((a, b) => b - a); // Sort descending (higher is better)
  const index = sortedValues.findIndex(v => v <= value);
  const rank = index >= 0 ? (index / sortedValues.length) * 100 : 100;

  return Math.round(100 - rank); // Convert to percentile (higher is better)
}

/**
 * Calculate fantasy score rank
 */
function calculateFantasyScoreRank(fantasyScores: number[], score: number): number {
  if (fantasyScores.length === 0) return 1;

  const sortedScores = [...fantasyScores].sort((a, b) => b - a); // Sort descending
  const index = sortedScores.findIndex(s => s <= score);
  return index >= 0 ? index + 1 : sortedScores.length + 1;
}
