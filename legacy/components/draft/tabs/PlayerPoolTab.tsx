import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PlayerPool } from '@/components/PlayerPool';
import { useDraftStatus } from '@/hooks/useDraftStatus';
import type { Player as PlayerType } from '@/components/player-pool/PlayerCard';
import type { DraftPickWithRelations } from '@/integrations/supabase/types/draftPicks';

interface DraftStats {
  totalPicks: number;
  completedPicks: number;
  availablePlayers: number;
  progress: number;
}

interface PlayerPoolTabProps {
  players: PlayerType[];
  onSelectPlayer: (player: PlayerType) => void;
  selectedPlayer: PlayerType | null;
  canMakePick: boolean;
  currentPick: DraftPickWithRelations | null;
  teams: string[];
  draftStats: DraftStats;
  isMobile: boolean;
}

const PlayerPoolHeader: React.FC<{
  canMakePick: boolean;
  currentPick: DraftPickWithRelations | null;
  teams: string[];
}> = ({ canMakePick, currentPick, teams }) => {
  if (!canMakePick || !currentPick) return null;

  const { teamPalette } = useDraftStatus({
    draftStats: { totalPicks: 0, completedPicks: 0, availablePlayers: 0, progress: 0 },
    currentPick,
    teams,
    canMakePick
  });

  if (!teamPalette) return null;

  return (
    <div className="flex flex-col md:flex-row items-center justify-between mb-4 text-center md:text-left gap-2">
      <h3 className="text-xl md:text-2xl font-bold font-montserrat">Available Players</h3>
      <Badge
        variant="outline"
        className="text-base py-2 px-4 animate-pulse"
        style={{
          backgroundColor: `${teamPalette.primary}20`,
          borderColor: teamPalette.primary,
          color: teamPalette.text,
          textShadow: `0 0 5px ${teamPalette.accent}60`
        }}
      >
        Making pick for {currentPick.current_team.name}
      </Badge>
    </div>
  );
};

const PlayerPoolContent: React.FC<{
  players: PlayerType[];
  onSelectPlayer: (player: PlayerType) => void;
  selectedPlayer: PlayerType | null;
  canMakePick: boolean;
  draftStats: DraftStats;
}> = ({ players, onSelectPlayer, selectedPlayer, canMakePick, draftStats }) => {
  const isDraftComplete = draftStats.totalPicks > 0 && draftStats.completedPicks >= draftStats.totalPicks;

  if (isDraftComplete) {
    return (
      <div className="text-center py-12">
        <div className="bg-card p-8 rounded-lg shadow-lg max-w-md mx-auto">
          <h3 className="text-2xl font-bold text-green-500 mb-2">Draft Complete!</h3>
          <p className="text-muted-foreground mb-4">
            All {draftStats.totalPicks} picks have been made. The fantasy draft is now complete.
          </p>
          <p className="text-sm text-muted-foreground">
            You can still view team rosters and analyze the draft results.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PlayerPool
      players={players}
      onSelectPlayer={onSelectPlayer}
      selectedPlayer={selectedPlayer}
      canMakePick={canMakePick}
    />
  );
};

export const PlayerPoolTab: React.FC<PlayerPoolTabProps> = ({
  players,
  onSelectPlayer,
  selectedPlayer,
  canMakePick,
  currentPick,
  teams,
  draftStats,
  isMobile
}) => {
  return (
    <div className="space-y-6">
      <div className="p-6">
        <PlayerPoolHeader
          canMakePick={canMakePick}
          currentPick={currentPick}
          teams={teams}
        />

        <PlayerPoolContent
          players={players}
          onSelectPlayer={onSelectPlayer}
          selectedPlayer={selectedPlayer}
          canMakePick={canMakePick}
          draftStats={draftStats}
        />
      </div>
    </div>
  );
};