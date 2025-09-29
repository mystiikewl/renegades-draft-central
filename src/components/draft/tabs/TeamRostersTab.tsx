import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { TeamRoster } from '@/components/TeamRoster';
import type { Tables } from '@/integrations/supabase/types';

interface DraftStats {
  totalPicks: number;
  completedPicks: number;
  availablePlayers: number;
  progress: number;
}

interface TeamRostersTabProps {
  teams: string[];
  selectedTeam: string;
  onSelectedTeamChange: (teamName: string) => void;
  selectedTeamId: string;
  currentSeason: string;
  draftStats: DraftStats;
  isMobile: boolean;
}

const TeamSelection: React.FC<{
  teams: string[];
  selectedTeam: string;
  onSelectedTeamChange: (teamName: string) => void;
  isMobile: boolean;
}> = ({ teams, selectedTeam, onSelectedTeamChange, isMobile }) => {
  if (isMobile) {
    return (
      <div className="grid gap-4 mb-6">
        <div className="flex overflow-x-auto pb-2 -mx-2 px-2">
          <ToggleGroup
            type="single"
            value={selectedTeam}
            onValueChange={(value) => value && onSelectedTeamChange(value)}
            className="flex gap-2 min-w-max"
          >
            {teams.map((team) => (
              <ToggleGroupItem
                key={team}
                value={team}
                aria-label={`Select ${team}`}
                className="text-sm sm:text-base px-3 py-2 whitespace-nowrap"
              >
                {team}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 mb-6">
      <div className="flex overflow-x-auto pb-2 -mx-2 px-2">
        <ToggleGroup
          type="single"
          value={selectedTeam}
          onValueChange={(value) => value && onSelectedTeamChange(value)}
          className="flex gap-2 min-w-max"
        >
          {teams.map((team) => (
            <ToggleGroupItem
              key={team}
              value={team}
              aria-label={`Select ${team}`}
              className="text-sm sm:text-base px-3 py-2 whitespace-nowrap"
            >
              {team}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
};

const DraftCompleteHeader: React.FC<{
  draftStats: DraftStats;
  isMobile: boolean;
}> = ({ draftStats, isMobile }) => {
  if (!(draftStats.totalPicks > 0 && draftStats.completedPicks >= draftStats.totalPicks)) {
    return null;
  }

  if (isMobile) {
    return (
      <div className="text-center py-4">
        <Badge variant="default" className="bg-green-600 text-white">
          Draft Complete - All {draftStats.totalPicks} picks made
        </Badge>
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      <Badge variant="default" className="bg-green-600 text-white">
        Draft Complete - All {draftStats.totalPicks} picks made
      </Badge>
    </div>
  );
};

export const TeamRostersTab: React.FC<TeamRostersTabProps> = ({
  teams,
  selectedTeam,
  onSelectedTeamChange,
  selectedTeamId,
  currentSeason,
  draftStats,
  isMobile
}) => {
  return (
    <div className="space-y-6">
      <DraftCompleteHeader
        draftStats={draftStats}
        isMobile={isMobile}
      />

      <TeamSelection
        teams={teams}
        selectedTeam={selectedTeam}
        onSelectedTeamChange={onSelectedTeamChange}
        isMobile={isMobile}
      />

      <TeamRoster
        teamName={selectedTeam}
        teamId={selectedTeamId}
        season={currentSeason}
      />
    </div>
  );
};