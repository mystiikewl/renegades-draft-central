import { Tables } from '@/integrations/supabase/types';
import { calculateFantasyScore } from '@/utils/fantasyScore';

export interface CategoryRanking {
  category: string;
  currentRank: number;
  projectedRank: number;
  rankChange: number;
  percentileChange: number;
  competitiveAdvantage: 'strong' | 'moderate' | 'weak' | 'negative';
}

export interface CompetitiveAnalysis {
  categoryStrengths: string[];
  categoryWeaknesses: string[];
  overallCompetitiveScore: number; // 0-100 scale
  playoffProbability: number; // 0-100 scale
  keyDifferentiators: string[];
}

export interface RankingImpactResult {
  categoryRankings: CategoryRanking[];
  overallRankChange: number;
  competitiveAnalysis: CompetitiveAnalysis;
  playoffImpact: PlayoffImpact;
}

export interface PlayoffImpact {
  currentPlayoffPosition: number;
  projectedPlayoffPosition: number;
  playoffOddsImprovement: number;
  keyCategoriesForPlayoffs: string[];
}

export interface LeagueStandings {
  teams: Array<{
    id: string;
    name: string;
    totalFantasyScore: number;
    categoryStats: {
      points: number;
      rebounds: number;
      assists: number;
      steals: number;
      blocks: number;
      three_pointers_made: number;
      field_goal_percentage: number;
      free_throw_percentage: number;
    };
  }>;
}

/**
 * Calculate ranking impact of adding a player to a team
 */
export function calculateRankingImpact(
  player: Tables<'players'>,
  currentTeamStats: any,
  leagueStandings: LeagueStandings,
  currentTeamId: string
): RankingImpactResult {
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

  // Calculate category rankings
  const categoryRankings: CategoryRanking[] = ESPN_CATEGORIES.map(category => {
    const currentValue = currentTeamStats[category.key];
    const projectedValue = projectedTeamStats[category.key];

    // Calculate current and projected ranks
    const currentRank = calculateCategoryRank(leagueStandings, category.key, currentValue, category.isPercentage);
    const projectedRank = calculateCategoryRank(leagueStandings, category.key, projectedValue, category.isPercentage);

    const rankChange = currentRank - projectedRank; // Positive = improvement
    const percentileChange = (rankChange / leagueStandings.teams.length) * 100;

    // Determine competitive advantage
    const competitiveAdvantage = determineCompetitiveAdvantage(rankChange, currentRank, leagueStandings.teams.length);

    return {
      category: category.name,
      currentRank,
      projectedRank,
      rankChange,
      percentileChange,
      competitiveAdvantage,
    };
  });

  // Calculate overall rank change based on fantasy score
  const currentTeam = leagueStandings.teams.find(t => t.id === currentTeamId);
  const currentOverallRank = currentTeam ? calculateOverallRank(leagueStandings, currentTeam.totalFantasyScore) : 0;

  const projectedFantasyScore = calculateFantasyScoreFromStats(projectedTeamStats);
  const projectedOverallRank = calculateOverallRank(leagueStandings, projectedFantasyScore);
  const overallRankChange = currentOverallRank - projectedOverallRank;

  // Perform competitive analysis
  const competitiveAnalysis = performCompetitiveAnalysis(categoryRankings, projectedTeamStats, leagueStandings);

  // Calculate playoff impact
  const playoffImpact = calculatePlayoffImpact(
    currentOverallRank,
    projectedOverallRank,
    categoryRankings,
    leagueStandings
  );

  return {
    categoryRankings,
    overallRankChange,
    competitiveAnalysis,
    playoffImpact,
  };
}

/**
 * Calculate projected team stats with new player
 */
function calculateProjectedTeamStats(player: Tables<'players'>, currentTeamStats: any) {
  // This would use similar logic to the fantasy impact calculator
  // For now, return a simplified projection
  const gamesPlayed = player.games_played || 60;
  const projectedGames = Math.min(60 - currentTeamStats.games_played, gamesPlayed);

  return {
    points: currentTeamStats.points + ((player.points || 0) / gamesPlayed * projectedGames),
    rebounds: currentTeamStats.rebounds + ((player.total_rebounds || 0) / gamesPlayed * projectedGames),
    assists: currentTeamStats.assists + ((player.assists || 0) / gamesPlayed * projectedGames),
    steals: currentTeamStats.steals + ((player.steals || 0) / gamesPlayed * projectedGames),
    blocks: currentTeamStats.blocks + ((player.blocks || 0) / gamesPlayed * projectedGames),
    three_pointers_made: currentTeamStats.three_pointers_made + ((player.three_pointers_made || 0) / gamesPlayed * projectedGames),
    field_goal_percentage: (currentTeamStats.field_goal_percentage + (player.field_goal_percentage || 0)) / 2,
    free_throw_percentage: (currentTeamStats.free_throw_percentage + (player.free_throw_percentage || 0)) / 2,
    turnovers: currentTeamStats.turnovers + ((player.turnovers || 0) / gamesPlayed * projectedGames),
  };
}

/**
 * Calculate category rank within league
 */
function calculateCategoryRank(
  leagueStandings: LeagueStandings,
  categoryKey: string,
  value: number,
  isPercentage: boolean = false
): number {
  const values = leagueStandings.teams.map(team => team.categoryStats[categoryKey as keyof typeof team.categoryStats] as number);
  const sortedValues = isPercentage ? [...values].sort((a, b) => b - a) : [...values].sort((a, b) => b - a);

  const index = sortedValues.findIndex(v => v <= value);
  return index >= 0 ? index + 1 : sortedValues.length + 1;
}

