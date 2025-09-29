import React from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { DraftTabNavigation } from './navigation/DraftTabNavigation';
import { DraftStatusBanner } from './status/DraftStatusBanner';
import { DraftBoardTab } from './tabs/DraftBoardTab';
import { PlayerPoolTab } from './tabs/PlayerPoolTab';
import { TeamRostersTab } from './tabs/TeamRostersTab';
import { useDraftTabState } from '@/hooks/useDraftTabState';
import { DRAFT_TAB_CONFIG } from '@/config/draftTabsConfig';
import type { Player as PlayerType } from '@/components/player-pool/PlayerCard';
import type { DraftPickWithRelations } from '@/integrations/supabase/types/draftPicks';

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

interface DraftTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobile: boolean;
  navigate: (path: string) => void;
  canMakePick: boolean;
  currentPick: DraftPickWithRelations | null;
  players: PlayerType[];
  onSelectPlayer: (player: PlayerType) => void;
  selectedPlayer: PlayerType | null;
  draftPicksFormatted: DraftPickFormatted[];
  teams: string[];
  currentPickIndex: number;
  draftView: 'board' | 'timeline';
  setDraftView: (view: 'board' | 'timeline') => void;
  selectedTeam: string;
  setSelectedTeam: (teamName: string) => void;
  selectedTeamId: string;
  currentSeason: string;
  getDraftedPlayersForTeam: (teamName: string) => (any & {
    round: number;
    pick: number;
    overallPick: number;
    nbaTeam: string;
  })[];
  draftStats: DraftStats;
}

export const DraftTabs: React.FC<DraftTabsProps> = (props) => {
  // Use custom hooks for state management
  const tabState = useDraftTabState({
    initialTab: props.activeTab as typeof DRAFT_TAB_CONFIG.tabs[number]['value'],
    onTabChange: props.setActiveTab
  });

  return (
    <Tabs value={tabState.activeTab} onValueChange={tabState.setActiveTab}>
      {/* Navigation Component */}
      <DraftTabNavigation
        tabs={DRAFT_TAB_CONFIG.tabs}
        activeTab={tabState.activeTab}
        onTabChange={tabState.setActiveTab}
        isMobile={props.isMobile}
        navigate={props.navigate}
      />

      {/* Status Banner Component */}
      <DraftStatusBanner
        draftStats={props.draftStats}
        currentPick={props.currentPick}
        teams={props.teams}
        canMakePick={props.canMakePick}
        isMobile={props.isMobile}
        navigate={props.navigate}
      />

      {/* Tab Content Components */}
      <TabsContent value="board">
        <DraftBoardTab
          draftPicksFormatted={props.draftPicksFormatted}
          teams={props.teams}
          currentPickIndex={props.currentPickIndex}
          draftView={props.draftView}
          onDraftViewChange={props.setDraftView}
          draftStats={props.draftStats}
          isMobile={props.isMobile}
        />
      </TabsContent>

      <TabsContent value="players">
        <PlayerPoolTab
          players={props.players}
          onSelectPlayer={props.onSelectPlayer}
          selectedPlayer={props.selectedPlayer}
          canMakePick={props.canMakePick}
          currentPick={props.currentPick}
          teams={props.teams}
          draftStats={props.draftStats}
          isMobile={props.isMobile}
        />
      </TabsContent>

      <TabsContent value="teams">
        <TeamRostersTab
          teams={props.teams}
          selectedTeam={props.selectedTeam}
          onSelectedTeamChange={props.setSelectedTeam}
          selectedTeamId={props.selectedTeamId}
          currentSeason={props.currentSeason}
          draftStats={props.draftStats}
          isMobile={props.isMobile}
        />
      </TabsContent>

      <TabsContent value="league-analysis">
        {/* League Analysis content would go here */}
        <div className="p-6">
          <h3 className="text-xl font-bold">League Analysis</h3>
          <p>Navigate to league analysis page...</p>
        </div>
      </TabsContent>
    </Tabs>
  );
};