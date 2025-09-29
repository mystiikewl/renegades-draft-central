import React, { memo, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { FantasyImpactResult } from '@/utils/fantasyImpactCalculator';
import { cn } from '@/lib/utils';

interface FantasyImpactSectionProps {
  fantasyImpact: FantasyImpactResult | null;
  isLoading: boolean;
}

export const FantasyImpactSection = memo<FantasyImpactSectionProps>(({
  fantasyImpact,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Fantasy Impact Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
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

  if (!fantasyImpact) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Fantasy Impact Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Unable to calculate fantasy impact at this time.
          </div>
        </CardContent>
      </Card>
    );
  }

  const { impacts, totalFantasyScore, newTotalFantasyScore, fantasyScoreImprovement, overallRank, newOverallRank, overallRankChange } = fantasyImpact;

  const getImpactColor = (improvement: number) => {
    if (improvement > 0) return 'text-green-600';
    if (improvement < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getImpactIcon = (improvement: number) => {
    if (improvement > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (improvement < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const formatValue = (value: number, category: string) => {
    if (category.includes('%')) {
      return `${value.toFixed(1)}%`;
    } else if (category === '3PM') {
      return value.toFixed(1);
    } else {
      return value.toFixed(1);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Fantasy Impact Analysis
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          ESPN 8-Category Dynasty Impact
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Fantasy Score Impact */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Total Fantasy Score</span>
            <div className={cn("flex items-center gap-1", getImpactColor(fantasyScoreImprovement))}>
              {getImpactIcon(fantasyScoreImprovement)}
              <span className="font-bold">
                {fantasyScoreImprovement > 0 ? '+' : ''}{fantasyScoreImprovement.toFixed(1)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span>Current: {totalFantasyScore.toFixed(1)}</span>
            <span>→</span>
            <span>Projected: {newTotalFantasyScore.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span>League Rank: #{overallRank}</span>
            <span className={cn(getImpactColor(-overallRankChange))}>
              {getImpactIcon(-overallRankChange)}
              <span>→ #{newOverallRank} {overallRankChange > 0 ? `(+${overallRankChange})` : `(-${overallRankChange})`}</span>
            </span>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">Category Impact Breakdown</h4>
          {impacts.map((impact, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{impact.category}</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={impact.improvement > 0 ? "default" : impact.improvement < 0 ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {impact.improvement > 0 ? '+' : ''}{formatValue(impact.improvement, impact.category)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    #{impact.newCategoryRank}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Current: {formatValue(impact.currentValue, impact.category)}</span>
                  <span>Projected: {formatValue(impact.projectedValue, impact.category)}</span>
                </div>
                <Progress
                  value={impact.leaguePercentile || 0}
                  max={100}
                  className={cn(
                    "h-2",
                    impact.improvement > 0 ? "bg-green-100" : impact.improvement < 0 ? "bg-red-100" : "bg-gray-100"
                  )}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Rank: #{impact.categoryRank}</span>
                  <span className={cn("font-medium", getImpactColor(-impact.rankChange))}>
                    → #{impact.newCategoryRank} {impact.rankChange > 0 ? `(+${impact.rankChange})` : `(-${impact.rankChange})`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="p-4 bg-primary/5 rounded-lg">
          <h4 className="font-semibold text-sm mb-2">Summary</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Categories Improved:</span>
              <span className="font-medium text-green-600">
                {impacts.filter(i => i.improvement > 0).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Categories Declined:</span>
              <span className="font-medium text-red-600">
                {impacts.filter(i => i.improvement < 0).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Average Improvement:</span>
              <span className="font-medium">
                {(impacts.reduce((sum, i) => sum + i.improvementPercent, 0) / impacts.length).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

FantasyImpactSection.displayName = 'FantasyImpactSection';