/**
 * Calculate overall fantasy score rank
 */
function calculateOverallRank(leagueStandings: LeagueStandings, fantasyScore: number): number {
  const scores = leagueStandings.teams.map(team => team.totalFantasyScore);
  const sortedScores = [...scores].sort((a, b) => b - a);

  const index = sortedScores.findIndex(score => score <= fantasyScore);
  return index >= 0 ? index + 1 : sortedScores.length + 1;
}

/**
 * Determine competitive advantage level
 */
function determineCompetitiveAdvantage(
  rankChange: number,
  currentRank: number,
  totalTeams: number
): 'strong' | 'moderate' | 'weak' | 'negative' {
  const improvementThreshold = totalTeams * 0.1; // Top 10% improvement

  if (rankChange > improvementThreshold) {
    return 'strong';
  } else if (rankChange > improvementThreshold * 0.5) {
    return 'moderate';
  } else if (rankChange > 0) {
    return 'weak';
  } else {
    return 'negative';
  }
}

/**
 * Perform comprehensive competitive analysis
 */
function performCompetitiveAnalysis(
  categoryRankings: CategoryRanking[],
  projectedStats: any,
  leagueStandings: LeagueStandings
): CompetitiveAnalysis {
  // Identify category strengths and weaknesses
  const categoryStrengths: string[] = [];
  const categoryWeaknesses: string[] = [];

  categoryRankings.forEach(ranking => {
    if (ranking.competitiveAdvantage === 'strong') {
      categoryStrengths.push(ranking.category);
    } else if (ranking.competitiveAdvantage === 'negative') {
      categoryWeaknesses.push(ranking.category);
    }
  });

  // Calculate overall competitive score
  const strengthScore = categoryStrengths.length * 20; // 20 points per strength
  const weaknessPenalty = categoryWeaknesses.length * 10; // 10 point penalty per weakness
  const rankImprovementBonus = categoryRankings.reduce((sum, r) => sum + Math.max(0, r.rankChange), 0) * 2;

  const overallCompetitiveScore = Math.min(100, Math.max(0,
    50 + strengthScore - weaknessPenalty + rankImprovementBonus
  ));

  // Calculate playoff probability (simplified)
  const playoffProbability = Math.min(100, Math.max(0,
    overallCompetitiveScore * 0.8 + (100 - (categoryWeaknesses.length / categoryRankings.length) * 100) * 0.2
  ));

  // Identify key differentiators
  const keyDifferentiators = categoryRankings
    .filter(r => r.rankChange > leagueStandings.teams.length * 0.05) // Top 5% improvement
    .map(r => r.category);

  return {
    categoryStrengths,
    categoryWeaknesses,
    overallCompetitiveScore,
    playoffProbability,
    keyDifferentiators,
  };
}

/**
 * Calculate playoff impact analysis
 */
function calculatePlayoffImpact(
  currentRank: number,
  projectedRank: number,
  categoryRankings: CategoryRanking[],
  leagueStandings: LeagueStandings
): PlayoffImpact {
  const totalTeams = leagueStandings.teams.length;
  const playoffTeams = Math.ceil(totalTeams * 0.5); // Assume 50% make playoffs

  // Determine current playoff position
  const currentPlayoffPosition = currentRank <= playoffTeams ? currentRank : 0;

  // Determine projected playoff position
  const projectedPlayoffPosition = projectedRank <= playoffTeams ? projectedRank : 0;

  // Calculate playoff odds improvement
  const baseOdds = currentRank <= playoffTeams ? 80 - (currentRank * 5) : Math.max(0, 50 - currentRank);
  const projectedOdds = projectedRank <= playoffTeams ? 80 - (projectedRank * 5) : Math.max(0, 50 - projectedRank);
  const playoffOddsImprovement = projectedOdds - baseOdds;

  // Identify key categories for playoff success
  const keyCategoriesForPlayoffs = categoryRankings
    .filter(r => r.projectedRank <= playoffTeams)
    .sort((a, b) => a.projectedRank - b.projectedRank)
    .slice(0, 3)
    .map(r => r.category);

  return {
    currentPlayoffPosition,
    projectedPlayoffPosition,
    playoffOddsImprovement,
    keyCategoriesForPlayoffs,
  };
}

/**
 * Calculate fantasy score from stats (simplified)
 */
function calculateFantasyScoreFromStats(teamStats: any): number {
  const FANTASY_WEIGHTS = {
    points: 1.0,
    rebounds: 1.2,
    assists: 1.5,
    steals: 2.0,
    blocks: 2.0,
    turnovers: -1.0,
    three_pointers_made: 0.5,
  };

  return (
    teamStats.points * FANTASY_WEIGHTS.points +
    teamStats.rebounds * FANTASY_WEIGHTS.rebounds +
    teamStats.assists * FANTASY_WEIGHTS.assists +
    teamStats.steals * FANTASY_WEIGHTS.steals +
    teamStats.blocks * FANTASY_WEIGHTS.blocks +
    teamStats.turnovers * FANTASY_WEIGHTS.turnovers +
    teamStats.three_pointers_made * FANTASY_WEIGHTS.three_pointers_made
  );
}