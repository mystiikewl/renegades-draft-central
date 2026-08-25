import React, { memo, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Trophy,
  Target,
  Users,
  Award,
  TrendingUp,
  Calendar,
  Activity,
  Star
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { calculateFantasyScore } from '@/utils/fantasyScore';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface EnhancedStatsSectionProps {
  player: Tables<'players'>;
  className?: string;
}

export const EnhancedStatsSection = memo<EnhancedStatsSectionProps>(({
  player,
  className,
}) => {
  const isMobile = useIsMobile();
  const fantasyScore = calculateFantasyScore(player);

  // Calculate player trend and performance indicators
  const getPlayerTrend = () => {
    if (!player.games_played || !player.minutes_per_game) return null;
    return player.games_played > 50 && player.minutes_per_game > 25 ? 'trending-up' : 'stable';
  };

  const playerTrend = getPlayerTrend();

  const getFantasyScoreColor = (score: number) => {
    if (score >= 50) return 'text-green-600';
    if (score >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getFantasyScoreBadgeVariant = (score: number) => {
    if (score >= 50) return 'default';
    if (score >= 30) return 'secondary';
    return 'destructive';
  };

  const getStatProgressValue = (value: number, maxValue: number) => {
    return Math.min((value / maxValue) * 100, 100);
  };

  const formatStat = (value: number | null | undefined, decimals: number = 1) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(decimals);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          NBA Player Statistics
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Detailed performance metrics and fantasy analysis
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fantasy Score Highlight */}
        <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <span className="font-semibold">Fantasy Score</span>
            </div>
            <Badge
              variant={getFantasyScoreBadgeVariant(fantasyScore)}
              className="text-sm font-bold"
            >
              {fantasyScore.toFixed(1)}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Calculated based on NBA 2024-2025 Season Stats
          </div>
        </div>

        {/* Core Statistics Grid */}
        <div className={cn(
          "grid gap-4",
          isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'
        )}>
          <Card className="p-3 text-center hover:shadow-md transition-shadow">
            <div className={cn("font-bold text-primary", isMobile ? 'text-xl' : 'text-2xl')}>
              {formatStat(player.points)}
            </div>
            <div className="text-sm text-muted-foreground">PPG</div>
            <Progress
              value={getStatProgressValue(player.points || 0, 30)}
              className="h-1 mt-2"
            />
          </Card>

          <Card className="p-3 text-center hover:shadow-md transition-shadow">
            <div className={cn("font-bold text-primary", isMobile ? 'text-xl' : 'text-2xl')}>
              {formatStat(player.total_rebounds)}
            </div>
            <div className="text-sm text-muted-foreground">RPG</div>
            <Progress
              value={getStatProgressValue(player.total_rebounds || 0, 15)}
              className="h-1 mt-2"
            />
          </Card>

          <Card className="p-3 text-center hover:shadow-md transition-shadow">
            <div className={cn("font-bold text-primary", isMobile ? 'text-xl' : 'text-2xl')}>
              {formatStat(player.assists)}
            </div>
            <div className="text-sm text-muted-foreground">APG</div>
            <Progress
              value={getStatProgressValue(player.assists || 0, 12)}
              className="h-1 mt-2"
            />
          </Card>

          <Card className="p-3 text-center hover:shadow-md transition-shadow">
            <div className={cn("font-bold text-primary", isMobile ? 'text-xl' : 'text-2xl')}>
              {formatStat(player.steals)}
            </div>
            <div className="text-sm text-muted-foreground">SPG</div>
            <Progress
              value={getStatProgressValue(player.steals || 0, 2)}
              className="h-1 mt-2"
            />
          </Card>

          <Card className="p-3 text-center hover:shadow-md transition-shadow">
            <div className={cn("font-bold text-primary", isMobile ? 'text-xl' : 'text-2xl')}>
              {formatStat(player.blocks)}
            </div>
            <div className="text-sm text-muted-foreground">BPG</div>
            <Progress
              value={getStatProgressValue(player.blocks || 0, 3)}
              className="h-1 mt-2"
            />
          </Card>

          <Card className="p-3 text-center hover:shadow-md transition-shadow">
            <div className={cn("font-bold text-primary", isMobile ? 'text-xl' : 'text-2xl')}>
              {formatStat(player.three_pointers_made)}
            </div>
            <div className="text-sm text-muted-foreground">3PM</div>
            <Progress
              value={getStatProgressValue(player.three_pointers_made || 0, 3)}
              className="h-1 mt-2"
            />
          </Card>
        </div>

        {/* Detailed Statistics */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Target className="h-4 w-4" />
            Detailed Performance Metrics
          </h4>
          <div className={cn(
            "grid gap-3",
            isMobile ? 'grid-cols-1' : 'grid-cols-2'
          )}>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Field Goal %</span>
              </div>
              <span className="font-medium">{formatStat(player.field_goal_percentage, 1)}%</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Free Throw %</span>
              </div>
              <span className="font-medium">{formatStat(player.free_throw_percentage, 1)}%</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Minutes Per Game</span>
              </div>
              <span className="font-medium">{formatStat(player.minutes_per_game)}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Turnovers</span>
              </div>
              <span className="font-medium">{formatStat(player.turnovers)}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Games Played</span>
              </div>
              <span className="font-medium">{player.games_played || 'N/A'}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Rank</span>
              </div>
              <span className="font-medium">#{player.rank || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Player Status Indicators */}
        <div className="flex flex-wrap gap-2">
          {player.is_rookie && (
            <Badge variant="default" className="bg-green-600 text-white">
              Rookie
            </Badge>
          )}
          {playerTrend === 'trending-up' && (
            <Badge variant="default" className="bg-blue-600 text-white">
              <TrendingUp className="h-3 w-3 mr-1" />
              Trending Up
            </Badge>
          )}
          {player.games_played && player.games_played > 50 && (
            <Badge variant="outline" className="border-green-600 text-green-600">
              <Activity className="h-3 w-3 mr-1" />
              Experienced
            </Badge>
          )}
          {player.minutes_per_game && player.minutes_per_game > 30 && (
            <Badge variant="outline" className="border-purple-600 text-purple-600">
              <Star className="h-3 w-3 mr-1" />
              Heavy Minutes
            </Badge>
          )}
          {fantasyScore > 40 && (
            <Badge variant="default" className="bg-yellow-600 text-white">
              <Trophy className="h-3 w-3 mr-1" />
              Elite Fantasy Value
            </Badge>
          )}
        </div>

        {/* Performance Summary */}
        <div className="p-4 bg-muted/30 rounded-lg">
          <h4 className="font-semibold text-sm mb-2">Performance Summary</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Fantasy Contribution:</span>
              <span className={cn("font-medium", getFantasyScoreColor(fantasyScore))}>
                {fantasyScore >= 50 ? 'Elite' : fantasyScore >= 30 ? 'Solid' : 'Limited'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Experience Level:</span>
              <span className="font-medium">
                {(player.games_played || 0) > 50 ? 'Veteran' : 'Developing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Usage Rate:</span>
              <span className="font-medium">
                {(player.minutes_per_game || 0) > 30 ? 'Heavy' : 'Moderate'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

EnhancedStatsSection.displayName = 'EnhancedStatsSection';