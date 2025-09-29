import { useEffect, useState } from 'react';
import { DraftTabService, DraftTabObserver } from '@/services/draftTabService';
import { Tables } from '@/integrations/supabase/types';

interface UseDraftTabServiceReturn {
  draftPicks: Tables<'draft_picks'>[];
  draftSettings: Tables<'draft_settings'> | null;
  players: Tables<'players'>[];
  teams: Tables<'teams'>[];
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to integrate with DraftTabService singleton
 * Provides a React-friendly interface to the shared real-time data
 */
export const useDraftTabService = (componentId: string): UseDraftTabServiceReturn => {
  const [data, setData] = useState<UseDraftTabServiceReturn>({
    draftPicks: [],
    draftSettings: null,
    players: [],
    teams: [],
    connectionStatus: 'disconnected',
    loading: true,
    error: null
  });

  useEffect(() => {
    const service = DraftTabService.getInstance();

    // Create observer for this component
    const observer: DraftTabObserver = {
      id: componentId,
      onDraftPicksUpdate: (draftPicks) => {
        setData(prev => ({ ...prev, draftPicks, loading: false }));
      },
      onDraftSettingsUpdate: (draftSettings) => {
        setData(prev => ({ ...prev, draftSettings, loading: false }));
      },
      onPlayersUpdate: (players) => {
        setData(prev => ({ ...prev, players, loading: false }));
      },
      onTeamsUpdate: (teams) => {
        setData(prev => ({ ...prev, teams, loading: false }));
      },
      onConnectionStatusChange: (connectionStatus) => {
        setData(prev => ({ ...prev, connectionStatus, loading: false }));
      },
      onError: (error) => {
        setData(prev => ({ ...prev, error, loading: false }));
      }
    };

    // Register observer and initialize service
    const initializeService = async () => {
      try {
        await service.initialize();
        service.registerObserver(observer);

        // Get current data
        const currentData = service.getCurrentData();
        setData({
          draftPicks: currentData.draftPicks,
          draftSettings: currentData.draftSettings,
          players: currentData.players,
          teams: currentData.teams,
          connectionStatus: currentData.connectionStatus,
          loading: false,
          error: null
        });
      } catch (error) {
        setData(prev => ({
          ...prev,
          error: `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`,
          loading: false
        }));
      }
    };

    initializeService();

    // Cleanup function
    return () => {
      service.unregisterObserver(componentId);
    };
  }, [componentId]);

  return data;
};