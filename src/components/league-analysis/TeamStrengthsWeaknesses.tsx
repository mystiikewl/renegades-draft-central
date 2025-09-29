import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Star, TrendingUp, Target, Trophy, Users, Zap, Shield, Dribbble, Swords, Scale } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { calculateFantasyScore } from '@/utils/fantasyScore';
import { TeamStats } from '@/utils/leagueAnalysis';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEffectiveFantasySettings } from '@/hooks/useFantasySettings';
import {
  calculateFantasyAnalysis,
  FANTASY_CATEGORIES,
  FantasyAnalysisResult
} from '@/utils/fantasyAnalysis';
import { FantasyMetricsCard } from '@/components/fantasy-analysis/FantasyMetricsCard';

// Define a type for player positions
type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

// Extend Tables<'keepers'> to include the nested player object
type KeeperPlayer = Tables<'keepers'> & { player: Tables<'players'> };

interface TeamStrengthsWeaknessesProps {
  players: (Tables<'players'> | KeeperPlayer)[];
  teamStats?: TeamStats;
  leagueAverageStats?: TeamStats;
}

// Helper to determine positional needs
const getPositionalNeeds = (players: (Tables<'players'> | KeeperPlayer)[]) => {
  const positionCounts = players.reduce((acc, p) => {
    const position = ('player' in p ? p.player.position : p.position) as Position;
    acc[position] = (acc[position] || 0) + 1;
    return acc;
  }, {} as Record<Position, number>);

  const needs: string[] = [];
  if ((positionCounts['PG'] || 0) < 2) needs.push('Point Guard (PG)');
  if ((positionCounts['SG'] || 0) < 2) needs.push('Shooting Guard (SG)');
  if ((positionCounts['SF'] || 0) < 2) needs.push('Small Forward (SF)');
  if ((positionCounts['PF'] || 0) < 2) needs.push('Power Forward (PF)');
  if ((positionCounts['C'] || 0) < 1) needs.push('Center (C)');

  return needs;
};

// Helper to identify strengths and weaknesses based on league average
const getStrengthsAndWeaknesses = (teamStats: TeamStats, leagueAverageStats: TeamStats) => {
  const categories = [
    { key: 'points', name: 'Points', icon: <Zap className="h-4 w-4" /> },
    { key: 'rebounds', name: 'Rebounds', icon: <Shield className="h-4 w-4" /> },
    { key: 'assists', name: 'Assists', icon: <Dribbble className="h-4 w-4" /> },
    { key: 'steals', name: 'Steals', icon: <Swords className="h-4 w-4" /> },
    { key: 'blocks', name: 'Blocks', icon: <Scale className="h-4 w-4" /> },
    { key: 'three_pointers_made', name: '3 Pointers Made', icon: <Target className="h-4 w-4" /> },
    { key: 'turnovers', name: 'Turnovers', isInverse: true, icon: <Users className="h-4 w-4" /> }, // Inverse metric
  ];

  const comparativeStats = categories.map(cat => {
    const teamValue = teamStats[cat.key as keyof TeamStats] as number;
    const leagueValue = leagueAverageStats[cat.key as keyof TeamStats] as number;
    const difference = cat.isInverse ? leagueValue - teamValue : teamValue - leagueValue; // For turnovers, higher league avg - team value is better

    return {
      ...cat,
      teamValue,
      leagueValue,
      difference,
      isStrength: difference > 0,
    };
  });

  const strengths = comparativeStats
    .filter(s => s.isStrength)
    .sort((a, b) => b.difference - a.difference)
    .slice(0, 3);

  const weaknesses = comparativeStats
    .filter(s => !s.isStrength)
    .sort((a, b) => a.difference - b.difference)
    .slice(0, 3);

  return { strengths, weaknesses };
};

