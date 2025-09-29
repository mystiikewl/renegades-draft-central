import { Tables } from '@/integrations/supabase/types';
import { FantasySettings } from '@/hooks/useFantasySettings';
import { calculateFantasyScore } from './fantasyScore';

// Default fantasy settings fallback
const DEFAULT_FANTASY_SETTINGS: FantasySettings = {
  name: 'Default Fantasy Settings',
  scoring_rules: {
    points: 1.0,
    rebounds: 1.2,
    assists: 1.5,
    steals: 3.0,
    blocks: 3.0,
    three_pointers_made: 1.0,
    turnovers: -1.0,
  },
  thresholds: {
    points: 20,
    rebounds: 8,
    assists: 6,
    steals: 1.2,
    blocks: 1.0,
    three_pointers_made: 2.5,
    turnovers: 2.5,
  },
};

export type Player = Tables<'players'>;

export interface FantasyGap {
  category: string;
  currentValue: number;
  targetValue: number;
  gap: number;
  severity: 'critical' | 'moderate' | 'minor';
  priority: number;
  recommendation?: string;
}

export interface AcquisitionSuggestion {
  playerId: string;
  playerName: string;
  primaryBenefit: string;
  projectedImpact: number;
  rationale: string;
  position: string;
  nbaTeam: string;
  estimatedCost?: string;
}

export interface FantasyBenchmarks {
  leagueAverage: number;
  teamRank: number;
  percentile: number;
  totalTeams: number;
}

export interface FantasyAnalysisResult {
  gaps: FantasyGap[];
  strengths: string[];
  suggestions: AcquisitionSuggestion[];
  benchmarks: Record<string, FantasyBenchmarks>;
  overallScore: number;
  recommendations: string[];
}

// Fantasy stat categories with their target values
export const FANTASY_CATEGORIES = {
  points: { name: 'Points Per Game', target: 20, weight: 1.0 },
  rebounds: { name: 'Rebounds Per Game', target: 8, weight: 0.8 },
  assists: { name: 'Assists Per Game', target: 6, weight: 0.7 },
  steals: { name: 'Steals Per Game', target: 1.2, weight: 0.6 },
  blocks: { name: 'Blocks Per Game', target: 1.0, weight: 0.5 },
  three_pointers_made: { name: '3-Pointers Made', target: 2.5, weight: 0.8 },
  turnovers: { name: 'Turnovers Per Game', target: 2.5, weight: -0.4 }, // Negative because lower is better
} as const;

export const FANTASY_EFFICIENCY_METRICS = {
  fantasyPointsPerGame: { name: 'Fantasy Points/Game', target: 35 },
  trueShootingPercentage: { name: 'True Shooting %', target: 0.58 },
  playerEfficiencyRating: { name: 'Player Efficiency Rating', target: 20 },
  valueOverReplacement: { name: 'Value Over Replacement', target: 2.0 },
} as const;

/**
 * Calculate comprehensive fantasy analysis for a team
 */
export function calculateFantasyAnalysis(
  players: Player[],
  leagueAverages: Record<string, number>,
  settings?: FantasySettings
): FantasyAnalysisResult {
  try {
    // Calculate team totals
    const teamStats = calculateTeamStats(players);

    // Identify gaps
    const gaps = calculateFantasyGaps(teamStats, leagueAverages, settings);

    // Find strengths
    const strengths = identifyStrengths(teamStats, leagueAverages);

    // Generate acquisition suggestions
    const suggestions = generateAcquisitionSuggestions(gaps, players.length);

    // Calculate benchmarks
    const benchmarks = calculateBenchmarks(teamStats, leagueAverages);

    // Generate overall score and recommendations
    const overallScore = calculateOverallScore(teamStats, gaps);
    const recommendations = generateRecommendations(gaps, strengths, players.length);

    return {
      gaps,
      strengths,
      suggestions,
      benchmarks,
      overallScore,
      recommendations,
    };
  } catch (error) {
    console.error('Error calculating fantasy analysis:', error);
    return getFallbackAnalysis();
  }
}

/**
 * Calculate team statistical totals
 */
