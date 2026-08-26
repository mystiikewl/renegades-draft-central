import React, { memo, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, TrendingUp, TrendingDown, Target, Users } from 'lucide-react';
import { RankingImpactResult } from '@/utils/rankingImpactCalculator';
import { cn } from '@/lib/utils';

interface RankingImpactSectionProps {
  rankingImpact: RankingImpactResult | null;
  isLoading: boolean;
}

export const RankingImpactSection = memo<RankingImpactSectionProps>(({
  rankingImpact,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Team Ranking Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded"></div>
                <div className="h-2 bg-muted animate-pulse rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!rankingImpact) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Team Ranking Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Unable to calculate ranking impact at this time.
          </div>
        </CardContent>
      </Card>
    );
  }

  const { categoryRankings, overallRankChange, competitiveAnalysis, playoffImpact } = rankingImpact;

  const getRankChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Target className="h-4 w-4 text-gray-600" />;
  };

  const getRankChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getCompetitiveAdvantageColor = (advantage: string) => {
    switch (advantage) {
      case 'strong': return 'bg-green-100 text-green-800 border-green-200';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'weak': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Team Ranking Impact
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          How adding this player affects your league standings
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Rank Change */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Overall League Rank</span>
            <div className={cn("flex items-center gap-1", getRankChangeColor(overallRankChange))}>
              {getRankChangeIcon(overallRankChange)}
              <span className="font-bold">
                {overallRankChange > 0 ? '+' : ''}{overallRankChange}
              </span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {overallRankChange > 0 && `Climb ${overallRankChange} spots in the league`}
            {overallRankChange < 0 && `Drop ${Math.abs(overallRankChange)} spots in the league`}
            {overallRankChange === 0 && "No change in overall league position"}
          </div>
        </div>

        {/* Category Ranking Changes */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">Category Ranking Changes</h4>
          {categoryRankings.map((ranking, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{ranking.category}</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("text-xs", getCompetitiveAdvantageColor(ranking.competitiveAdvantage))}
                  >
                    {ranking.competitiveAdvantage}
                  </Badge>
                  <div className={cn("flex items-center gap-1", getRankChangeColor(ranking.rankChange))}>
                    {getRankChangeIcon(ranking.rankChange)}
                    <span className="text-xs font-bold">
                      {ranking.rankChange > 0 ? '+' : ''}{ranking.rankChange}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>#{ranking.currentRank}</span>
                  <span>#{ranking.projectedRank}</span>
                </div>
                <Progress
                  value={Math.min(Math.abs(ranking.percentileChange), 100)}
                  className={cn(
                    "h-2",
                    ranking.rankChange > 0 ? "bg-green-100" : ranking.rankChange < 0 ? "bg-red-100" : "bg-gray-100"
                  )}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Current: #{ranking.currentRank}</span>
                  <span>New: #{ranking.projectedRank}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Competitive Analysis */}
        <div className="p-4 bg-primary/5 rounded-lg">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Competitive Analysis
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Competitive Score:</span>
              <div className="flex items-center gap-2">
                <Progress
                  value={competitiveAnalysis.overallCompetitiveScore}
                  className="w-20 h-2"
                />
                <span className="text-sm font-bold">
                  {competitiveAnalysis.overallCompetitiveScore}/100
                </span>
              </div>
            </div>

            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Categories Improved:</span>
                <span className="font-medium text-green-600">
                  {competitiveAnalysis.categoryStrengths.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Categories Declined:</span>
                <span className="font-medium text-red-600">
                  {competitiveAnalysis.categoryWeaknesses.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Playoff Probability:</span>
                <span className="font-medium text-blue-600">
                  {competitiveAnalysis.playoffProbability}%
                </span>
              </div>
            </div>

            {competitiveAnalysis.categoryStrengths.length > 0 && (
              <div className="text-xs text-green-700 bg-green-50 p-2 rounded">
                <span className="font-medium">Strengths: </span>
                {competitiveAnalysis.categoryStrengths.join(', ')}
              </div>
            )}

            {competitiveAnalysis.categoryWeaknesses.length > 0 && (
              <div className="text-xs text-red-700 bg-red-50 p-2 rounded">
                <span className="font-medium">Areas to Monitor: </span>
                {competitiveAnalysis.categoryWeaknesses.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Playoff Impact */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-blue-800">
            <Trophy className="h-4 w-4" />
            Playoff Impact
          </h4>
          <div className="space-y-2 text-sm text-blue-900">
            <div className="flex justify-between">
              <span>Current Position:</span>
              <span className="font-medium">
                {playoffImpact.currentPlayoffPosition > 0
                  ? `#${playoffImpact.currentPlayoffPosition}`
                  : 'Not in playoffs'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Projected Position:</span>
              <span className="font-medium">
                {playoffImpact.projectedPlayoffPosition > 0
                  ? `#${playoffImpact.projectedPlayoffPosition}`
                  : 'Not in playoffs'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Odds Improvement:</span>
              <span className={cn(
                "font-medium",
                playoffImpact.playoffOddsImprovement > 0 ? "text-green-600" : "text-red-600"
              )}>
                {playoffImpact.playoffOddsImprovement > 0 ? '+' : ''}
                {playoffImpact.playoffOddsImprovement}%
              </span>
            </div>
            {playoffImpact.keyCategoriesForPlayoffs.length > 0 && (
              <div className="text-xs text-blue-800 bg-blue-100 p-2 rounded mt-3">
                <span className="font-medium">Key Categories for Playoffs: </span>
                {playoffImpact.keyCategoriesForPlayoffs.join(', ')}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

RankingImpactSection.displayName = 'RankingImpactSection';