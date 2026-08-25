import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { DraftPickWithRelations } from '@/integrations/supabase/types/draftPicks';

export type DraftPick = Tables<'draft_picks'> & {
  player: Tables<'players'> | null;
  original_team: Tables<'teams'>;
  current_team: Tables<'teams'>;
  overall_pick: number;
};

export const fetchDraftPicks = async (): Promise<DraftPick[]> => {
  const { data, error } = await supabase
    .from('draft_picks')
    .select(`
      *,
      overall_pick,
      player:players(*),
      original_team:teams!draft_picks_original_team_id_fkey(*),
      current_team:teams!draft_picks_current_team_id_fkey(*)
    `)
    .order('round', { ascending: true })
    .order('pick_number', { ascending: true });
  
  if (error) throw error;
  return data as DraftPick[];
};

export const fetchDraftPickById = async (id: string): Promise<DraftPick | null> => {
  const { data, error } = await supabase
    .from('draft_picks')
    .select(`
      *,
      overall_pick,
      player:players(*),
      original_team:teams!draft_picks_original_team_id_fkey(*),
      current_team:teams!draft_picks_current_team_id_fkey(*)
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as DraftPick;
};

export const makeDraftPick = async (playerId: string) => {
  // First, get the current draft pick
  const { data: currentPickData, error: currentPickError } = await supabase
    .from('draft_picks')
    .select('id')
    .eq('is_used', false)
    .order('round', { ascending: true })
    .order('pick_number', { ascending: true })
    .limit(1)
    .single();

  if (currentPickError) {
    throw new Error(`Failed to fetch the current draft pick: ${currentPickError.message}`);
  }

  if (!currentPickData) {
    throw new Error('No available draft pick found. The draft may be complete.');
  }

  const draftPickId = currentPickData.id;

  // Verify that the player hasn't already been drafted
  const { data: playerData, error: playerCheckError } = await supabase
    .from('players')
    .select('is_drafted, is_keeper')
    .eq('id', playerId)
    .single();

  if (playerCheckError) {
    throw new Error(`Failed to verify player status: ${playerCheckError.message}`);
  }

  if (playerData.is_drafted) {
    throw new Error('This player has already been drafted by another team.');
  }

  // Check if the player is a keeper for the current season
  const currentSeason = '2025-26'; // Assuming current season is hardcoded or fetched elsewhere
  const { data: keeperData, error: keeperCheckError } = await supabase
    .from('keepers')
    .select('id')
    .eq('player_id', playerId)
    .eq('season', currentSeason)
    .single();

  if (keeperCheckError && keeperCheckError.code !== 'PGRST116') { // PGRST116 means no rows found
    throw new Error(`Failed to verify keeper status: ${keeperCheckError.message}`);
  }

  if (keeperData) {
    throw new Error('This player is a keeper and cannot be drafted.');
  }

  // Since we are fetching the next available pick, we don't need to re-verify if it's used.

  // Update the draft pick to associate it with the player
  const { data: updatedPick, error: pickError } = await supabase
    .from('draft_picks')
    .update({ 
      player_id: playerId,
      is_used: true 
    })
    .eq('id', draftPickId)
    .select(`
      *,
      player:players(*),
      original_team:teams!draft_picks_original_team_id_fkey(*),
      current_team:teams!draft_picks_current_team_id_fkey(*)
    `)
    .single();

  if (pickError) {
    if (pickError.message.includes('duplicate key value violates unique constraint')) {
      throw new Error('This player has already been drafted by another team.');
    }
    throw new Error(`Failed to make draft pick: ${pickError.message}`);
  }

  // Then, mark the player as drafted
  const { error: playerError } = await supabase
    .from('players')
    .update({ 
      is_drafted: true,
      drafted_by_team_id: updatedPick.current_team_id 
    })
    .eq('id', playerId);

  if (playerError) {
    // Try to rollback the draft pick update
    await supabase
      .from('draft_picks')
      .update({ 
        player_id: null,
        is_used: false 
      })
      .eq('id', draftPickId);
    
    throw new Error(`Failed to update player status: ${playerError.message}`);
  }

  return updatedPick as DraftPickWithRelations;
};