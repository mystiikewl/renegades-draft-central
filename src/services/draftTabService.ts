import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export interface DraftTabObserver {
  id: string;
  onDraftPicksUpdate: (draftPicks: Tables<'draft_picks'>[]) => void;
  onDraftSettingsUpdate: (draftSettings: Tables<'draft_settings'> | null) => void;
  onPlayersUpdate: (players: Tables<'players'>[]) => void;
  onTeamsUpdate: (teams: Tables<'teams'>[]) => void;
  onConnectionStatusChange: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
  onError: (error: string) => void;
}

/**
 * DraftTabService - Singleton Pattern Implementation
 * Manages shared real-time subscriptions and state for DraftTabs components
 */
export class DraftTabService {
  private static instance: DraftTabService;
  private realtimeSubscription: RealtimeChannel | null = null;
  private observers: Map<string, DraftTabObserver> = new Map();
  private connectionStatus: 'connected' | 'disconnected' | 'reconnecting' = 'disconnected';
  private isInitialized = false;

  // Cached data
  private cachedDraftPicks: Tables<'draft_picks'>[] = [];
  private cachedDraftSettings: Tables<'draft_settings'> | null = null;
  private cachedPlayers: Tables<'players'>[] = [];
  private cachedTeams: Tables<'teams'>[] = [];

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DraftTabService {
    if (!DraftTabService.instance) {
      DraftTabService.instance = new DraftTabService();
    }
    return DraftTabService.instance;
  }

  /**
   * Initialize real-time subscriptions
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('DraftTabService already initialized');
      return;
    }

    try {
      console.log('Initializing DraftTabService...');

      // Set up real-time subscription
      this.realtimeSubscription = supabase.channel('draft-tabs-service');

      // Subscribe to all relevant tables
      this.setupDraftPicksSubscription();
      this.setupDraftSettingsSubscription();
      this.setupPlayersSubscription();
      this.setupTeamsSubscription();

      // Subscribe to channel
      await this.realtimeSubscription.subscribe((status) => {
        const newStatus = status === 'SUBSCRIBED' ? 'connected' :
                         status === 'CHANNEL_ERROR' ? 'disconnected' :
                         status === 'TIMED_OUT' ? 'reconnecting' : 'disconnected';

        this.updateConnectionStatus(newStatus);
      });

      // Fetch initial data
      await this.fetchInitialData();

      this.isInitialized = true;
      console.log('DraftTabService initialized successfully');

    } catch (error) {
      console.error('Failed to initialize DraftTabService:', error);
      this.notifyError(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Register an observer
   */
  registerObserver(observer: DraftTabObserver): void {
    this.observers.set(observer.id, observer);
    console.log(`Observer ${observer.id} registered`);

    // Send current data to new observer
    if (this.cachedDraftPicks.length > 0) {
      observer.onDraftPicksUpdate(this.cachedDraftPicks);
    }
    if (this.cachedDraftSettings !== null) {
      observer.onDraftSettingsUpdate(this.cachedDraftSettings);
    }
    if (this.cachedPlayers.length > 0) {
      observer.onPlayersUpdate(this.cachedPlayers);
    }
    if (this.cachedTeams.length > 0) {
      observer.onTeamsUpdate(this.cachedTeams);
    }
    observer.onConnectionStatusChange(this.connectionStatus);
  }

  /**
   * Unregister an observer
   */
  unregisterObserver(observerId: string): void {
    this.observers.delete(observerId);
    console.log(`Observer ${observerId} unregistered`);

    // If no more observers, we could potentially clean up resources
    if (this.observers.size === 0) {
      console.log('No more observers, considering cleanup...');
      // For now, keep the service running for performance
      // Could implement cleanup logic here if needed
    }
  }

  /**
   * Get current cached data
   */
  getCurrentData() {
    return {
      draftPicks: this.cachedDraftPicks,
      draftSettings: this.cachedDraftSettings,
      players: this.cachedPlayers,
      teams: this.cachedTeams,
      connectionStatus: this.connectionStatus
    };
  }

  /**
   * Force refresh of all data
   */
  async refreshData(): Promise<void> {
    console.log('Refreshing DraftTabService data...');
    await this.fetchInitialData();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.realtimeSubscription) {
      supabase.removeChannel(this.realtimeSubscription);
      this.realtimeSubscription = null;
    }

    this.observers.clear();
    this.isInitialized = false;
    this.cachedDraftPicks = [];
    this.cachedDraftSettings = null;
    this.cachedPlayers = [];
    this.cachedTeams = [];

