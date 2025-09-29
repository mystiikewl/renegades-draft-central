import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Zap,
  Shield,
  Star,
  AlertTriangle,
  CheckCircle,
  Lightbulb
} from 'lucide-react';

interface TeamAnalyticsPanelProps {
  isMobile: boolean;
}

export const TeamAnalyticsPanel = memo(({ isMobile }: TeamAnalyticsPanelProps) => {
  // Mock analytics data - in production, this would come from your analytics service
  const analytics = {
    teamStrength: 78,
    leagueRank: 5,
    totalTeams: 12,
    recentPerformance: [
      { metric: 'Draft Efficiency', value: 85, trend: 'up' },
      { metric: 'Trade Activity', value: 72, trend: 'stable' },
      { metric: 'Roster Balance', value: 90, trend: 'up' }
    ],
    recommendations: [
      'Consider trading for a power forward to improve frontcourt depth',
      'Your draft picks are undervalued - consider selling in future drafts',
      'Focus on defensive specialists in the next waiver period'
    ]
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (score >= 60) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-400" />;
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Team Strength Overview */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader className={cn(isMobile ? 'p-3' : 'p-4 md:p-6')}>
          <CardTitle className={cn(
            "flex items-center gap-2 font-bold",
            isMobile ? "text-lg" : "text-xl"
          )}>
            <BarChart3 className="h-5 w-5" />
            Team Analytics
          </CardTitle>
          <div className="flex items-center gap-4 mt-4">
            {getScoreIcon(analytics.teamStrength)}
            <div>
              <div className={`text-2xl font-bold ${getScoreColor(analytics.teamStrength)}`}>
                {analytics.teamStrength}/100
              </div>
              <div className={cn(
                "text-muted-foreground",
                isMobile ? "text-xs" : "text-sm"
              )}>
                Overall Team Strength
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn(isMobile ? 'p-3 pt-0' : 'p-4 md:p-6 pt-0')}>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-background/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Active Teams</span>
              </div>
              <div className="text-2xl font-bold">{analytics.totalTeams}</div>
            </div>

            <div className="p-4 bg-background/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Your Rank</span>
              </div>
              <div className="text-2xl font-bold">#{analytics.leagueRank}</div>
            </div>

            <div className="p-4 bg-background/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Trend</span>
              </div>
              <div className="text-2xl font-bold text-green-600">+2</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* League Standing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            League Standing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold">
              #{analytics.leagueRank} of {analytics.totalTeams}
            </span>
            <Badge variant="secondary">
              Top {Math.round((analytics.totalTeams - analytics.leagueRank + 1) / analytics.totalTeams * 100)}%
            </Badge>
          </div>
          <Progress
            value={(analytics.totalTeams - analytics.leagueRank + 1) / analytics.totalTeams * 100}
            className="h-2"
          />
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {analytics.recentPerformance.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
              <div className="flex items-center gap-2">
                {getTrendIcon(item.trend)}
                <span className="font-medium">{item.metric}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{item.value}%</span>
                <Progress value={item.value} className="w-20 h-2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Star className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800">{recommendation}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Active Teams</span>
            </div>
            <div className="text-2xl font-bold">{analytics.totalTeams}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Your Rank</span>
            </div>
            <div className="text-2xl font-bold">#{analytics.leagueRank}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Trend</span>
            </div>
            <div className="text-2xl font-bold text-green-600">+2</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});