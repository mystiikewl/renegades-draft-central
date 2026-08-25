import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LayoutGrid, ListOrdered, Wifi, WifiOff } from 'lucide-react';
import { DraftBoard } from '@/components/DraftBoard';
import { DraftTimeline } from '@/components/DraftTimeline';
import { useDraftTabService } from '@/hooks/useDraftTabService';
import { ConnectionStatus } from '@/hooks/useRealTimeDraftTabs';

interface DraftPickFormatted {
  round: number;
  pick: number;
  overallPick: number;
  team: string;
  player: {
    id: string;
    name: string;
    position: string;
    nbaTeam: string;
  } | undefined;
}

interface DraftStats {
  totalPicks: number;
  completedPicks: number;
  availablePlayers: number;
  progress: number;
}

interface DraftBoardTabProps {
  draftPicksFormatted: DraftPickFormatted[];
  teams: string[];
  currentPickIndex: number;
  draftView: 'board' | 'timeline';
  onDraftViewChange: (view: 'board' | 'timeline') => void;
  draftStats: DraftStats;
  isMobile: boolean;
  connectionStatus?: ConnectionStatus;
}

const DraftBoardTabHeader: React.FC<{
  draftView: 'board' | 'timeline';
  onDraftViewChange: (view: 'board' | 'timeline') => void;
  isMobile: boolean;
  connectionStatus?: ConnectionStatus;
}> = ({ draftView, onDraftViewChange, isMobile, connectionStatus }) => {
  if (isMobile) {
    return (
      <div className="space-y-4">


        {/* Header with View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-xl md:text-2xl font-bold font-montserrat">
            {draftView === 'board' ? 'Draft Board' : 'Draft History Timeline'}
          </h3>
          <ToggleGroup
            type="single"
            value={draftView}
            onValueChange={(value: 'board' | 'timeline') => value && onDraftViewChange(value)}
            className="bg-card p-1 rounded-lg shadow-sm w-full sm:w-auto"
          >
            <ToggleGroupItem value="board" aria-label="Toggle grid view" className="px-3 py-2 text-sm flex-1">
              <LayoutGrid className="h-4 w-4 mr-2" /> Grid
            </ToggleGroupItem>
            <ToggleGroupItem value="timeline" aria-label="Toggle timeline view" className="px-3 py-2 text-sm flex-1">
              <ListOrdered className="h-4 w-4 mr-2" /> Timeline
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* View Toggle */}
      <div className="flex justify-end items-center mb-4">
        <ToggleGroup
          type="single"
          value={draftView}
          onValueChange={(value: 'board' | 'timeline') => value && onDraftViewChange(value)}
          className="bg-card p-1 rounded-lg shadow-sm"
        >
          <ToggleGroupItem value="board" aria-label="Toggle grid view" className="px-3 py-2 text-sm">
            <LayoutGrid className="h-4 w-4 mr-2" /> Grid View
          </ToggleGroupItem>
          <ToggleGroupItem value="timeline" aria-label="Toggle timeline view" className="px-3 py-2 text-sm">
            <ListOrdered className="h-4 w-4 mr-2" /> Timeline View
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <h3 className="text-xl md:text-2xl font-bold font-montserrat">
          {draftView === 'board' ? 'Draft Board' : 'Draft History Timeline'}
        </h3>
      </div>
    </>
  );
};

const DraftBoardTabContent: React.FC<{
  draftPicksFormatted: DraftPickFormatted[];
  teams: string[];
  currentPickIndex: number;
  draftView: 'board' | 'timeline';
  draftStats: DraftStats;
}> = ({ draftPicksFormatted, teams, currentPickIndex, draftView, draftStats }) => {
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
            View the completed draft board below.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {draftView === 'board' ? (
        <DraftBoard
          picks={draftPicksFormatted}
          teams={teams}
          currentPick={currentPickIndex + 1}
        />
      ) : (
        <DraftTimeline
          picks={draftPicksFormatted}
          teams={teams}
          currentPick={currentPickIndex + 1}
        />
      )}
    </div>
  );
};

export const DraftBoardTab: React.FC<DraftBoardTabProps> = ({
  draftPicksFormatted,
  teams,
  currentPickIndex,
  draftView,
  onDraftViewChange,
  draftStats,
  isMobile,
  connectionStatus
}) => {
  return (
    <div className="space-y-6">
      <DraftBoardTabHeader
        draftView={draftView}
        onDraftViewChange={onDraftViewChange}
        isMobile={isMobile}
        connectionStatus={connectionStatus}
      />

      <DraftBoardTabContent
        draftPicksFormatted={draftPicksFormatted}
        teams={teams}
        currentPickIndex={currentPickIndex}
        draftView={draftView}
        draftStats={draftStats}
      />
    </div>
  );
};
