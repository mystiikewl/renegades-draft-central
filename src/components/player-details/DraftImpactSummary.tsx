import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Target, Trophy, Zap } from 'lucide-react';
import { FantasyImpactResult } from '@/utils/fantasyImpactCalculator';
import { RankingImpactResult } from '@/utils/rankingImpactCalculator';
import { cn } from '@/lib/utils';

interface DraftImpactSummaryProps {
  fantasyImpact: FantasyImpactResult | null;
  rankingImpact: RankingImpactResult | null;
  isLoading: boolean;
}

export const DraftImpactSummary = memo<DraftImpactSummaryProps>(({
  fantasyImpact,
  rankingImpact,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded"></div>
            <div className="h-3 bg-muted animate-pulse rounded w-3/4"></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-8 bg-muted animate-pulse rounded"></div>
              <div className="h-8 bg-muted animate-pulse rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!fantasyImpact || !rankingImpact) {
    return (
      <Card className="border-2 border-muted">
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground text-sm">
            {isLoading ? "Calculating impact..." : "Impact analysis unavailable"}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { fantasyScoreImprovement, impacts } = fantasyImpact;
  const { overallRankChange, competitiveAnalysis } = rankingImpact;

  // Get top 3 most impactful categories
  const sortedImpacts = [...impacts]
    .sort((a, b) => Math.abs(b.improvement) - Math.abs(a.improvement))
    .slice(0, 3);

  const getImpactColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getImpactIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-3 w-3" />;
    if (value < 0) return <TrendingDown className="h-3 w-3" />;
    return <Target className="h-3 w-3" />;
  };

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Draft Impact Summary</span>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Fantasy Score */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Fantasy Score</div>
            <div className={cn("flex items-center gap-1", getImpactColor(fantasyScoreImprovement))}>
              {getImpactIcon(fantasyScoreImprovement)}
              <span className="font-bold text-sm">
                {fantasyScoreImprovement > 0 ? '+' : ''}{fantasyScoreImprovement.toFixed(1)}
              </span>
            </div>
          </div>

          {/* League Rank */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">League Rank</div>
            <div className={cn("flex items-center gap-1", getImpactColor(-overallRankChange))}>
              {getImpactIcon(-overallRankChange)}
              <span className="font-bold text-sm">
                {overallRankChange > 0 ? '+' : ''}{overallRankChange}
              </span>
            </div>
          </div>
        </div>

        {/* Top Category Impacts */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground font-medium">Key Category Changes</div>
          <div className="space-y-1">
            {sortedImpacts.map((impact, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{impact.category}</span>
                <div className={cn("flex items-center gap-1", getImpactColor(impact.improvement))}>
                  {getImpactIcon(impact.improvement)}
                  <span className="font-medium">
                    {impact.improvement > 0 ? '+' : ''}{impact.improvement.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Playoff Impact */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              Playoff Odds
            </span>
            <Badge
              variant={competitiveAnalysis.playoffProbability > 50 ? "default" : "secondary"}
              className="text-xs px-2 py-0"
            >
              {competitiveAnalysis.playoffProbability}%
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

DraftImpactSummary.displayName = 'DraftImpactSummary';
