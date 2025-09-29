import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type DraftSettings = Tables<'draft_settings'>;

export const fetchDraftSettings = async (): Promise<DraftSettings | null> => {
  const { data, error } = await supabase
    .from('draft_settings')
    .select('*')
    .limit(1)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found, return null
      return null;
    }
    throw error;
  }
  return data as DraftSettings;
};

export const updateDraftSettings = async (updates: Partial<DraftSettings>) => {
  // Remove created_at and updated_at from updates to avoid trigger issues
  const { created_at, updated_at, ...cleanUpdates } = updates as any;
  
  const { data, error } = await supabase
    .from('draft_settings')
    .update(cleanUpdates)
    .limit(1)
    .select()
    .single();
  
  if (error) throw error;
  return data as DraftSettings;
};

export const createDraftSettings = async (settings: Omit<DraftSettings, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('draft_settings')
    .insert(settings)
    .select()
    .single();
  
  if (error) throw error;
  return data as DraftSettings;
};