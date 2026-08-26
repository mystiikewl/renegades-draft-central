import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import DraftHero from '@/components/draft/DraftHero';
import DraftTabs from '@/components/draft/DraftTabs';
import DraftStatsBar from '@/components/draft/DraftStatsBar'; // Import DraftStatsBar
import { useDraftPageData } from '@/hooks/useDraftPageData';
import type { Player as PlayerType } from '@/components/player-pool/PlayerCard'; // Import PlayerType for local use

export default function Draft() {
  const {
    profile,
    players, // Use the processed 'players' data
    teamsData,
    currentPickIndex,
    totalPicks,
    completedPicks,
    draftPicks,
    isDraftComplete,
    currentTeamId,
    draftSettings,
    isLoadingDraftState,
    currentPick,
    progress,
    activeTeams,
    connectionStatus,
    selectedPlayer,
    setSelectedPlayer,
    selectedTeam,
    setSelectedTeam,
    isMakingPick,
    setIsMakingPick,
    activeTab,
    setActiveTab,
    draftView,
    setDraftView,
    isMobile,
    navigate,
    canMakePick,
    handleSelectPlayer,
    handleConfirmPick,
    getDraftedPlayersForTeam,
    draftStats,
    selectedTeamId,
    currentSeason,
    isLoading,
  } = useDraftPageData();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background font-poppins">
        <div className="container mx-auto px-4 py-6 md:py-8">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between text-center md:text-left mb-4">
              <div className="mb-4 md:mb-0">
                <Skeleton className="h-8 w-64 mb-2" />
                <Skeleton className="h-6 w-48" />
              </div>
              <div className="text-right">
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-6 w-48" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-6 w-24 mx-auto mb-1" />
                  <Skeleton className="h-8 w-16 mx-auto" />
                </div>
              ))}
            </div>
            {isMobile ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="grid w-full grid-cols-3 gap-2">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            )}
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // The 'players' variable from useDraftPageData is already processed
  // const players = playersData.map(player => ({
  //   ...player,
  //   isDrafted: player.is_drafted || player.is_keeper || false,
  //   is_keeper: player.is_keeper || false, // Ensure is_keeper is explicitly passed
  // }));

  const teams = teamsData.map(team => team.name);

  const draftPicksFormatted = draftPicks.map((pick, index) => ({
    round: pick.round,
    pick: pick.pick_number,
    overallPick: index + 1,
    team: pick.current_team?.name || 'Unknown',
    player: pick.player ? {
      id: pick.player.id,
      name: pick.player.name,
      position: pick.player.position,
      nbaTeam: pick.player.nba_team,
    } : undefined,
  }));

  return (
    <div className="min-h-screen bg-background font-poppins">
      <DraftHero
        activeTeams={activeTeams.map(t => ({ teamId: t.teamId, teamName: t.teamName }))}
        connectionStatus={connectionStatus}
        currentPickIndex={currentPickIndex}
        currentPick={currentPick}
        draftStats={draftStats}
        teams={teams}
      />

      {/* Enhanced spacing and visual separation */}
      <div className="relative">
        {/* Subtle section divider */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>

        <DraftStatsBar
          draftStats={draftStats}
          teams={teams}
          currentTeam={currentPick?.current_team?.name}
        />

        {/* Bottom section divider */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
      </div>

      {/* Improved container spacing and layout */}
      <div className="container mx-auto px-4 py-8 md:py-12 lg:px-6 xl:px-8">
        <div className="space-y-8">
          <DraftTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isMobile={isMobile}
            navigate={navigate}
            canMakePick={canMakePick}
            currentPick={currentPick}
            players={players}
            onSelectPlayer={handleSelectPlayer}
            selectedPlayer={selectedPlayer}
            draftPicksFormatted={draftPicksFormatted}
            teams={teams}
            currentPickIndex={currentPickIndex}
            draftView={draftView}
            setDraftView={setDraftView}
            selectedTeam={selectedTeam}
            setSelectedTeam={setSelectedTeam}
            selectedTeamId={selectedTeamId}
            currentSeason={currentSeason}
            getDraftedPlayersForTeam={getDraftedPlayersForTeam}
            draftStats={draftStats}
          />
        </div>
      </div>
    </div>
  );
}
