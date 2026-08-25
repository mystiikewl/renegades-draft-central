import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tables } from '@/integrations/supabase/types';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { useEffectiveFantasySettings } from '@/hooks/useFantasySettings';

// Import new fantasy analysis components and utilities
import { FantasyMetricsCard } from './fantasy-analysis/FantasyMetricsCard';
import { AcquisitionSuggestionsList } from './fantasy-analysis/AcquisitionSuggestionsList';
import {
  calculateFantasyAnalysis,
  FANTASY_CATEGORIES,
  FantasyGap,
  FantasyAnalysisResult
} from '@/utils/fantasyAnalysis';

interface TeamRosterAnalysisProps {
  players: Tables<'players'>[];
}

export function TeamRosterAnalysis({ players }: TeamRosterAnalysisProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const isMobile = useIsMobile();
  const { settings } = useEffectiveFantasySettings();

  // Mock league averages - in production, this would come from a league analysis service
  const leagueAverages = useMemo(() => ({
    points: 15.5,
    rebounds: 6.2,
    assists: 4.8,
    steals: 1.0,
    blocks: 0.8,
    three_pointers_made: 2.1,
    turnovers: 2.2,
  }), []);

  // Calculate comprehensive fantasy analysis
  const analysis: FantasyAnalysisResult = useMemo(() => {
    return calculateFantasyAnalysis(players, leagueAverages, settings);
  }, [players, leagueAverages, settings]);

  const { gaps, strengths, suggestions, benchmarks, overallScore, recommendations } = analysis;

  const criticalGaps = gaps.filter(gap => gap.severity === 'critical');
  const moderateGaps = gaps.filter(gap => gap.severity === 'moderate');
  const minorGaps = gaps.filter(gap => gap.severity === 'minor');

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

  return (
    <Card className={`bg-gradient-card shadow-card mt-6 ${isMobile ? 'p-3' : 'p-4 md:p-6'}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : 'text-xl'} font-bold`}>
          <BarChart3 className="h-5 w-5" />
          Fantasy Analysis
        </CardTitle>

        {/* Overall Score Display */}
        <div className="flex items-center gap-4 mt-4">
          {getScoreIcon(overallScore)}
          <div>
            <div className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}/100
            </div>
            <div className={`text-sm ${isMobile ? 'text-xs' : ''} text-muted-foreground`}>
              Fantasy Score
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} mb-4`}>
            <TabsTrigger value="overview" className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              {!isMobile && 'Overview'}
            </TabsTrigger>
            <TabsTrigger value="gaps" className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              {!isMobile && 'Gaps'}
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="flex items-center gap-1">
              <Lightbulb className="h-4 w-4" />
              {!isMobile && 'Suggestions'}
            </TabsTrigger>
            <TabsTrigger value="benchmarks" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              {!isMobile && 'Benchmarks'}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-background/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">Critical Gaps</span>
                </div>
                <div className="text-2xl font-bold text-red-600">{criticalGaps.length}</div>
              </div>

              <div className="p-4 bg-background/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Strengths</span>
                </div>
                <div className="text-2xl font-bold text-green-600">{strengths.length}</div>
              </div>

              <div className="p-4 bg-background/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Roster Size</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">{players.length}</div>
              </div>
            </div>

            {/* Strengths & Quick Recommendations */}
            {strengths.length > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Team Strengths
                </h4>
                <div className="flex flex-wrap gap-2">
                  {strengths.map((strength) => (
                    <Badge key={strength} variant="secondary" className="bg-green-100 text-green-800">
                      {strength}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Strategic Recommendations */}
            {recommendations.length > 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Strategic Recommendations
                </h4>
                <ul className="space-y-1 text-sm text-blue-700">
                  {recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span>•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          {/* Gaps Analysis Tab */}
          <TabsContent value="gaps" className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-lg font-semibold">Fantasy Gaps Analysis</h4>

              {criticalGaps.length > 0 && (
                <div>
                  <h5 className="text-md font-medium text-red-600 mb-3">Critical Gaps</h5>
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
                </div>
              )}

              {moderateGaps.length > 0 && (
                <div>
                  <h5 className="text-md font-medium text-yellow-600 mb-3">Moderate Gaps</h5>
                  <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                    {moderateGaps.map((gap) => (
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

              {minorGaps.length > 0 && (
                <div>
                  <h5 className="text-md font-medium text-green-600 mb-3">Minor Gaps</h5>
                  <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                    {minorGaps.map((gap) => (
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

              {gaps.length === 0 && (
                <div className="text-center py-8 text-green-600">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-medium">No significant gaps detected!</p>
                  <p className="text-sm text-muted-foreground">Your roster is well-balanced for fantasy basketball.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Suggestions Tab */}
          <TabsContent value="suggestions" className="space-y-6">
            <AcquisitionSuggestionsList
              suggestions={suggestions}
              isMobile={isMobile}
              onPlayerSelect={(playerId) => {
                // Handle player selection - could integrate with draft system
                console.log('Selected player:', playerId);
              }}
            />
          </TabsContent>

          {/* Benchmarks Tab */}
          <TabsContent value="benchmarks" className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-lg font-semibold">League Benchmarks</h4>
              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                {Object.entries(benchmarks).map(([category, benchmark]) => (
                  <Card key={category} className="p-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium">{FANTASY_CATEGORIES[category as keyof typeof FANTASY_CATEGORIES]?.name || category}</h5>
                      <Badge variant="outline">
                        #{benchmark.teamRank} of {benchmark.totalTeams}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Team Average:</span>
                        <span className="font-medium">
                          {Object.values(FANTASY_CATEGORIES).find(cat => cat.name === (FANTASY_CATEGORIES[category as keyof typeof FANTASY_CATEGORIES]?.name)) ?
                            `${benchmark.leagueAverage.toFixed(1)}` :
                            `${benchmark.leagueAverage.toFixed(2)}%`}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Percentile:</span>
                        <span className="font-medium">{benchmark.percentile.toFixed(0)}th</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
