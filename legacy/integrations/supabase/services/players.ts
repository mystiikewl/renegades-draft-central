import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type PlayerWithKeeperInfo = Tables<'players'> & {
  is_rookie: boolean;
};

export type PlayerFilters = {
  position?: string[];
  search?: string;
  minPoints?: number;
  maxPoints?: number;
  minRebounds?: number;
  maxRebounds?: number;
  minAssists?: number;
  maxAssists?: number;
  availableOnly?: boolean;
  teamId?: string;
};

export const fetchPlayers = async (filters?: PlayerFilters): Promise<PlayerWithKeeperInfo[]> => {
  let query = supabase
    .from('players')
    .select('*, is_rookie');

  // Apply position filter
  if (filters?.position && filters.position.length > 0) {
    query = query.in('position', filters.position);
  }

  // Apply search filter
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,team.ilike.%${filters.search}%`);
  }

  // Apply points filters
  if (filters?.minPoints !== undefined) {
    query = query.gte('points', filters.minPoints);
  }
  if (filters?.maxPoints !== undefined) {
    query = query.lte('points', filters.maxPoints);
  }

  // Apply rebounds filters
  if (filters?.minRebounds !== undefined) {
    query = query.gte('total_rebounds', filters.minRebounds);
  }
  if (filters?.maxRebounds !== undefined) {
    query = query.lte('total_rebounds', filters.maxRebounds);
  }

  // Apply assists filters
  if (filters?.minAssists !== undefined) {
    query = query.gte('assists', filters.minAssists);
  }
  if (filters?.maxAssists !== undefined) {
    query = query.lte('assists', filters.maxAssists);
  }

  // Apply availability filter
  if (filters?.availableOnly) {
    query = query.eq('is_available', true);
  }

  // Apply team filter
  if (filters?.teamId) {
    query = query.eq('team_id', filters.teamId);
  }

  const { data, error } = await query.order('points', { ascending: false });

  if (error) throw error;
  return data as PlayerWithKeeperInfo[];
};

export const fetchAllPlayers = async (): Promise<PlayerWithKeeperInfo[]> => {
  const { data, error } = await supabase
    .from('players')
    .select('*, is_rookie')
    .order('points', { ascending: false });

  if (error) throw error;
  return data as PlayerWithKeeperInfo[];
};

export const fetchPlayerById = async (id: string): Promise<PlayerWithKeeperInfo | null> => {
  const { data, error } = await supabase
    .from('players')
    .select('*, is_rookie')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as PlayerWithKeeperInfo;
};
