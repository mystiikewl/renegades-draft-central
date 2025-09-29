import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { DraftTabNavigation } from './navigation/DraftTabNavigation';
import { DraftStatusBanner } from './status/DraftStatusBanner';
import { DraftBoardTab } from './tabs/DraftBoardTab';
import { PlayerPoolTab } from './tabs/PlayerPoolTab';
import { FavouritesTab } from './tabs/FavouritesTab';
import { TeamRostersTab } from './tabs/TeamRostersTab';
import { useDraftTabState } from '@/hooks/useDraftTabState';
import { useDraftStatus } from '@/hooks/useDraftStatus';
import { useRealTimeDraftTabs } from '@/hooks/useRealTimeDraftTabs';
import { useDraftTabService } from '@/hooks/useDraftTabService';
import { DRAFT_TAB_CONFIG, type DraftTabValue } from '@/config/draftTabsConfig';
import type { Player as PlayerType } from '@/components/player-pool/PlayerCard';
import type { DraftPickWithRelations } from '@/integrations/supabase/types/draftPicks';

interface DraftedPlayer {
  round: number;
  pick: number;
  overallPick: number;
  nbaTeam: string;
}

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
  getDraftedPlayersForTeam: (teamName: string) => DraftedPlayer[];
  draftStats: DraftStats;
}

export const DraftTabs: React.FC<DraftTabsProps> = (props) => {
  // Define getInitialTab function
  function getInitialTab(): DraftTabValue {
    const hash = window.location.hash.replace('#', '');
    const validTabs = DRAFT_TAB_CONFIG.tabs.map(tab => tab.value);
    if (validTabs.includes(hash as DraftTabValue)) {
      return hash as DraftTabValue;
    }
    return 'board'; // default tab
  }

  // Check URL hash for initial tab selection
  const location = useLocation();

  // Destructure props to avoid dependency issues
  const { setActiveTab } = props;

  // Enhanced state management with custom hooks
  const tabState = useDraftTabState({
    initialTab: getInitialTab(),
    onTabChange: (tab: DraftTabValue) => {
      setActiveTab(tab);
      // Update URL hash for direct navigation
      window.location.hash = tab;
    }
  });

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    const validTabs = DRAFT_TAB_CONFIG.tabs.map(tab => tab.value);
    const tabHash = hash as DraftTabValue;
    if (validTabs.includes(tabHash) && setActiveTab && tabHash !== tabState.activeTab) {
      setActiveTab(tabHash);
    }
  }, [location.hash, setActiveTab, tabState.activeTab]);

  // Real-time data management (background service)
  const realtimeData = useRealTimeDraftTabs();

  // Enhanced status logic with real-time data
  const { currentTeam, teamPalette } = useDraftStatus({
    draftStats: props.draftStats,
    currentPick: props.currentPick,
    teams: props.teams,
    canMakePick: props.canMakePick
  });

  // Use prop data as primary source, enhanced with real-time status
  const currentDraftPicks = props.draftPicksFormatted;
  const currentPlayers = props.players;
  const currentTeams = props.teams;

  return (
    <Tabs value={tabState.activeTab} onValueChange={tabState.setActiveTab}>
      {/* Navigation Component with enhanced functionality */}
      <DraftTabNavigation
        tabs={DRAFT_TAB_CONFIG.tabs}
        activeTab={tabState.activeTab}
        onTabChange={tabState.setActiveTab}
        isMobile={props.isMobile}
        navigate={props.navigate}
        currentTeam={currentTeam}
        teams={props.teams}
      />

      {/* Enhanced Status Banner with connection status */}
      <DraftStatusBanner
        draftStats={props.draftStats}
        currentPick={props.currentPick}
        teams={props.teams}
        canMakePick={props.canMakePick}
        isMobile={props.isMobile}
        navigate={props.navigate}
        currentPickIndex={props.currentPickIndex}
      />



      {/* Tab Content Components with real-time enhancements */}
      <TabsContent value="board">
        <DraftBoardTab
          draftPicksFormatted={currentDraftPicks}
          teams={currentTeams}
          currentPickIndex={props.currentPickIndex}
          draftView={props.draftView}
          onDraftViewChange={props.setDraftView}
          draftStats={props.draftStats}
          isMobile={props.isMobile}
          connectionStatus={realtimeData.connectionStatus}
        />
      </TabsContent>

      <TabsContent value="players">
        <PlayerPoolTab
          players={currentPlayers}
          onSelectPlayer={props.onSelectPlayer}
          selectedPlayer={props.selectedPlayer}
          canMakePick={props.canMakePick}
          currentPick={props.currentPick}
          teams={currentTeams}
          draftStats={props.draftStats}
          isMobile={props.isMobile}
        />
      </TabsContent>

      <TabsContent value="favourites">
        <FavouritesTab
          canMakePick={props.canMakePick}
          draftStats={props.draftStats}
          isMobile={props.isMobile}
        />
      </TabsContent>

      <TabsContent value="teams">
        <TeamRostersTab
          teams={currentTeams}
          selectedTeam={props.selectedTeam}
          onSelectedTeamChange={props.setSelectedTeam}
          selectedTeamId={props.selectedTeamId}
          currentSeason={props.currentSeason}
          draftStats={props.draftStats}
          isMobile={props.isMobile}
        />
      </TabsContent>

      <TabsContent value="league-analysis">
        {/* League Analysis */}
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">League Analysis</h3>
          <p className="text-gray-600">
            Live data updates enabled. {realtimeData.draftPicks.length} picks, {realtimeData.players.length} players, {realtimeData.teams.length} teams synced.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default DraftTabs;