export const TeamStrengthsWeaknesses = ({
  players,
  teamStats,
  leagueAverageStats
}: TeamStrengthsWeaknessesProps) => {
  const isMobile = useIsMobile();
  const { settings } = useEffectiveFantasySettings();

  // Convert players to consistent format for fantasy analysis
  const normalizedPlayers = players.map(p => 'player' in p ? p.player : p);

  // Mock league averages - in production, this would come from league data
  const leagueAverages = {
    points: 15.5,
    rebounds: 6.2,
    assists: 4.8,
    steals: 1.0,
    blocks: 0.8,
    three_pointers_made: 2.1,
    turnovers: 2.2,
  };

  // Calculate comprehensive fantasy analysis
  const analysis: FantasyAnalysisResult = calculateFantasyAnalysis(normalizedPlayers, leagueAverages, settings);
  const { gaps, strengths, suggestions, benchmarks, overallScore, recommendations } = analysis;

  const totalTeamScore = normalizedPlayers.reduce((sum, p) => sum + calculateFantasyScore(p), 0);
  const averagePlayerScore = normalizedPlayers.length > 0 ? totalTeamScore / normalizedPlayers.length : 0;

  // Legacy positional needs for backward compatibility
  const positionalNeeds = getPositionalNeeds(players);

  // Use new fantasy analysis strengths/weaknesses
  const fantasyStrengths = strengths;
  const criticalGaps = gaps.filter(gap => gap.severity === 'critical');
  const otherWeaknesses = gaps.filter(gap => gap.severity !== 'critical');

  return (
    <div className="space-y-6">
      {/* Team Overview Card */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Team Overview & Summary
          </CardTitle>
          <CardDescription>
            A comprehensive look at your team's composition and performance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-background/50 rounded-lg border">
              <div className="text-sm text-muted-foreground mb-1">Total Roster Score</div>
              <div className="text-2xl font-bold">{totalTeamScore.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground mt-1">Combined fantasy points from all players</div>
            </div>
            
            <div className="p-4 bg-background/50 rounded-lg border">
              <div className="text-sm text-muted-foreground mb-1">Average Player Score</div>
              <div className="text-2xl font-bold">{averagePlayerScore.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground mt-1">Per player contribution</div>
            </div>
            
            <div className="p-4 bg-background/50 rounded-lg border">
              <div className="text-sm text-muted-foreground mb-1">Roster Size</div>
              <div className="text-2xl font-bold">{players.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Total players on your team</div>
            </div>
          </div>

          {players.length > 0 && (
            <div className="pt-2">
              <div className="text-sm font-medium mb-2">Top Fantasy Contributors</div>
              <div className="space-y-2">
                {players
                  .sort((a, b) => calculateFantasyScore('player' in b ? b.player : b) - calculateFantasyScore('player' in a ? a.player : a))
                  .slice(0, 3)
                  .map((p, index) => {
                    const player = 'player' in p ? p.player : p;
                    return (
                      <div key={player.id} className="flex items-center justify-between p-2 bg-background/30 rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            #{index + 1}
                          </Badge>
                          <span className="font-medium">{player.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <span className="font-medium">{calculateFantasyScore(player).toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fantasy Analysis - Strengths & Gaps */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Fantasy Analysis
          </CardTitle>
          <CardDescription>
            Key fantasy areas where your team excels or needs improvement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Strengths Section */}
          <div>
            <h4 className="text-lg font-semibold mb-2">Fantasy Strengths</h4>
            {fantasyStrengths.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {fantasyStrengths.map((strength) => (
                  <Badge key={strength} variant="default" className="text-sm bg-green-500 hover:bg-green-600">
                    {strength}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No clear fantasy strengths identified yet.</p>
            )}
          </div>

          {/* Critical Gaps Section */}
          <div>
            <h4 className="text-lg font-semibold mb-2">Critical Fantasy Gaps</h4>
            {criticalGaps.length > 0 ? (
              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                {criticalGaps.map((gap) => (
                  <FantasyMetricsCard
                    key={gap.category}
                    category={gap.category}
                    currentValue={gap.currentValue}
                    targetValue={gap.targetValue}
                    gap={gap}
                    benchmarks={benchmarks[gap.category.toLowerCase().replace(/[^a-z0-9]/g, '')]}
                    isMobile={isMobile}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No critical fantasy gaps detected!</p>
            )}
          </div>

          {/* Other Gaps Section */}
          {otherWeaknesses.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold mb-2">Other Fantasy Gaps</h4>
              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                {otherWeaknesses.map((gap) => (
                  <FantasyMetricsCard
                    key={gap.category}
                    category={gap.category}
                    currentValue={gap.currentValue}
                    targetValue={gap.targetValue}
                    gap={gap}
                    benchmarks={benchmarks[gap.category.toLowerCase().replace(/[^a-z0-9]/g, '')]}
                    isMobile={isMobile}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Positional Needs */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            Positional Needs
          </CardTitle>
          <CardDescription>
            Identify positions where your team might need more depth or talent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {positionalNeeds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {positionalNeeds.map((need) => (
                <Badge key={need} variant="outline" className="text-sm border-dashed">
                  {need}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Your roster appears to have good positional balance.</p>
          )}
        </CardContent>
      </Card>

      {/* Strategic Summary */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Strategic Summary
          </CardTitle>
          <CardDescription>
            Overall insights and recommendations for your team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {teamStats && leagueAverageStats ? (
              <>
                Your team currently ranks{' '}
                <span className="font-semibold">
                  {teamStats.totalFantasyScore > leagueAverageStats.totalFantasyScore ? 'above' : 'below'}
                </span>{' '}
                the league average in total fantasy score.
                {fantasyStrengths.length > 0 && ` You excel in ${fantasyStrengths.join(', ')}.`}
                {criticalGaps.length > 0 && ` Focus on addressing your critical gaps in ${criticalGaps.map(g => g.category).join(', ')}.`}
                {positionalNeeds.length > 0 && ` You also have positional needs at ${positionalNeeds.join(', ')}.`}
              </>
            ) : (
              "Analyze your team's strengths and weaknesses to optimize your draft strategy."
            )}
          </p>
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm">
              <span className="font-semibold">Pro Tip:</span> Use these insights to guide your draft picks,
              filling positional gaps and shoring up statistical weaknesses.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