export function calculateTeamStats(players: Player[]) {
  const stats = {
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    three_pointers_made: 0,
    turnovers: 0,
    games_played: 0,
  };

  players.forEach(player => {
    stats.points += player.points || 0;
    stats.rebounds += player.total_rebounds || 0;
    stats.assists += player.assists || 0;
    stats.steals += player.steals || 0;
    stats.blocks += player.blocks || 0;
    stats.three_pointers_made += player.three_pointers_made || 0;
    stats.turnovers += player.turnovers || 0;
    stats.games_played += player.games_played || 0;
  });

  // Calculate per-game averages
  const playerCount = players.length;
  if (playerCount > 0) {
    Object.keys(stats).forEach(key => {
      if (key !== 'games_played') {
        stats[key] = stats[key] / playerCount;
      }
    });
  }

  return stats;
}

/**
 * Calculate fantasy gaps compared to targets
 */
export function calculateFantasyGaps(
  teamStats: Record<string, number>,
  leagueAverages: Record<string, number>,
  settings?: FantasySettings
): FantasyGap[] {
  const gaps: FantasyGap[] = [];

  Object.entries(FANTASY_CATEGORIES).forEach(([key, config]) => {
    const currentValue = teamStats[key] || 0;
    // Use settings.thresholds if available, otherwise fall back to config.target
    const targetValue = settings?.thresholds?.[key as keyof typeof settings.thresholds] || config.target;
    const leagueAvg = leagueAverages[key] || targetValue;

    // Use the higher of target or league average as the benchmark
    const benchmark = Math.max(targetValue, leagueAvg);
    const gap = currentValue - benchmark;

    // Determine severity based on gap size and weight
    let severity: 'critical' | 'moderate' | 'minor' = 'minor';
    const gapPercentage = Math.abs(gap) / benchmark;

    if (gapPercentage > 0.3) severity = 'critical';
    else if (gapPercentage > 0.15) severity = 'moderate';

    // Priority based on weight and gap severity
    const priority = Math.abs(config.weight) * (gap < 0 ? 2 : 1) * (gapPercentage + 1);

    gaps.push({
      category: config.name,
      currentValue,
      targetValue: benchmark,
      gap,
      severity,
      priority,
      recommendation: generateGapRecommendation(key, gap, severity),
    });
  });

  return gaps.sort((a, b) => b.priority - a.priority);
}

/**
 * Identify team strengths
 */
export function identifyStrengths(
  teamStats: Record<string, number>,
  leagueAverages: Record<string, number>
): string[] {
  const strengths: string[] = [];

  Object.entries(FANTASY_CATEGORIES).forEach(([key, config]) => {
    const currentValue = teamStats[key] || 0;
    const leagueAvg = leagueAverages[key] || config.target;

    if (currentValue > leagueAvg * 1.1) { // 10% above league average
      strengths.push(config.name);
    }
  });

  return strengths;
}

/**
 * Generate acquisition suggestions based on gaps
 */
export function generateAcquisitionSuggestions(
  gaps: FantasyGap[],
  currentRosterSize: number
): AcquisitionSuggestion[] {
  const suggestions: AcquisitionSuggestion[] = [];

  // Sort gaps by priority and take top 3
  const topGaps = gaps
    .filter(gap => gap.gap < 0) // Only gaps (negative values)
    .slice(0, 3);

  topGaps.forEach(gap => {
    // This would be enhanced with actual player data from an API
    const mockSuggestions = generateMockSuggestions(gap.category);
    suggestions.push(...mockSuggestions);
  });

  return suggestions.slice(0, 5); // Limit to 5 suggestions
}

/**
 * Calculate benchmarks for each category
 */
export function calculateBenchmarks(
  teamStats: Record<string, number>,
  leagueAverages: Record<string, number>
): Record<string, FantasyBenchmarks> {
  const benchmarks: Record<string, FantasyBenchmarks> = {};

  Object.keys(FANTASY_CATEGORIES).forEach(key => {
    const teamValue = teamStats[key] || 0;
    const leagueAvg = leagueAverages[key] || 0;

    // Mock calculations - would be enhanced with real league data
    const percentile = calculatePercentile(teamValue, leagueAvg);
    const rank = Math.floor(Math.random() * 10) + 1; // Mock rank

    benchmarks[key] = {
      leagueAverage: leagueAvg,
      teamRank: rank,
      percentile,
      totalTeams: 12, // Mock total
    };
  });

  return benchmarks;
}