    console.log('DraftTabService destroyed');
  }

  // Private methods

  private setupDraftPicksSubscription(): void {
    if (!this.realtimeSubscription) return;

    this.realtimeSubscription.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'draft_picks' },
      async (payload) => {
        console.log('Draft picks change detected:', payload.eventType);

        // Re-fetch all draft picks for consistency
        try {
          const { data, error } = await supabase
            .from('draft_picks')
            .select('*')
            .order('round', { ascending: true })
            .order('pick_number', { ascending: true });

          if (error) throw error;

          this.cachedDraftPicks = data || [];
          this.notifyDraftPicksUpdate(this.cachedDraftPicks);

        } catch (error) {
          const errorMessage = `Failed to fetch updated draft picks: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          this.notifyError(errorMessage);
        }
      }
    );
  }

  private setupDraftSettingsSubscription(): void {
    if (!this.realtimeSubscription) return;

    this.realtimeSubscription.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'draft_settings' },
      (payload) => {
        console.log('Draft settings change detected:', payload.eventType);

        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          this.cachedDraftSettings = payload.new as Tables<'draft_settings'>;
          this.notifyDraftSettingsUpdate(this.cachedDraftSettings);
        } else if (payload.eventType === 'DELETE') {
          this.cachedDraftSettings = null;
          this.notifyDraftSettingsUpdate(null);
        }
      }
    );
  }

  private setupPlayersSubscription(): void {
    if (!this.realtimeSubscription) return;

    this.realtimeSubscription.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'players' },
      async (payload) => {
        console.log('Players change detected:', payload.eventType);

        // Re-fetch all players for consistency
        try {
          const { data, error } = await supabase
            .from('players')
            .select('*')
            .order('name', { ascending: true });

          if (error) throw error;

          this.cachedPlayers = data || [];
          this.notifyPlayersUpdate(this.cachedPlayers);

        } catch (error) {
          const errorMessage = `Failed to fetch updated players: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          this.notifyError(errorMessage);
        }
      }
    );
  }

  private setupTeamsSubscription(): void {
    if (!this.realtimeSubscription) return;

    this.realtimeSubscription.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'teams' },
      async (payload) => {
        console.log('Teams change detected:', payload.eventType);

        // Re-fetch all teams for consistency
        try {
          const { data, error } = await supabase
            .from('teams')
            .select('*')
            .order('name', { ascending: true });

          if (error) throw error;

          this.cachedTeams = data || [];
          this.notifyTeamsUpdate(this.cachedTeams);

        } catch (error) {
          const errorMessage = `Failed to fetch updated teams: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          this.notifyError(errorMessage);
        }
      }
    );
  }

  private async fetchInitialData(): Promise<void> {
    console.log('Fetching initial data for DraftTabService...');

    const [draftPicksResult, draftSettingsResult, playersResult, teamsResult] = await Promise.allSettled([
      supabase.from('draft_picks').select('*').order('round').order('pick_number'),
      supabase.from('draft_settings').select('*').single(),
      supabase.from('players').select('*').order('name'),
      supabase.from('teams').select('*').order('name')
    ]);

    // Process results and update cache
    if (draftPicksResult.status === 'fulfilled') {
      this.cachedDraftPicks = draftPicksResult.value.data || [];
    }

    if (draftSettingsResult.status === 'fulfilled') {
      this.cachedDraftSettings = draftSettingsResult.value.data;
    }

    if (playersResult.status === 'fulfilled') {
      this.cachedPlayers = playersResult.value.data || [];
    }

    if (teamsResult.status === 'fulfilled') {
      this.cachedTeams = teamsResult.value.data || [];
    }

    // Notify observers with initial data
    this.notifyDraftPicksUpdate(this.cachedDraftPicks);
    this.notifyDraftSettingsUpdate(this.cachedDraftSettings);
    this.notifyPlayersUpdate(this.cachedPlayers);
    this.notifyTeamsUpdate(this.cachedTeams);

    // Check for errors
    const errors = [
      draftPicksResult.status === 'rejected' ? draftPicksResult.reason : null,
      draftSettingsResult.status === 'rejected' ? draftSettingsResult.reason : null,
      playersResult.status === 'rejected' ? playersResult.reason : null,
      teamsResult.status === 'rejected' ? teamsResult.reason : null
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new Error(`Failed to fetch initial data: ${errors.join(', ')}`);
    }

    console.log('Initial data fetched successfully');
  }

  private updateConnectionStatus(status: 'connected' | 'disconnected' | 'reconnecting'): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.notifyConnectionStatusChange(status);
    }
  }

  private notifyDraftPicksUpdate(draftPicks: Tables<'draft_picks'>[]): void {
    this.observers.forEach((observer) => {
      try {
        observer.onDraftPicksUpdate(draftPicks);
      } catch (error) {
        console.error(`Error notifying observer ${observer.id}:`, error);
      }
    });
  }

  private notifyDraftSettingsUpdate(draftSettings: Tables<'draft_settings'> | null): void {
    this.observers.forEach((observer) => {
      try {
        observer.onDraftSettingsUpdate(draftSettings);
      } catch (error) {
        console.error(`Error notifying observer ${observer.id}:`, error);
      }
    });
  }

  private notifyPlayersUpdate(players: Tables<'players'>[]): void {
    this.observers.forEach((observer) => {
      try {
        observer.onPlayersUpdate(players);
      } catch (error) {
        console.error(`Error notifying observer ${observer.id}:`, error);
      }
    });
  }

  private notifyTeamsUpdate(teams: Tables<'teams'>[]): void {
    this.observers.forEach((observer) => {
      try {
        observer.onTeamsUpdate(teams);
      } catch (error) {
        console.error(`Error notifying observer ${observer.id}:`, error);
      }
    });
  }

  private notifyConnectionStatusChange(status: 'connected' | 'disconnected' | 'reconnecting'): void {
    this.observers.forEach((observer) => {
      try {
        observer.onConnectionStatusChange(status);
      } catch (error) {
        console.error(`Error notifying observer ${observer.id}:`, error);
      }
    });
  }

  private notifyError(error: string): void {
    this.observers.forEach((observer) => {
      try {
        observer.onError(error);
      } catch (error) {
        console.error(`Error notifying observer ${observer.id}:`, error);
      }
    });
  }
}

// Export singleton instance
export const draftTabService = DraftTabService.getInstance();