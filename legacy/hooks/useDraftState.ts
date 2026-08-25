import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealTimeDraftPicks } from '@/hooks/useRealTimeDraftPicks';
import { useTeams } from '@/hooks/useTeams';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { Team } from '@/types/team';
import { fetchDraftSettings as fetchDraftSettingsService } from '@/integrations/supabase/services/draftSettings';
import { DraftPickWithRelations } from '@/integrations/supabase/types/draftPicks';

// Define types for draft settings from the database
export type DraftSettingsDb = Tables<'draft_settings'>;

export type DraftSettings = {
  roundCount: number;
  teamCount: number;
  season: string;
  draftType: 'snake' | 'linear' | 'manual';
  pickTimeLimitSeconds: number;
  draftOrder: string[]; // Array of team IDs
};

export type DraftState = {
  currentPickIndex: number;
  totalPicks: number;
  completedPicks: number;
  draftPicks: DraftPickWithRelations[];
  isDraftComplete: boolean;
  currentTeamId: string | null;
  draftSettings: DraftSettings;
};

export const useDraftState = () => {
  const { draftPicks, loading: isLoadingDraftPicks } = useRealTimeDraftPicks();
  const { data: teamsData = [], isLoading: isLoadingTeams } = useTeams();
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isDraftInitialized, setIsDraftInitialized] = useState(false); // New state variable
  const [draftSettings, setDraftSettings] = useState<DraftSettings>({
    roundCount: 15,
    teamCount: 12,
    season: '2025-26',
    draftType: 'snake',
    pickTimeLimitSeconds: 120,
    draftOrder: [],
  });
  const { toast } = useToast();

  const fetchDraftSettings = useCallback(async () => {
    try {
      const data = await fetchDraftSettingsService();
      
      if (data) {
        return {
          roundCount: data.roster_size,
          teamCount: data.league_size,
          season: data.season || '2025-26',
          draftType: (data.draft_type as 'snake' | 'linear' | 'manual') || 'snake',
          pickTimeLimitSeconds: data.pick_time_limit_seconds || 120,
          draftOrder: (data.draft_order as string[]) || [],
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching draft settings:', error);
      toast({
        title: "Error",
        description: `Failed to fetch draft settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
      return null;
    }
  }, [toast]);

  const mutateDraftSettings = useCallback(async () => {
    const settings = await fetchDraftSettings();
    if (settings) {
      setDraftSettings(settings);
    }
  }, [fetchDraftSettings]);

  // Fetch draft settings from Supabase and subscribe to real-time updates
  useEffect(() => {
    mutateDraftSettings(); // Initial fetch

    // Real-time subscription for draft_settings
    const settingsSubscription = supabase
      .channel('draft_settings_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'draft_settings' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newSettings = payload.new as DraftSettingsDb;
            setDraftSettings({
              roundCount: newSettings.roster_size,
              teamCount: newSettings.league_size,
              season: newSettings.season || '2025-26',
              draftType: (newSettings.draft_type as 'snake' | 'linear' | 'manual') || 'snake',
              pickTimeLimitSeconds: newSettings.pick_time_limit_seconds || 120,
              draftOrder: (newSettings.draft_order as string[]) || [],
            });
          }
        }
      )
      .subscribe();

    // Real-time subscription for draft_picks to update current pick index
    const picksSubscription = supabase
      .channel('draft_picks_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'draft_picks' },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new.is_used && !payload.old.is_used) {
            // A pick was used, advance the current pick index
            setCurrentPickIndex(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(settingsSubscription);
      supabase.removeChannel(picksSubscription);
    };
  }, [mutateDraftSettings]);

  // Calculate draft state based on fetched settings and real-time picks
  const completedPicks = draftPicks.filter(pick => pick.is_used).length;
  const totalPicks = draftSettings.roundCount * draftSettings.teamCount;
  const isDraftComplete = completedPicks === totalPicks && totalPicks > 0;
  
  // Get current team ID (the team whose turn it is)
  const currentPick = draftPicks[currentPickIndex];
  const currentTeamId = currentPick?.current_team_id || null;

  // Initialize draft picks
  const initializeDraftPicks = useCallback(async (teamsDataParam?: Team[]) => {
    const teamsToUse = teamsDataParam || (teamsData as Team[]);
    
    // Use fetched draft settings, or fall back to defaults if not available
    const actualRoundCount = draftSettings.roundCount;
    const actualTeamCount = draftSettings.teamCount;

    if (isInitializing || isDraftInitialized || teamsToUse.length === 0 || actualRoundCount === 0 || actualTeamCount === 0) {
      return;
    }
    
    setIsInitializing(true);
    
    try {
      // Generate initial draft picks
      const picksToInsert = [];
      const orderedTeamIds = draftSettings.draftOrder.length > 0 ? draftSettings.draftOrder : teamsToUse.map(team => team.id);
      
      for (let round = 1; round <= actualRoundCount; round++) {
        for (let pickIndex = 0; pickIndex < actualTeamCount; pickIndex++) {
          const isEvenRound = round % 2 === 0;
          let teamIdForPick: string;

          if (draftSettings.draftType === 'snake') {
            teamIdForPick = isEvenRound ? orderedTeamIds[actualTeamCount - pickIndex - 1] : orderedTeamIds[pickIndex];
          } else if (draftSettings.draftType === 'linear') {
            teamIdForPick = orderedTeamIds[pickIndex];
          } else { // manual or fallback
            teamIdForPick = isEvenRound ? orderedTeamIds[actualTeamCount - pickIndex - 1] : orderedTeamIds[pickIndex];
          }

          const team = teamsToUse.find(t => t.id === teamIdForPick);
          
          if (team) {
            picksToInsert.push({
              round,
              pick_number: pickIndex + 1,
              original_team_id: team.id,
              current_team_id: team.id,
            });
          }
        }
      }
      
      // Insert draft picks
      const { error: insertError } = await supabase
        .from('draft_picks')
        .insert(picksToInsert);
      
      if (insertError) {
        console.error('Error initializing draft picks:', insertError);
        toast({
          title: "Error",
          description: "Failed to initialize draft picks",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Draft picks initialized successfully",
        });
        setIsDraftInitialized(true); // Set to true after successful initialization
      }
    } catch (error) {
      console.error('Error initializing draft picks:', error);
      toast({
        title: "Error",
        description: "Failed to initialize draft picks",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, isDraftInitialized, teamsData, toast, draftSettings.roundCount, draftSettings.teamCount, draftSettings.draftOrder, draftSettings.draftType]);

  // Reset draft (admin only)
  const resetDraft = useCallback(async () => {
    setIsDraftInitialized(false); // Allow re-initialization after reset
    try {
      // First, reset all players to undrafted
      const { error: playersError } = await supabase
        .from('players')
        .update({ 
          is_drafted: false,
          drafted_by_team_id: null,
          is_keeper: false
        })
        .is('is_drafted', true);
      
      if (playersError) throw new Error(`Failed to reset players: ${playersError.message}`);
      
      // Delete all existing draft picks in a single operation
      const { error: picksDeleteError } = await supabase
        .from('draft_picks')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletes all picks
      
      if (picksDeleteError) throw new Error(`Failed to reset draft picks: ${picksDeleteError.message}`);
      
      // Generate new draft picks
      // Use fetched draft settings, or fall back to defaults if not available
      const actualRoundCount = draftSettings.roundCount;
      const actualTeamCount = draftSettings.teamCount;
      const orderedTeamIds = draftSettings.draftOrder.length > 0 ? draftSettings.draftOrder : (teamsData as Team[]).map(team => team.id);

      if ((teamsData as Team[]).length > 0 && actualRoundCount > 0 && actualTeamCount > 0) {
        const picksToInsert = [];
        
        for (let round = 1; round <= actualRoundCount; round++) {
          for (let pickIndex = 0; pickIndex < actualTeamCount; pickIndex++) {
            const isEvenRound = round % 2 === 0;
            let teamIdForPick: string;

            if (draftSettings.draftType === 'snake') {
              teamIdForPick = isEvenRound ? orderedTeamIds[actualTeamCount - pickIndex - 1] : orderedTeamIds[pickIndex];
            } else if (draftSettings.draftType === 'linear') {
              teamIdForPick = orderedTeamIds[pickIndex];
            } else { // manual or fallback
              teamIdForPick = isEvenRound ? orderedTeamIds[actualTeamCount - pickIndex - 1] : orderedTeamIds[pickIndex];
            }
            
            const team = (teamsData as Team[]).find(t => t.id === teamIdForPick);
            
            if (team) {
              picksToInsert.push({
                round,
                pick_number: pickIndex + 1,
                original_team_id: team.id,
                current_team_id: team.id,
              });
            }
          }
        }
        
        // Insert new draft picks
        const { error: picksInsertError } = await supabase
          .from('draft_picks')
          .insert(picksToInsert);
        
        if (picksInsertError) throw new Error(`Failed to recreate draft picks: ${picksInsertError.message}`);
      }
      
      // Reset current pick index
      setCurrentPickIndex(0);
      
      toast({
        title: "Success",
        description: "Draft has been reset successfully",
      });
    } catch (error: unknown) {
      console.error('Error resetting draft:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: errorMessage || "Failed to reset draft",
        variant: "destructive",
      });
    }
  }, [teamsData, toast, draftSettings.roundCount, draftSettings.teamCount, draftSettings.draftOrder, draftSettings.draftType]);

  // Move to next pick
  const nextPick = useCallback(() => {
    if (currentPickIndex < totalPicks - 1) {
      setCurrentPickIndex(prev => prev + 1);
    }
  }, [currentPickIndex, totalPicks]);

  // Move to previous pick
  const previousPick = useCallback(() => {
    if (currentPickIndex > 0) {
      setCurrentPickIndex(prev => prev - 1);
    }
  }, [currentPickIndex]);

  // Jump to specific pick
  const goToPick = useCallback((pickIndex: number) => {
    if (pickIndex >= 0 && pickIndex < totalPicks) {
      setCurrentPickIndex(pickIndex);
    }
  }, [totalPicks]);

  // Initialize draft picks when teams are loaded and no picks exist, and draft hasn't been initialized yet
  useEffect(() => {
    if ((teamsData as Team[]).length > 0 && draftPicks.length === 0 && !isLoadingDraftPicks && !isInitializing && draftSettings.roundCount > 0 && draftSettings.teamCount > 0 && !isDraftInitialized) {
      initializeDraftPicks();
    }
  }, [teamsData, draftPicks, isLoadingDraftPicks, isInitializing, initializeDraftPicks, draftSettings.roundCount, draftSettings.teamCount, isDraftInitialized]);

  // Auto-advance current pick index when picks are made
  useEffect(() => {
    if (draftPicks.length > 0) {
      const nextUnusedPickIndex = draftPicks.findIndex(pick => !pick.is_used);
      if (nextUnusedPickIndex !== -1 && nextUnusedPickIndex !== currentPickIndex) {
        setCurrentPickIndex(nextUnusedPickIndex);
      } else if (nextUnusedPickIndex === -1 && completedPicks === totalPicks && totalPicks > 0) {
        // Draft is complete, ensure we're at the last pick
        setCurrentPickIndex(totalPicks - 1);
      }
    }
  }, [draftPicks, completedPicks, totalPicks, currentPickIndex]);

  // Re-initialize draft picks when draft order or teams data changes, but only if the draft is not already initialized
  // This prevents unnecessary re-initializations and infinite loops.
  useEffect(() => {
    if (!isLoadingTeams && (teamsData as Team[]).length > 0 && draftSettings.draftOrder.length > 0 && isDraftInitialized) {
      const expectedTotalPicks = draftSettings.roundCount * (teamsData as Team[]).length;
      const currentTeamIdsInPicks = new Set(draftPicks.map(pick => pick.current_team_id));
      const allTeamsPresent = (teamsData as Team[]).every(team => currentTeamIdsInPicks.has(team.id));

      // Only trigger a reset if the number of picks or the teams in picks don't match the settings,
      // indicating a fundamental change in draft structure that requires a full reset.
      if (draftPicks.length !== expectedTotalPicks || !allTeamsPresent) {
        console.log("Draft order or teams data changed, resetting draft...");
        resetDraft();
      }
    }
  }, [teamsData, draftSettings.draftOrder, draftSettings.roundCount, draftPicks, isLoadingTeams, resetDraft, isDraftInitialized]);

  return {
    // State
    currentPickIndex,
    totalPicks,
    completedPicks,
    draftPicks,
    isDraftComplete,
    currentTeamId,
    draftSettings,
    isLoadingDraftState: isLoadingDraftPicks || isLoadingTeams || isInitializing,
    
    // Actions
    initializeDraftPicks,
    resetDraft,
    nextPick,
    previousPick,
    goToPick,
    mutateDraftSettings, // Expose mutate function
    
    // Computed values
    currentPick: draftPicks[currentPickIndex],
    progress: totalPicks > 0 ? Math.round((completedPicks / totalPicks) * 100) : 0,
  };
};
