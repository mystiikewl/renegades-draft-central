import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Shield,
  Users,
  Star
} from 'lucide-react';
import { FantasyGap, FantasyBenchmarks } from '@/utils/fantasyAnalysis';

interface FantasyMetricsCardProps {
  category: string;
  currentValue: number;
  targetValue: number;
  gap?: FantasyGap;
  benchmarks?: FantasyBenchmarks;
  isMobile?: boolean;
  onClick?: () => void;
}

export function FantasyMetricsCard({
  category,
  currentValue,
  targetValue,
  gap,
  benchmarks,
  isMobile,
  onClick,
}: FantasyMetricsCardProps) {
  const gapValue = gap?.gap || (currentValue - targetValue);
  const isDeficit = gapValue < 0;
  const isStrength = gapValue > 0;

  const progressPercentage = Math.min(100, Math.max(0,
    (currentValue / targetValue) * 100
  ));

  const getCategoryIcon = (categoryName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'Points Per Game': <Zap className="h-4 w-4" />,
      'Rebounds Per Game': <Shield className="h-4 w-4" />,
      'Assists Per Game': <Users className="h-4 w-4" />,
      'Steals Per Game': <Star className="h-4 w-4" />,
      'Blocks Per Game': <Target className="h-4 w-4" />,
      '3-Pointers Made': <Target className="h-4 w-4" />,
      'Turnovers Per Game': <TrendingDown className="h-4 w-4" />,
    };

    return iconMap[categoryName] || <Target className="h-4 w-4" />;
  };

  const getSeverityColor = (gap?: FantasyGap) => {
    if (!gap) return 'bg-muted';

    switch (gap.severity) {
      case 'critical': return 'bg-red-500';
      case 'moderate': return 'bg-yellow-500';
      case 'minor': return 'bg-green-500';
      default: return 'bg-muted';
    }
  };

  const getProgressColor = () => {
    if (isDeficit) return 'bg-red-500';
    if (isStrength) return 'bg-green-500';
    return 'bg-blue-500';
  };

  return (
    <TooltipProvider>
      <Card
        className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
          isMobile ? 'p-3' : 'p-4'
        }`}
        onClick={onClick}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className={`flex items-center gap-2 ${
              isMobile ? 'text-sm' : 'text-base'
            }`}>
              {getCategoryIcon(category)}
              <span className="truncate">{category}</span>
            </CardTitle>

            {gap && (
              <Badge
                variant="secondary"
                className={`${getSeverityColor(gap)} text-white ${
                  isMobile ? 'text-xs px-2 py-1' : 'text-xs'
                }`}
              >
                {gap.severity}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Main Value Display */}
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className={`font-bold ${isMobile ? 'text-lg' : 'text-xl'}`}>
                {currentValue.toFixed(1)}
              </div>
              <div className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                Current
              </div>
            </div>

            <div className="flex items-center gap-1">
              {isStrength ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : isDeficit ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : null}
              <div className={`text-center ${isMobile ? 'text-sm' : ''}`}>
                <div className="font-medium">
                  {gapValue > 0 ? '+' : ''}{gapValue.toFixed(1)}
                </div>
                <div className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                  Gap
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className={`font-bold ${isMobile ? 'text-lg' : 'text-xl'}`}>
                {targetValue.toFixed(1)}
              </div>
              <div className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                Target
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>{targetValue.toFixed(1)}</span>
            </div>
            <Progress
              value={progressPercentage}
              className="h-2"
              // Custom color styling would be applied via CSS classes
            />
          </div>

          {/* Benchmarks */}
          {benchmarks && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex justify-between items-center p-2 bg-muted/50 rounded text-xs ${
                  isMobile ? 'text-xs' : 'text-sm'
                }`}>
                  <span>Rank: {benchmarks.teamRank}/{benchmarks.totalTeams}</span>
                  <span>{benchmarks.percentile.toFixed(0)}th %ile</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p>League Average: {benchmarks.leagueAverage.toFixed(1)}</p>
                  <p>Team Rank: {benchmarks.teamRank} of {benchmarks.totalTeams}</p>
                  <p>Percentile: {benchmarks.percentile.toFixed(0)}th</p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Recommendation */}
          {gap?.recommendation && (
            <div className={`text-xs text-muted-foreground italic ${
              isMobile ? 'text-xs' : ''
            }`}>
              💡 {gap.recommendation}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}