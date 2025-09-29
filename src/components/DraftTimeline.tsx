import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getTeamColorPalette } from '@/lib/teams';

interface DraftPick {
  round: number;
  pick: number;
  overallPick: number;
  team: string;
  player?: {
    name: string;
    position: string;
    nbaTeam: string;
    points?: number;
    rebounds?: number;
    assists?: number;
  };
  isActive?: boolean;
}

interface DraftTimelineProps {
  picks: DraftPick[];
  teams: string[];
  currentPick: number;
}

export function DraftTimeline({ picks, teams, currentPick }: DraftTimelineProps) {
  // Sort picks chronologically by overallPick
  const sortedPicks = [...picks].sort((a, b) => a.overallPick - b.overallPick);

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <h2 className="text-2xl font-bold mb-6 text-center">Draft History Timeline</h2>
      <div className="relative">
        {/* Vertical line for the timeline */}
        <div className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-gray-300 h-full"></div>

        {sortedPicks.map((pick, index) => {
          const isCurrentPick = pick.overallPick === currentPick;
          const isPicked = !!pick.player;
          const teamPalette = getTeamColorPalette(pick.team, teams);

          // Alternate left/right for visual appeal
          const isEven = index % 2 === 0;

          return (
            <div
              key={pick.overallPick}
              className={cn(
                "mb-8 flex items-center w-full",
                isEven ? "justify-start" : "justify-end"
              )}
            >
              <div className={cn(
                "w-1/2 p-4",
                isEven ? "pr-8 text-right" : "pl-8 text-left"
              )}>
                <Card
                  className={cn(
                    "relative overflow-hidden transition-all duration-300 border-2 border-transparent",
                    isCurrentPick && "ring-4 ring-draft-active ring-offset-2 animate-pulse-glow",
                    isPicked && "border-0", // Remove default border
                    !isPicked && !isCurrentPick && "bg-draft-available hover:shadow-lg"
                  )}
                  style={isPicked ? {
                    background: `linear-gradient(135deg, ${teamPalette.primary}, ${teamPalette.secondary})`,
                    color: teamPalette.text
                  } : {}}
                  onMouseEnter={(e) => {
                    if (!isPicked && !isCurrentPick) {
                      e.currentTarget.style.borderColor = teamPalette.primary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isPicked && !isCurrentPick) {
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                >
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className={cn(
                      "text-sm font-normal",
                      isPicked ? "text-white/90" : "text-muted-foreground"
                    )}>
                      {pick.overallPick}. {pick.team} (Round {pick.round}, Pick {pick.pick})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {isPicked ? (
                      <div className="space-y-1">
                        <div className={cn(
                          "font-semibold text-base",
                          teamPalette.text === '#FFFFFF' ? "text-white" : "text-black"
                        )}>
                          {pick.player?.name}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge 
                            variant="secondary" 
                            className="text-xs"
                            style={{
                              backgroundColor: teamPalette.accent,
                              color: teamPalette.text === '#FFFFFF' ? '#001f3f' : '#FFFFFF'
                            }}
                          >
                            {pick.player?.position}
                          </Badge>
                          <span className={cn(
                            "text-xs opacity-80",
                            teamPalette.text === '#FFFFFF' ? "text-white/80" : "text-black/80"
                          )}>
                            {pick.player?.nbaTeam}
                          </span>
                        </div>
                        {/* Add more player stats here if needed */}
                      </div>
                    ) : (
                      <div className={cn(
                        "text-center text-sm font-medium",
                        isCurrentPick ? "text-draft-active-foreground" : "text-muted-foreground"
                      )}>
                        {isCurrentPick ? "ON THE CLOCK" : "Available"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              {/* Circle indicator on the timeline */}
              <div 
                className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full z-10"
                style={{ backgroundColor: isPicked ? teamPalette.primary : '#3b82f6' }}
              ></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
