import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface RealTimeDraftData {
  draftPicks: Tables<'draft_picks'>[];
  draftSettings: Tables<'draft_settings'> | null;
  players: Tables<'players'>[];
  teams: Tables<'teams'>[];
  connectionStatus: ConnectionStatus;
  lastUpdate: Date | null;
  error: string | null;
}

/**
 * Custom hook for real-time DraftTabs data using Supabase subscriptions
 * Implements Observer pattern for efficient state management
 */
export const useRealTimeDraftTabs = () => {
  const [realtimeData, setRealtimeData] = useState<RealTimeDraftData>({
    draftPicks: [],
    draftSettings: null,
    players: [],
    teams: [],
    connectionStatus: 'connecting',
    lastUpdate: null,
    error: null
  });

  const { toast } = useToast();

  // Channel references for cleanup
  const channelsRef = useRef<{
    draftPicks?: RealtimeChannel;
    draftSettings?: RealtimeChannel;
    players?: RealtimeChannel;
    teams?: RealtimeChannel;
  }>({});

  const updateData = useCallback((updates: Partial<RealTimeDraftData>) => {
    setRealtimeData(prev => ({
      ...prev,
      ...updates,
      lastUpdate: new Date()
    }));
  }, []);

  const handleConnectionStatus = useCallback((status: ConnectionStatus, table: string) => {
    updateData({ connectionStatus: status });

    if (status === 'disconnected') {
      console.warn(`Real-time connection lost for ${table}`);
      toast({
        title: "Connection Warning",
        description: `Real-time updates for ${table} may be delayed`,
        variant: "destructive"
      });
    } else if (status === 'connected') {
      console.log(`Real-time connection established for ${table}`);
    }
  }, [updateData, toast]);

  const handleError = useCallback((error: string) => {
    console.error('Real-time subscription error:', error);
    updateData({
      error,
      connectionStatus: 'disconnected'
    });

    toast({
      title: "Real-time Error",
      description: "Failed to receive live updates. Page will refresh to show latest data.",
      variant: "destructive"
    });
  }, [updateData, toast]);

  // Subscribe to draft_picks changes
  useEffect(() => {
    const setupDraftPicksSubscription = () => {
      channelsRef.current.draftPicks = supabase
        .channel('draft-tabs-draft-picks')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'draft_picks' },
          (payload: RealtimePostgresChangesPayload<Tables<'draft_picks'>>) => {
            console.log('Draft picks update received:', payload);

            // Re-fetch all draft picks to maintain consistency
            const fetchUpdatedDraftPicks = async () => {
              try {
                const { data, error } = await supabase
                  .from('draft_picks')
                  .select('*')
                  .order('round', { ascending: true })
                  .order('pick_number', { ascending: true });

                if (error) throw error;

                updateData({ draftPicks: data || [] });
              } catch (error) {
                handleError(`Failed to fetch updated draft picks: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            };

            fetchUpdatedDraftPicks();
          }
        )
        .subscribe((status) => {
          handleConnectionStatus(
            status === 'SUBSCRIBED' ? 'connected' :
            status === 'CHANNEL_ERROR' ? 'disconnected' :
            status === 'TIMED_OUT' ? 'reconnecting' : 'connecting',
            'draft picks'
          );
        });
    };

    setupDraftPicksSubscription();

    return () => {
      if (channelsRef.current.draftPicks) {
        supabase.removeChannel(channelsRef.current.draftPicks);
      }
    };
  }, [handleConnectionStatus, handleError, updateData]);

  // Subscribe to draft_settings changes
  useEffect(() => {
    const setupDraftSettingsSubscription = () => {
      channelsRef.current.draftSettings = supabase
        .channel('draft-tabs-draft-settings')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'draft_settings' },
          (payload: RealtimePostgresChangesPayload<Tables<'draft_settings'>>) => {
            console.log('Draft settings update received:', payload);

            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              updateData({ draftSettings: payload.new as Tables<'draft_settings'> });
            }
          }
        )
        .subscribe((status) => {
          handleConnectionStatus(
            status === 'SUBSCRIBED' ? 'connected' : 'disconnected',
            'draft settings'
          );
        });
    };

    setupDraftSettingsSubscription();

    return () => {
      if (channelsRef.current.draftSettings) {
        supabase.removeChannel(channelsRef.current.draftSettings);
      }
    };
  }, [handleConnectionStatus, updateData]);

  // Subscribe to players changes
  useEffect(() => {
    const setupPlayersSubscription = () => {
      channelsRef.current.players = supabase
        .channel('draft-tabs-players')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'players' },
          (payload: RealtimePostgresChangesPayload<Tables<'players'>>) => {
            console.log('Players update received:', payload);

            // Re-fetch all players to maintain consistency
            const fetchUpdatedPlayers = async () => {
              try {
                const { data, error } = await supabase
                  .from('players')
                  .select('*')
                  .order('name', { ascending: true });

                if (error) throw error;

                updateData({ players: data || [] });
              } catch (error) {
                handleError(`Failed to fetch updated players: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            };

            fetchUpdatedPlayers();
          }
        )
        .subscribe((status) => {
          handleConnectionStatus(
            status === 'SUBSCRIBED' ? 'connected' : 'disconnected',
            'players'
          );
        });
    };

    setupPlayersSubscription();

    return () => {
      if (channelsRef.current.players) {
        supabase.removeChannel(channelsRef.current.players);
      }
    };
  }, [handleConnectionStatus, handleError, updateData]);

  // Subscribe to teams changes
  useEffect(() => {
    const setupTeamsSubscription = () => {
      channelsRef.current.teams = supabase
        .channel('draft-tabs-teams')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'teams' },
          (payload: RealtimePostgresChangesPayload<Tables<'teams'>>) => {
            console.log('Teams update received:', payload);

            // Re-fetch all teams to maintain consistency
            const fetchUpdatedTeams = async () => {
              try {
                const { data, error } = await supabase
                  .from('teams')
                  .select('*')
                  .order('name', { ascending: true });

                if (error) throw error;

                updateData({ teams: data || [] });
              } catch (error) {
                handleError(`Failed to fetch updated teams: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            };

            fetchUpdatedTeams();
          }
        )
        .subscribe((status) => {
          handleConnectionStatus(
            status === 'SUBSCRIBED' ? 'connected' : 'disconnected',
            'teams'
          );
        });
    };

    setupTeamsSubscription();

    return () => {
      if (channelsRef.current.teams) {
        supabase.removeChannel(channelsRef.current.teams);
      }
    };
  }, [handleConnectionStatus, handleError, updateData]);

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        updateData({ connectionStatus: 'connecting' });

        // Fetch all initial data in parallel
        const [draftPicksResult, draftSettingsResult, playersResult, teamsResult] = await Promise.allSettled([
          supabase.from('draft_picks').select('*').order('round').order('pick_number'),
          supabase.from('draft_settings').select('*').single(),
          supabase.from('players').select('*').order('name'),
          supabase.from('teams').select('*').order('name')
        ]);

        // Process results
        const draftPicks = draftPicksResult.status === 'fulfilled' ? draftPicksResult.value.data || [] : [];
        const draftSettings = draftSettingsResult.status === 'fulfilled' ? draftSettingsResult.value.data : null;
        const players = playersResult.status === 'fulfilled' ? playersResult.value.data || [] : [];
        const teams = teamsResult.status === 'fulfilled' ? teamsResult.value.data || [] : [];

        // Check for errors
        const errors = [
          draftPicksResult.status === 'rejected' ? `Draft picks: ${draftPicksResult.reason}` : null,
          draftSettingsResult.status === 'rejected' ? `Draft settings: ${draftSettingsResult.reason}` : null,
          playersResult.status === 'rejected' ? `Players: ${playersResult.reason}` : null,
          teamsResult.status === 'rejected' ? `Teams: ${teamsResult.reason}` : null
        ].filter(Boolean);

        if (errors.length > 0) {
          throw new Error(`Failed to fetch initial data: ${errors.join(', ')}`);
        }

        updateData({
          draftPicks,
          draftSettings,
          players,
          teams,
          connectionStatus: 'connected',
          error: null
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch initial data';
        console.error('Error fetching initial data:', error);
        handleError(errorMessage);
      }
    };

    fetchInitialData();
  }, [handleError, updateData]);

  return realtimeData;
};