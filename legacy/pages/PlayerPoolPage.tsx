import React, { useState } from 'react';
import { PlayerPool } from '@/components/PlayerPool';
import { useRealTimePlayers } from '@/hooks/useRealTimePlayers';
import { useDraftStatus } from '@/hooks/useDraftStatus';
import { makeDraftPick } from '@/hooks/makeDraftPick';
import { useQueryClient } from '@tanstack/react-query';
import { useDraftPageData } from '@/hooks/useDraftPageData';
import MainLayout from '@/components/layouts/MainLayout';
import type { Tables } from '@/integrations/supabase/types';
import type { PlayerWithKeeperInfo } from '@/integrations/supabase/services/players';

type Player = Tables<'players'> & PlayerWithKeeperInfo;

const PlayerPoolPage: React.FC = () => {
  const { draftStats, currentPick, teamsData, canMakePick } = useDraftPageData();
  const teams = teamsData.map(team => team.name);
  const playersQuery = useRealTimePlayers();
  const players = playersQuery.data || [];
  const statusProps = { draftStats, currentPick, teams, canMakePick };
  const { isOnClock } = useDraftStatus(statusProps);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const queryClient = useQueryClient();

  const handleSelectPlayer = async (player: Player) => {
    if (!canMakePick || !isOnClock) return;
    try {
      await makeDraftPick(player.id);
      setSelectedPlayer(null);
      queryClient.invalidateQueries({ queryKey: ['players'] });
    } catch (error) {
      console.error('Failed to make draft pick:', error);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Player Pool</h1>
        <PlayerPool
          players={players}
          onSelectPlayer={handleSelectPlayer}
          selectedPlayer={selectedPlayer}
          canMakePick={canMakePick && isOnClock}
        />
      </div>
    </MainLayout>
  );
};

export default PlayerPoolPage;