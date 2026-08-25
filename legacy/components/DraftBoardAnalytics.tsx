import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getTeamColorPalette } from '@/lib/teams';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Clock,
  Activity,
  Zap
} from 'lucide-react';

interface DraftPick {
  round: number;
  pick: number;
  overallPick: number;
  team: string;
  player?: {
    id: string;
    name: string;
    position: string;
    nbaTeam: string;
    points?: number;
    rebounds?: number;
    assists?: number;
    blocks?: number;
    steals?: number;
    rank?: number;
    isRookie?: boolean;
  };
  timestamp?: string;
}

interface DraftBoardAnalyticsProps {
  picks: DraftPick[];
  teams: string[];
  currentPick: number;
}

export function DraftBoardAnalytics({ picks, teams, currentPick }: DraftBoardAnalyticsProps) {
  const analytics = useMemo(() => {
    const completedPicks = picks.filter(p => p.player);
    const totalPicks = picks.length;

    // Recent picks (last 5)
    const recentPicks = completedPicks.slice(-5);

    // Position analysis
    const positionCounts = completedPicks.reduce((acc, pick) => {
      if (pick.player?.position) {
        acc[pick.player.position] = (acc[pick.player.position] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Team analysis
    const teamPicks = completedPicks.reduce((acc, pick) => {
      acc[pick.team] = (acc[pick.team] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Popular players by rank
    const popularPicks = completedPicks
      .filter(p => p.player?.rank)
      .sort((a, b) => (a.player?.rank || 999) - (b.player?.rank || 999))
      .slice(0, 10);

    // Value analysis - picks with high ranks taken late
    const valuePicks = completedPicks
      .filter(p => p.player?.rank && p.player.rank <= 50 && p.overallPick > 50)
      .sort((a, b) => (b.player?.rank || 0) - (a.player?.rank || 0));

    return {
      completedPicks: completedPicks.length,
      totalPicks,
      progress: (completedPicks.length / totalPicks) * 100,
      recentPicks,
      positionCounts,
      teamPicks,
      popularPicks,
      valuePicks,
      avgRank: completedPicks.reduce((sum, pick) =>
        sum + (pick.player?.rank || 0), 0) / completedPicks.length
    };
  }, [picks]);

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Draft Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>{analytics.completedPicks} of {analytics.totalPicks} picks completed</span>
              <span>{Math.round(analytics.progress)}%</span>
            </div>
            <Progress value={analytics.progress} className="h-3" />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Average Rank</div>
                <div className="text-2xl font-bold">
                  {analytics.avgRank > 0 ? Math.round(analytics.avgRank) : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Teams Active</div>
                <div className="text-2xl font-bold">
                  {Object.keys(analytics.teamPicks).length}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Picks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.recentPicks.map((pick) => {
              const teamPalette = getTeamColorPalette(pick.team, teams);
              return (
                <div
                  key={pick.overallPick}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{
                    background: `linear-gradient(135deg, ${teamPalette.primary}10, ${teamPalette.secondary}10)`
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-mono font-bold">
                      #{pick.overallPick}
                    </div>
                    <div>
                      <div className="font-semibold">{pick.player?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {pick.player?.position} • {pick.player?.nbaTeam}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pick.player?.rank && (
                      <Badge variant="outline" className="text-xs">
                        #{pick.player.rank}
                      </Badge>
                    )}
                    <div
                      className="text-sm font-bold px-2 py-1 rounded"
                      style={{ color: teamPalette.primary }}
                    >
                      {pick.team}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Position Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Position Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(analytics.positionCounts)
              .sort(([,a], [,b]) => b - a)
              .map(([position, count]) => {
                const percentage = (count / analytics.completedPicks) * 100;
                return (
                  <div key={position} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {position}
                      </Badge>
                      <span className="text-sm">{count} picks</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10">
                        {Math.round(percentage)}%
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Value Picks */}
      {analytics.valuePicks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Value Picks
              <span className="text-sm text-muted-foreground font-normal">
                (High-ranked players taken late)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.valuePicks.slice(0, 5).map((pick) => (
                <div key={pick.overallPick} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">#{pick.overallPick}</span>
                    <span>{pick.player?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      #{pick.player?.rank}
                    </Badge>
                    <span className="text-muted-foreground">
                      +{pick.overallPick - (pick.player?.rank || 0)} picks
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Team Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(analytics.teamPicks)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 6)
              .map(([team, count]) => {
                const teamPalette = getTeamColorPalette(team, teams);
                return (
                  <div
                    key={team}
                    className="text-center p-3 rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${teamPalette.primary}15, ${teamPalette.secondary}15)`
                    }}
                  >
                    <div
                      className="font-bold text-lg"
                      style={{ color: teamPalette.primary }}
                    >
                      {count}
                    </div>
                    <div className="text-sm text-muted-foreground">{team}</div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}