import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UseRealTimeUpdatesProps {
  season: string;
  onUpdate?: () => void;
}

/**
 * Custom hook to handle real-time updates for draft picks and team changes
 */
export const useRealTimeUpdates = ({ season, onUpdate }: UseRealTimeUpdatesProps) => {
  const queryClient = useQueryClient();

  // Invalidate relevant queries when updates occur
  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['teamStats', season] });
    queryClient.invalidateQueries({ queryKey: ['leagueStats', season] });
    queryClient.invalidateQueries({ queryKey: ['teamStatsForRanking', season] });
    queryClient.invalidateQueries({ queryKey: ['leagueStandings', season] });
    queryClient.invalidateQueries({ queryKey: ['draftPicks'] });
    queryClient.invalidateQueries({ queryKey: ['allKeepers', season] });

    // Call custom update handler if provided
    onUpdate?.();
  }, [queryClient, season, onUpdate]);

  useEffect(() => {
    // Subscribe to draft_picks changes
    const draftPicksSubscription = supabase
      .channel('draft-picks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'draft_picks',
          filter: `season=eq.${season}`,
        },
        (payload) => {
          console.log('Draft pick changed:', payload);
          invalidateQueries();
        }
      )
      .subscribe();

    // Subscribe to keepers changes
    const keepersSubscription = supabase
      .channel('keepers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'keepers',
          filter: `season=eq.${season}`,
        },
        (payload) => {
          console.log('Keeper changed:', payload);
          invalidateQueries();
        }
      )
      .subscribe();

    // Subscribe to players changes (for stats updates)
    const playersSubscription = supabase
      .channel('players-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
        },
        (payload) => {
          console.log('Player stats updated:', payload);
          invalidateQueries();
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      draftPicksSubscription.unsubscribe();
      keepersSubscription.unsubscribe();
      playersSubscription.unsubscribe();
    };
  }, [season, invalidateQueries]);

  return {
    invalidateQueries,
  };
};

/**
 * Hook specifically for player detail modal updates
 */
export const usePlayerModalUpdates = (playerId: string | null, season: string) => {
  const queryClient = useQueryClient();

  const invalidatePlayerQueries = useCallback(() => {
    if (playerId) {
      queryClient.invalidateQueries({ queryKey: ['fantasyImpact', playerId] });
      queryClient.invalidateQueries({ queryKey: ['rankingImpact', playerId] });
    }
  }, [queryClient, playerId]);

  useEffect(() => {
    if (!playerId) return;

    // Subscribe to changes that might affect this specific player
    const playerSubscription = supabase
      .channel(`player-${playerId}-changes`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${playerId}`,
        },
        (payload) => {
          console.log(`Player ${playerId} updated:`, payload);
          invalidatePlayerQueries();
        }
      )
      .subscribe();

    return () => {
      playerSubscription.unsubscribe();
    };
  }, [playerId, invalidatePlayerQueries]);

  return {
    invalidatePlayerQueries,
  };
};

/**
 * Hook for monitoring draft state changes
 */
export const useDraftStateUpdates = (season: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const draftStateSubscription = supabase
      .channel('draft-state-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'draft_picks',
          filter: `season=eq.${season}`,
        },
        (payload) => {
          // Invalidate draft state related queries
          queryClient.invalidateQueries({ queryKey: ['draftState'] });
          queryClient.invalidateQueries({ queryKey: ['currentPick'] });
          queryClient.invalidateQueries({ queryKey: ['draftPicks'] });
        }
      )
      .subscribe();

    return () => {
      draftStateSubscription.unsubscribe();
    };
  }, [queryClient, season]);

  return {};
};

/**
 * Hook for monitoring team changes that might affect rankings
 */
export const useTeamChangesUpdates = (season: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const teamsSubscription = supabase
      .channel('teams-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
        },
        (payload) => {
          console.log('Teams updated:', payload);
          queryClient.invalidateQueries({ queryKey: ['teams'] });
          queryClient.invalidateQueries({ queryKey: ['leagueStats', season] });
          queryClient.invalidateQueries({ queryKey: ['leagueStandings', season] });
        }
      )
      .subscribe();

    return () => {
      teamsSubscription.unsubscribe();
    };
  }, [queryClient, season]);

  return {};
};