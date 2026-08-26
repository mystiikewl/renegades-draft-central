import React from 'react';
import { RealTimeStatus } from '@/components/RealTimeStatus';
import { ConnectionStatus } from '@/hooks/useTeamPresence'; // Import ConnectionStatus type
import { DraftPickWithRelations } from '@/integrations/supabase/types/draftPicks'; // Import the proper type
import { getTeamColorPalette } from '@/lib/teams'; // Import team color utilities

interface DraftHeroProps {
  activeTeams: { teamId: string; teamName: string }[];
  connectionStatus: ConnectionStatus; // Use the imported ConnectionStatus type
  currentPickIndex: number;
  currentPick: DraftPickWithRelations | null; // Use the proper type instead of any
  draftStats: {
    totalPicks: number;
    completedPicks: number;
    availablePlayers: number;
    progress: number;
  };
  teams: string[]; // Add teams array for color mapping
}

const DraftHero: React.FC<DraftHeroProps> = ({
  activeTeams,
  connectionStatus,
  currentPickIndex,
  currentPick,
  draftStats,
  teams,
}) => {
  const isDraftComplete = draftStats.totalPicks > 0 && draftStats.completedPicks >= draftStats.totalPicks;

  // Get team colors for current team on the clock
  const currentTeamName = currentPick?.current_team?.name;
  const currentTeamPalette = currentTeamName ? getTeamColorPalette(currentTeamName, teams) : null;

  return (
    <div
      className="relative h-auto min-h-[180px] md:min-h-[220px] lg:min-h-[240px] overflow-hidden transition-all duration-500"
      style={{
        background: currentTeamPalette
          ? `linear-gradient(135deg, ${currentTeamPalette.primary}15, ${currentTeamPalette.secondary}10, hsl(var(--background)))`
          : 'var(--gradient-hero)',
        backgroundSize: '200% 200%',
        animation: currentTeamPalette ? 'gradient-shift 4s ease infinite' : undefined
      }}
    >
      <div className="absolute inset-0 bg-background/50 backdrop-blur-sm animate-shimmer"></div>
      <div className="relative z-10 text-primary-foreground py-6 px-4 md:px-6 lg:px-8 h-full flex flex-col">
        {/* Top Row: Buttons and Real-time Status */}
        <div className="flex flex-col sm:flex-row justify-between items-start md:items-center">
          <div className="hidden md:block w-1/3"></div>
          <div className="flex justify-center md:justify-start w-full md:w-1/3 mb-4 sm:mb-0">
            <RealTimeStatus
              activeTeams={activeTeams}
              connectionStatus={connectionStatus}
            />
          </div>
          <div className="flex flex-wrap justify-center sm:justify-end gap-2 w-full md:w-1/3"></div>
        </div>

        {/* Main Title and Pick Info */}
        <div className="flex flex-col md:flex-row items-center justify-between text-center md:text-left flex-grow container mx-auto">
          <div className="mb-6 md:mb-0 text-shadow-lg">
            <h1 className="text-4xl md:text-6xl font-extrabold mb-2 font-montserrat leading-tight">
              Renegades NBA Fantasy <span className="block text-2xl md:text-4xl font-bold text-primary-foreground/90">2025-26</span>
            </h1>
            <p className="text-primary-foreground/80 text-lg md:text-xl">Draft Central</p>
          </div>
          
          {isDraftComplete ? (
            <div className="flex flex-col items-center md:items-end space-y-3">
              <div className="text-4xl md:text-6xl font-extrabold font-montserrat text-green-400 bg-black/30 px-6 py-3 rounded-lg shadow-lg">
                Draft Complete!
              </div>
              <div className="text-primary-foreground text-xl md:text-2xl font-semibold text-shadow-md">
                All {draftStats.totalPicks} picks have been made
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center md:items-end space-y-3">
              <div
                className="text-5xl md:text-7xl font-extrabold font-montserrat animate-pulse px-4 py-2 rounded-lg shadow-lg"
                style={{
                  color: currentTeamPalette ? currentTeamPalette.primary : 'hsl(var(--primary-glow))',
                  background: currentTeamPalette ? `${currentTeamPalette.background}80` : 'rgba(0, 0, 0, 0.3)',
                  textShadow: currentTeamPalette ? `0 0 20px ${currentTeamPalette.accent}80` : undefined,
                  animation: 'pulse-glow-team 2s ease-in-out infinite alternate'
                }}
              >
                Pick #{currentPickIndex + 1}
              </div>
              {currentPick && (
              <div
                className="text-xl md:text-2xl font-semibold text-shadow-md"
                style={{
                  color: '#FFFFFF',
                }}
              >
                  <span className="inline-flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full animate-pulse"
                      style={{
                        backgroundColor: currentTeamPalette?.primary || 'hsl(var(--primary))',
                        boxShadow: `0 0 10px ${currentTeamPalette?.accent || 'hsl(var(--primary-glow))'}`
                      }}
                    />
                    {currentPick.current_team.name} on the clock
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DraftHero;