/**
 * Calculate overall fantasy score
 */
export function calculateOverallScore(
  teamStats: Record<string, number>,
  gaps: FantasyGap[]
): number {
  let score = 100;

  // Deduct points for gaps
  gaps.forEach(gap => {
    const deduction = Math.abs(gap.gap) * 2;
    score -= deduction;
  });

  // Add bonus for strengths
  const strengthBonus = Object.keys(teamStats).filter(key =>
    (teamStats[key] || 0) > (FANTASY_CATEGORIES[key as keyof typeof FANTASY_CATEGORIES]?.target || 0) * 1.2
  ).length * 5;

  score += strengthBonus;

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate recommendations based on analysis
 */
export function generateRecommendations(
  gaps: FantasyGap[],
  strengths: string[],
  rosterSize: number
): string[] {
  const recommendations: string[] = [];

  if (gaps.length > 3) {
    recommendations.push('Consider focusing on your most critical gaps first');
  }

  if (rosterSize < 12) {
    recommendations.push('Your roster has room for additional players to fill gaps');
  }

  if (strengths.length > gaps.length) {
    recommendations.push('Consider trading from your strengths to acquire needed skills');
  }

  return recommendations;
}

/**
 * Helper function to generate gap recommendations
 */
function generateGapRecommendation(category: string, gap: number, severity: string): string {
  const isDeficit = gap < 0;

  if (!isDeficit) return '';

  const recommendations = {
    points: 'Target high-scoring players or players with increased minutes',
    rebounds: 'Look for rebounding specialists or versatile forwards',
    assists: 'Consider playmaking guards or combo guards',
    steals: 'Target quick guards and defensive-minded players',
    blocks: 'Look for shot-blocking centers or defensive big men',
    three_pointers_made: 'Consider three-point specialists or stretch bigs',
    turnovers: 'Focus on ball-security and decision-making',
  };

  return recommendations[category as keyof typeof recommendations] || 'Target players who excel in this category';
}

/**
 * Mock suggestions for demonstration
 */
function generateMockSuggestions(category: string): AcquisitionSuggestion[] {
  const suggestions: Record<string, AcquisitionSuggestion[]> = {
    'Points Per Game': [
      {
        playerId: 'mock-1',
        playerName: 'Anthony Edwards',
        primaryBenefit: 'Scoring',
        projectedImpact: 8.5,
        rationale: 'High-volume scorer with efficient shooting',
        position: 'SG',
        nbaTeam: 'MIN',
        estimatedCost: 'High',
      }
    ],
    'Rebounds Per Game': [
      {
        playerId: 'mock-2',
        playerName: 'Domantas Sabonis',
        primaryBenefit: 'Rebounding',
        projectedImpact: 7.2,
        rationale: 'Elite rebounder with playmaking skills',
        position: 'C',
        nbaTeam: 'SAC',
        estimatedCost: 'High',
      }
    ],
    'Assists Per Game': [
      {
        playerId: 'mock-3',
        playerName: 'Luka Doncic',
        primaryBenefit: 'Playmaking',
        projectedImpact: 9.1,
        rationale: 'Triple-double machine with scoring',
        position: 'PG',
        nbaTeam: 'DAL',
        estimatedCost: 'Premium',
      }
    ],
  };

  return suggestions[category] || [];
}

/**
 * Calculate percentile ranking
 */
function calculatePercentile(teamValue: number, leagueAvg: number): number {
  if (leagueAvg === 0) return 50;

  // Simple percentile calculation
  const difference = teamValue - leagueAvg;
  const percentile = 50 + (difference / leagueAvg) * 50;

  return Math.max(0, Math.min(100, percentile));
}

/**
 * Fallback analysis for error cases
 */
function getFallbackAnalysis(): FantasyAnalysisResult {
  return {
    gaps: [],
    strengths: [],
    suggestions: [],
    benchmarks: {},
    overallScore: 50,
    recommendations: ['Unable to analyze roster at this time'],
  };
}