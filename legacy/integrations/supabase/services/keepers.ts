import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type Keeper = Tables<'keepers'> & {
  player: Tables<'players'> | null;
  team: Tables<'teams'> | null;
};

export const fetchKeepers = async (): Promise<Keeper[]> => {
  const { data, error } = await supabase
    .from('keepers')
    .select(`
      *,
      player:players(*),
      team:teams(*)
    `);
  
  if (error) throw error;
  return data as Keeper[];
};

export const fetchKeepersByTeam = async (teamId: string): Promise<Keeper[]> => {
  const { data, error } = await supabase
    .from('keepers')
    .select(`
      *,
      player:players(*),
      team:teams(*)
    `)
    .eq('team_id', teamId);
  
  if (error) throw error;
  return data as Keeper[];
};

export const fetchKeeperById = async (id: string): Promise<Keeper | null> => {
  const { data, error } = await supabase
    .from('keepers')
    .select(`
      *,
      player:players(*),
      team:teams(*)
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Keeper;
};

export const createKeeper = async (keeper: Omit<Keeper, 'id'>) => {
  const { data, error } = await supabase
    .from('keepers')
    .insert(keeper)
    .select(`
      *,
      player:players(*),
      team:teams(*)
    `)
    .single();
  
  if (error) throw error;
  return data as Keeper;
};

export const updateKeeper = async (id: string, updates: Partial<Keeper>) => {
  const { data, error } = await supabase
    .from('keepers')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      player:players(*),
      team:teams(*)
    `)
    .single();
  
  if (error) throw error;
  return data as Keeper;
};

export const deleteKeeper = async (id: string) => {
  const { error } = await supabase
    .from('keepers')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};