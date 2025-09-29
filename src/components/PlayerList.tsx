import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getTeamColorPalette } from '@/lib/teams';
import {
  Star,
  Shield,
  Target,
  Activity,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface PlayerListProps {
  filteredPicks: any[];
  teams: string[];
  currentPick: number;
  getPlayerValueScore: (player: any) => number;
  getPlayerTrend: (player: any) => string;
  expandedCards: Set<number>;
  onToggleExpansion: (pickNumber: number) => void;
  hoveredPick: number | null;
  setHoveredPick: (hovered: number | null) => void;
}

export function PlayerList({
  filteredPicks,
  teams,
  currentPick,
  getPlayerValueScore,
  getPlayerTrend,
  expandedCards,
  onToggleExpansion,
  hoveredPick,
  setHoveredPick,
}: PlayerListProps) {
  const rounds = Math.max(...filteredPicks.map(p => p.round));
  const teamsCount = teams.length;

  return (
    <div className="overflow-x-auto">
      {Array.from({ length: rounds }, (_, roundIndex) => {
        const round = roundIndex + 1;
        const roundPicks = filteredPicks.filter(p => p.round === round);

        return (
          <div key={round} className="mb-6">
            <h3 className="text-xl font-bold mb-4 text-white">Round {round}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 px-2">
              {Array.from({ length: teamsCount }, (_, positionIndex) => {
                const pick = roundPicks[positionIndex];
                if (!pick) return null;

                const isCurrentPick = pick.overallPick === currentPick;
                const isPicked = !!pick.player;
                const isExpanded = expandedCards.has(pick.overallPick);
                const teamPalette = getTeamColorPalette(pick.team, teams);

                return (
                  <Card
                    key={`${round}-${positionIndex}`}
                    className={cn(
                      "relative overflow-hidden transition-all duration-300 border-2 cursor-pointer",
                      isCurrentPick && "ring-4 ring-draft-active ring-offset-2 animate-pulse",
                      isPicked && "bg-gradient-to-br from-blue-900/90 via-purple-900/90 to-indigo-900/90",
                      !isPicked && "bg-draft-available hover:shadow-lg border-white/20 hover:border-white/40"
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
                    onClick={() => isPicked && onToggleExpansion(pick.overallPick)}
                  >
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-400" />
                            <span className="text-xs font-bold text-yellow-400">#{pick.overallPick}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-blue-400">#{pick.position}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-orange-400">#{pick.playerId}</span>
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-white truncate">{pick.player?.name || 'Available'}</h4>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">PTS</span>
                          <span className="font-bold text-white">{pick.player?.points || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">REB</span>
                          <span className="font-bold text-white">{pick.player?.rebounds || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">AST</span>
                          <span className="font-bold text-white">{pick.player?.assists || 0}</span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">BLK</span>
                            <span className="text-white">{pick.player?.blocks || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">STL</span>
                            <span className="text-white">{pick.player?.steals || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">TO</span>
                            <span className="text-white">{pick.player?.turnovers || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">FG%</span>
                            <span className="text-white">{pick.player?.fgPercentage || 0}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Value</span>
                            <span className="text-green-400 font-bold">{getPlayerValueScore(pick.player)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Trend</span>
                            <span className={cn("font-bold", getPlayerTrend(pick.player) === 'up' ? "text-green-400" : "text-red-400")}>
                              {getPlayerTrend(pick.player) === 'up' ? "↑" : "↓"}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}