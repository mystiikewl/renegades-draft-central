import { useState, useEffect, useMemo } from 'react';
import { useRealTimePlayers } from '@/hooks/useRealTimePlayers';
import type { Player as PlayerType } from '@/components/player-pool/PlayerCard';
import { useTeams } from '@/hooks/useTeams';
import { useDraftState, DraftSettings } from '@/hooks/useDraftState';
import { useTeamPresence, ConnectionStatus } from '@/hooks/useTeamPresence';
import { useTeamKeepers } from '@/hooks/useTeamKeepers';
import { makeDraftPick } from '@/hooks/makeDraftPick';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Database, Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { fetchProfileByUserId, fetchProfileById } from '@/integrations/supabase/services/profiles';
import { DraftPickWithRelations } from '@/integrations/supabase/types/draftPicks';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface DraftPageData {
  profile: Profile | null;
  players: PlayerType[];
  teamsData: { id: string; name: string }[];
  currentPickIndex: number;
  totalPicks: number;
  completedPicks: number;
  draftPicks: DraftPickWithRelations[];
  isDraftComplete: boolean;
  currentTeamId: string | null;
  draftSettings: DraftSettings;
  isLoadingDraftState: boolean;
  currentPick: DraftPickWithRelations | null;
  progress: number;
  activeTeams: { teamId: string; teamName: string }[];
  connectionStatus: ConnectionStatus;
  selectedPlayer: PlayerType | null;
  setSelectedPlayer: (player: PlayerType | null) => void;
  selectedTeam: string;
  setSelectedTeam: (teamName: string) => void;
  isMakingPick: boolean;
  setIsMakingPick: (isMaking: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  draftView: 'board' | 'timeline';
  setDraftView: (view: 'board' | 'timeline') => void;
  isMobile: boolean;
  navigate: (path: string) => void;
  canMakePick: boolean;
  handleSelectPlayer: (player: PlayerType) => void;
  handleConfirmPick: () => Promise<void>;
  getDraftedPlayersForTeam: (teamName: string) => (Tables<'players'> & { round: number; pick: number; overallPick: number; nbaTeam: string; })[];
  draftStats: {
    totalPicks: number;
    completedPicks: number;
    availablePlayers: number;
    progress: number;
  };
  selectedTeamId: string;
  currentSeason: string;
  isLoading: boolean;
}

export const useDraftPageData = (): DraftPageData => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const playersQuery = useRealTimePlayers();
  const playersDataRaw = playersQuery.data || [];
  const isLoadingPlayers = playersQuery.isLoading;
  const { data: teamsDataRaw, isLoading: isLoadingTeams } = useTeams();
  const teamsData = useMemo(() => (teamsDataRaw || []) as { id: string; name: string }[], [teamsDataRaw]);
  const {
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
  } = useDraftState();
  const { activeTeams, connectionStatus } = useTeamPresence();
  const currentSeason = '2025-26';
  const { data: allKeepersRaw, isLoading: isLoadingKeepers } = useTeamKeepers({ teamId: '', season: currentSeason });
  const allKeepers = useMemo(() => (allKeepersRaw || []), [allKeepersRaw]);

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerType | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [isMakingPick, setIsMakingPick] = useState(false);
  const [activeTab, setActiveTab] = useState('board');
  const [draftView, setDraftView] = useState<'board' | 'timeline'>('board');

  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchProfile = async (session: { user?: { id: string } } | null) => {
      if (session?.user) {
        try {
          const data = await fetchProfileByUserId(session.user.id);
          setProfile(data);
        } catch (error) {
          console.error('Error fetching profile:', error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        fetchProfile(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchProfile(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (teamsData.length > 0 && !selectedTeam) {
      setSelectedTeam(teamsData[0].name);
    }
  }, [teamsData, selectedTeam]);

  // Process players data to mark drafted and keeper players
  const players = useMemo(() => {
    const draftedPlayerIds = new Set(draftPicks.filter(pick => pick.player_id).map(pick => pick.player_id));
    const keeperPlayerIds = new Set(allKeepers
      .filter(keeper => keeper.player) // Filter out keepers with null players
      .map(keeper => keeper.player!.id) // Map to player IDs
    );

    return (playersDataRaw || []).map(player => ({
      ...player,
      is_drafted: draftedPlayerIds.has(player.id),
      is_keeper: keeperPlayerIds.has(player.id),
    }));
  }, [playersDataRaw, draftPicks, allKeepers]);

  console.log('useDraftPageData - playersDataRaw:', playersDataRaw);
  console.log('useDraftPageData - allKeepers:', allKeepers);
  console.log('useDraftPageData - processed players:', players);

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

  const canMakePick = currentPick && !currentPick.is_used;

  const handleSelectPlayer = (player: PlayerType) => {
    if (!canMakePick) return;
    const fullPlayer = players.find(p => p.id === player.id);
    setSelectedPlayer(fullPlayer || player);
  };

  const handleConfirmPick = async () => {
    if (!selectedPlayer || !currentPick) return;

    // Optimistic update
    const optimisticPick = {
      ...currentPick,
      is_used: true,
      player_id: selectedPlayer.id,
      player: selectedPlayer,
    };
    const optimisticDraftPicks = draftPicks.map(pick => pick.id === currentPick.id ? optimisticPick : pick);
    const optimisticPlayers = players.map(player => player.id === selectedPlayer.id ? { ...player, is_drafted: true } : player);
    const optimisticCompletedPicks = completedPicks + 1;

    // Update local state optimistically
    // Note: This assumes access to setters or global state; for simplicity, invalidate and let real-time handle, but add local for instant
    queryClient.setQueryData(['draftPicks'], optimisticDraftPicks);
    queryClient.setQueryData(['players'], optimisticPlayers);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        const userProfile = await fetchProfileByUserId(user.id);
        
        if (!userProfile?.team_id) {
          // Rollback optimistic update on error
          queryClient.invalidateQueries({ queryKey: ['draftPicks'] });
          queryClient.invalidateQueries({ queryKey: ['players'] });
          toast({
            title: "Error",
            description: "You are not assigned to a team. Please contact the draft administrator.",
            variant: "destructive",
          });
          return;
        }

        if (currentPick.current_team_id !== userProfile.team_id) {
          // Rollback
          queryClient.invalidateQueries({ queryKey: ['draftPicks'] });
          queryClient.invalidateQueries({ queryKey: ['players'] });
          toast({
            title: "Error",
            description: `It's not your team's turn to pick. ${currentPick.current_team?.name} is on the clock.`,
            variant: "destructive",
          });
          return;
        }
      } catch (error) {
        // Rollback
        queryClient.invalidateQueries({ queryKey: ['draftPicks'] });
        queryClient.invalidateQueries({ queryKey: ['players'] });
        console.error('Error fetching user profile:', error);
        toast({
          title: "Error",
          description: "Failed to verify your team assignment. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsMakingPick(true);

    try {
      const result = await makeDraftPick(selectedPlayer.id);

      setSelectedPlayer(null);

      toast({
        title: "Pick confirmed!",
        description: `${result.current_team.name} selected ${selectedPlayer.name} with pick #${currentPick.pick_number}`,
      });
    } catch (error: unknown) {
      // Rollback optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['draftPicks'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      console.error('Error making draft pick:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      if (errorMessage.includes('already been drafted')) {
        toast({
          title: "Error",
          description: "This player has already been drafted by another team.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('already been used')) {
        toast({
          title: "Error",
          description: "This draft pick has already been used. The draft state may have changed.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('is a keeper')) {
        toast({
          title: "Error",
          description: "This player is a keeper and cannot be drafted.",
          variant: "destructive",
        });
      }
      else {
        toast({
          title: "Error",
          description: errorMessage || "Failed to make draft pick. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsMakingPick(false);
    }
  };

  const getDraftedPlayersForTeam = (teamName: string) => {
    return draftPicksFormatted
      .filter(pick => pick.team === teamName && pick.player && !players.find(p => p.id === pick.player?.id)?.is_keeper)
      .map(pick => {
        const fullPlayer = players.find(p => p.id === pick.player?.id);
        if (fullPlayer) {
          return {
            ...fullPlayer,
            round: pick.round,
            pick: pick.pick,
            overallPick: pick.overallPick,
            nbaTeam: pick.player!.nbaTeam,
          };
        }
        return null;
      }).filter(Boolean) as (Tables<'players'> & { round: number; pick: number; overallPick: number; nbaTeam: string; })[];
  };

  const draftStats = {
    totalPicks: totalPicks,
    completedPicks: completedPicks,
    availablePlayers: players.filter(p => !p.is_drafted && !p.is_keeper).length,
    progress: progress,
  };

  const selectedTeamId = teamsData.find(team => team.name === selectedTeam)?.id || '';

  const isLoading = isLoadingPlayers || isLoadingTeams || isLoadingDraftState || isLoadingKeepers || playersQuery.isLoading;

  return {
    profile,
    players,
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
  };
};
