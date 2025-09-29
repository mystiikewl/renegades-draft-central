import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTeamColorPalette } from '@/lib/teams';
import { DraftBoardAnalytics } from './DraftBoardAnalytics';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  TrendingUp,
  Star,
  Shield,
  Target,
  Activity,
  Search,
  Filter,
  LayoutGrid,
  BarChart3,
  ChevronUp,
  ChevronDown
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
     // Enhanced player statistics
     points?: number;
     rebounds?: number;
     assists?: number;
     blocks?: number;
     steals?: number;
     turnovers?: number;
     fieldGoalPercentage?: number;
     threePointPercentage?: number;
     freeThrowPercentage?: number;
     minutesPerGame?: number;
     gamesPlayed?: number;
     age?: number;
     rank?: number;
     isRookie?: boolean;
     isKeeper?: boolean;
   };
   isActive?: boolean;
   timestamp?: string;
 }

interface DraftBoardProps {
  picks: DraftPick[];
  teams: string[];
  currentPick: number;
}

export function DraftBoard({ picks, teams, currentPick }: DraftBoardProps) {
   const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
   const [hoveredPick, setHoveredPick] = useState<number | null>(null);
   const [searchQuery, setSearchQuery] = useState('');
   const [selectedTeam, setSelectedTeam] = useState<string>('');
   const [viewMode, setViewMode] = useState<'board' | 'analytics'>('board');
   const [sortBy, setSortBy] = useState<'overall' | 'team' | 'value'>('overall');
   const [selectedPosition, setSelectedPosition] = useState<string>('');

   const rounds = Math.max(...picks.map(p => p.round));
   const teamsCount = teams.length;

   // Utility functions for enhanced features
   const getPlayerValueScore = (player?: DraftPick['player']) => {
     if (!player) return 0;
     const points = player.points || 0;
     const rebounds = player.rebounds || 0;
     const assists = player.assists || 0;
     const blocks = player.blocks || 0;
     const steals = player.steals || 0;
     return (points * 0.4) + (rebounds * 0.3) + (assists * 0.2) + (blocks * 0.05) + (steals * 0.05);
   };

   const getPlayerTrend = (player?: DraftPick['player']) => {
     if (!player) return null;
     // Simple trend calculation based on recent performance
     const recentGames = player.gamesPlayed || 0;
     const mpg = player.minutesPerGame || 0;
     return recentGames > 50 && mpg > 25 ? 'trending-up' : recentGames > 30 ? 'stable' : 'trending-down';
   };

   const toggleCardExpansion = (pickNumber: number) => {
     const newExpanded = new Set(expandedCards);
     if (newExpanded.has(pickNumber)) {
       newExpanded.delete(pickNumber);
     } else {
       newExpanded.add(pickNumber);
     }
     setExpandedCards(newExpanded);
   };

   // Filter and search logic
   const filteredPicks = useMemo(() => {
     return picks.filter((pick) => {
       // Search filter
       const matchesSearch = !searchQuery ||
         pick.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
         (pick.player?.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
         (pick.player?.nbaTeam.toLowerCase().includes(searchQuery.toLowerCase()));

       // Team filter
       const matchesTeam = !selectedTeam || pick.team === selectedTeam;

       // Position filter
       const matchesPosition = !selectedPosition || pick.player?.position === selectedPosition;

       return matchesSearch && matchesTeam && matchesPosition;
     }).sort((a, b) => {
       switch (sortBy) {
         case 'team':
           return a.team.localeCompare(b.team);
         case 'value':
           const valueA = getPlayerValueScore(a.player);
           const valueB = getPlayerValueScore(b.player);
           return valueB - valueA;
         default:
           return a.overallPick - b.overallPick;
       }
     });
   }, [picks, searchQuery, selectedTeam, selectedPosition, sortBy]);

   // Keyboard navigation
   const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
     if (event.key === 'Escape') {
       setSearchQuery('');
       setSelectedTeam('');
       setSelectedPosition('');
     } else if (event.key === 'f' && (event.ctrlKey || event.metaKey)) {
       event.preventDefault();
       document.getElementById('search-input')?.focus();
     }
   }, []);

   // Clear all filters
   const clearFilters = () => {
     setSearchQuery('');
     setSelectedTeam('');
     setSelectedPosition('');
   };

  const getPickByRoundAndPosition = (round: number, position: number) => {
    return picks.find(p => p.round === round && ((p.pick - 1) % teamsCount) + 1 === position);
  };

  return (
    <div className="w-full" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Enhanced Controls */}
      <div className="mb-6 space-y-4">
        {/* View Mode Toggle */}
        <div className="flex justify-center">
          <div className="flex bg-card rounded-lg p-1 shadow-sm">
            <Button
              variant={viewMode === 'board' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('board')}
              className="flex items-center gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Draft Board
            </Button>
            <Button
              variant={viewMode === 'analytics' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('analytics')}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Button>
          </div>
        </div>

        {viewMode === 'board' && (
          <>
            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-input"
                    placeholder="Search players, teams, or NBA teams..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="">All Teams</option>
                  {teams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>

                <select
                  value={selectedPosition}
                  onChange={(e) => setSelectedPosition(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="">All Positions</option>
                  <option value="PG">PG</option>
                  <option value="SG">SG</option>
                  <option value="SF">SF</option>
                  <option value="PF">PF</option>
                  <option value="C">C</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="overall">Sort by Pick</option>
                  <option value="team">Sort by Team</option>
                  <option value="value">Sort by Value</option>
                </select>

                {(searchQuery || selectedTeam || selectedPosition) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="flex items-center gap-1"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Filter Summary */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredPicks.length} of {picks.length} picks
              {searchQuery && ` • Searching "${searchQuery}"`}
              {selectedTeam && ` • Team: ${selectedTeam}`}
              {selectedPosition && ` • Position: ${selectedPosition}`}
            </div>
          </>
        )}
      </div>

      {/* Content Area */}
      {viewMode === 'board' ? (
        <div className="overflow-x-auto">
          {Array.from({ length: rounds }, (_, roundIndex) => {
            const round = roundIndex + 1;
            const isEvenRound = round % 2 === 0;
            const roundPicks = filteredPicks.filter(p => p.round === round);

            if (roundPicks.length === 0) return null;

            return (
              <div key={round} className="mb-6">
                <h3 className="text-xl font-bold mb-4 text-white">Round {round}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 px-2">
                  {Array.from({ length: teamsCount }, (_, positionIndex) => {
                    const position = isEvenRound ? teamsCount - positionIndex : positionIndex + 1;
                    const pick = getPickByRoundAndPosition(round, position);

                    if (!pick) return <div key={`${round}-${position}`} className="h-[150px]" />; // Placeholder for empty slots

                    const isCurrentPick = pick.overallPick === currentPick;
                    const isPicked = !!pick.player;
                    const isExpanded = expandedCards.has(pick.overallPick);
                    const teamPalette = getTeamColorPalette(pick.team, teams);
                    const playerValue = getPlayerValueScore(pick.player);
                    const playerTrend = getPlayerTrend(pick.player);

                return (
                  <Card
                    key={`${round}-${position}`}
                    className={cn(
                      "relative overflow-hidden transition-all duration-300 border-2 cursor-pointer",
                      "hover:scale-[1.02] hover:shadow-xl",
                      isCurrentPick && "ring-4 ring-draft-active ring-offset-2 animate-pulse-glow shadow-2xl border-draft-active",
                      isPicked && "border-white/30 shadow-lg bg-gradient-to-br from-blue-900/90 via-purple-900/90 to-indigo-900/90",
                      !isPicked && !isCurrentPick && "bg-draft-available hover:shadow-lg border-white/20 hover:border-white/40"
                    )}
                    style={isPicked ? {
                      background: `linear-gradient(135deg, ${teamPalette.primary}dd, ${teamPalette.secondary}dd)`,
                      backgroundSize: '200% 200%',
                      animation: 'gradient-shift 3s ease infinite'
                    } : {}}
                    onMouseEnter={(e) => {
                      setHoveredPick(pick.overallPick);
                      if (!isPicked && !isCurrentPick) {
                        e.currentTarget.style.borderColor = teamPalette.primary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      setHoveredPick(null);
                      if (!isPicked && !isCurrentPick) {
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                    onClick={() => isPicked && toggleCardExpansion(pick.overallPick)}
                  >
                    {/* Enhanced Header */}
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className={cn(
                          "text-sm font-normal flex items-center gap-2",
                          isPicked ? "text-white font-bold drop-shadow-lg" : "text-white/90"
                        )}>
                          <span className="font-mono font-bold text-white">{pick.overallPick}.</span>
                          <span className="text-white/90">{pick.team}</span>
                        </CardTitle>

                        {/* Status Indicators */}
                        <div className="flex items-center gap-1">
                          {isPicked && pick.player?.isRookie && (
                            <Badge variant="default" className="text-xs px-1 py-0 bg-green-600 text-white">
                              R
                            </Badge>
                          )}
                          {isPicked && pick.player?.isKeeper && (
                            <Shield className="h-3 w-3 text-yellow-400" />
                          )}
                          {isPicked && playerTrend === 'trending-up' && (
                            <TrendingUp className="h-3 w-3 text-green-400" />
                          )}
                          {isPicked && pick.player?.rank && (
                            <div className="flex items-center gap-1">
                              <Target className="h-3 w-3 text-orange-400" />
                              <span className="text-xs font-bold text-orange-400">#{pick.player.rank}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-3 pt-0">
                      {isPicked && pick.player ? (
                        <div className="space-y-3">
                          {/* Player Name and Position */}
                          <div className="flex items-center justify-between">
                            <h3 className={cn(
                              "font-bold text-base hover:underline cursor-pointer",
                              "text-white drop-shadow-lg"
                            )}>
                              {pick.player.name}
                            </h3>
                            {playerValue > 0 && (
                              <div className="text-xs font-mono font-bold bg-white/20 text-white px-2 py-1 rounded backdrop-blur-sm">
                                {playerValue.toFixed(1)}
                              </div>
                            )}
                          </div>

                          {/* Team and Position Badge */}
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              variant="secondary"
                              className="text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 border-0"
                            >
                              {pick.player.position}
                            </Badge>
                            <span className="text-xs text-white/90 font-medium">
                              {pick.player.nbaTeam}
                            </span>
                          </div>

                          {/* Quick Stats */}
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {pick.player.points !== undefined && (
                              <div className="text-center">
                                <div className="font-bold">{pick.player.points.toFixed(1)}</div>
                                <div className="opacity-70">PPG</div>
                              </div>
                            )}
                            {pick.player.rebounds !== undefined && (
                              <div className="text-center">
                                <div className="font-bold">{pick.player.rebounds.toFixed(1)}</div>
                                <div className="opacity-70">RPG</div>
                              </div>
                            )}
                            {pick.player.assists !== undefined && (
                              <div className="text-center">
                                <div className="font-bold">{pick.player.assists.toFixed(1)}</div>
                                <div className="opacity-70">APG</div>
                              </div>
                            )}
                          </div>

                          {/* Expandable Detailed Stats */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-white/30 space-y-2 text-white/90">
                              {/* Advanced Stats */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {pick.player.blocks !== undefined && (
                                  <div className="flex justify-between">
                                    <span>BLK:</span>
                                    <span className="font-mono">{pick.player.blocks.toFixed(1)}</span>
                                  </div>
                                )}
                                {pick.player.steals !== undefined && (
                                  <div className="flex justify-between">
                                    <span>STL:</span>
                                    <span className="font-mono">{pick.player.steals.toFixed(1)}</span>
                                  </div>
                                )}
                                {pick.player.fieldGoalPercentage !== undefined && (
                                  <div className="flex justify-between">
                                    <span>FG%:</span>
                                    <span className="font-mono">{pick.player.fieldGoalPercentage.toFixed(1)}%</span>
                                  </div>
                                )}
                                {pick.player.threePointPercentage !== undefined && (
                                  <div className="flex justify-between">
                                    <span>3P%:</span>
                                    <span className="font-mono">{pick.player.threePointPercentage.toFixed(1)}%</span>
                                  </div>
                                )}
                                {pick.player.freeThrowPercentage !== undefined && (
                                  <div className="flex justify-between">
                                    <span>FT%:</span>
                                    <span className="font-mono">{pick.player.freeThrowPercentage.toFixed(1)}%</span>
                                  </div>
                                )}
                                {pick.player.minutesPerGame !== undefined && (
                                  <div className="flex justify-between">
                                    <span>MPG:</span>
                                    <span className="font-mono">{pick.player.minutesPerGame.toFixed(1)}</span>
                                  </div>
                                )}
                              </div>

                              {/* Performance Indicator */}
                              {pick.player.gamesPlayed !== undefined && (
                                <div className="flex justify-between items-center text-xs">
                                  <span>Games:</span>
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono">{pick.player.gamesPlayed}</span>
                                    <Activity className={cn(
                                      "h-3 w-3",
                                      pick.player.gamesPlayed > 50 ? "text-green-400" : "text-yellow-400"
                                    )} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Expand/Collapse Indicator */}
                          <div className="text-xs text-center mt-2 text-white/70">
                            {isExpanded ? "Click to collapse" : "Click for more stats"}
                          </div>
                        </div>
                      ) : (
                        <div className={cn(
                          "text-center text-sm font-medium py-4",
                          isCurrentPick ? "text-white" : "text-muted-foreground"
                        )}>
                          {isCurrentPick ? (
                            <div className="space-y-1">
                              <div className="text-lg font-bold text-white drop-shadow-lg animate-pulse">ON THE CLOCK</div>
                              <div className="text-xs text-white/80">Waiting for selection</div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div>Available</div>
                              <div className="text-xs opacity-75">Round {pick.round}, Pick {pick.pick}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>

                    {/* Hover Effect Overlay */}
                    {hoveredPick === pick.overallPick && isPicked && !isExpanded && (
                      <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <div className="bg-white/90 text-black text-xs px-2 py-1 rounded">
                          Click for details
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <DraftBoardAnalytics
      picks={picks}
      teams={teams}
      currentPick={currentPick}
    />
  )}
</div>
  );
}
