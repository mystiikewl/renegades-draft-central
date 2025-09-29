import React from 'react';
import { Trophy, Users, Clock, Target } from 'lucide-react';
import { getTeamColorPalette } from '@/lib/teams';

interface DraftStatsBarProps {
  draftStats: {
    totalPicks: number;
    completedPicks: number;
    availablePlayers: number;
    progress: number;
  };
  currentTeam?: string;
  teams: string[];
}

const DraftStatsBar: React.FC<DraftStatsBarProps> = ({ draftStats, currentTeam, teams }) => {
  // Get team colors for the current team
  const teamPalette = currentTeam ? getTeamColorPalette(currentTeam, teams) : null;

  return (
    <div
      className="border-b border-border py-6 px-4 md:px-6 lg:px-8 transition-all duration-300"
      style={{
        background: teamPalette
          ? `linear-gradient(90deg, ${teamPalette.background}40, hsl(var(--card)), ${teamPalette.background}40)`
          : 'hsl(var(--card))',
      }}
    >
      <div className="container mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy
                className="h-5 w-5"
                style={{ color: teamPalette?.primary || 'hsl(var(--primary))' }}
              />
              <span className="text-base font-medium">Total Picks</span>
            </div>
            <div
              className="text-2xl font-bold font-montserrat"
              style={{ color: teamPalette?.primary || 'hsl(var(--foreground))' }}
            >
              {draftStats.totalPicks}
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Target
                className="h-5 w-5"
                style={{ color: teamPalette?.accent || 'hsl(var(--draft-picked))' }}
              />
              <span className="text-base font-medium">Completed</span>
            </div>
            <div
              className="text-2xl font-bold font-montserrat"
              style={{
                color: teamPalette?.accent || 'hsl(var(--draft-picked))',
                textShadow: teamPalette ? `0 0 10px ${teamPalette.accent}40` : undefined
              }}
            >
              {draftStats.completedPicks}
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users
                className="h-5 w-5"
                style={{ color: teamPalette?.secondary || 'hsl(var(--muted-foreground))' }}
              />
              <span className="text-base font-medium">Available</span>
            </div>
            <div
              className="text-2xl font-bold font-montserrat"
              style={{ color: teamPalette?.secondary || 'hsl(var(--foreground))' }}
            >
              {draftStats.availablePlayers}
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock
                className="h-5 w-5"
                style={{ color: teamPalette?.accent || 'hsl(var(--draft-active))' }}
              />
              <span className="text-base font-medium">Progress</span>
            </div>
            <div
              className="text-2xl font-bold font-montserrat relative"
              style={{
                color: teamPalette?.accent || 'hsl(var(--draft-active))',
                textShadow: teamPalette ? `0 0 10px ${teamPalette.accent}40` : undefined
              }}
            >
              {draftStats.progress}%
              {teamPalette && (
                <div
                  className="absolute inset-0 rounded-lg opacity-20 animate-pulse"
                  style={{
                    background: `linear-gradient(45deg, transparent, ${teamPalette.primary}30, transparent)`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftStatsBar;
