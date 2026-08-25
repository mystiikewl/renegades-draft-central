import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

/**
 * Fetch all profiles from the database
 * @returns Promise<Tables<'profiles'>[]> Array of all profiles
 */
export const fetchProfiles = async (): Promise<Tables<'profiles'>[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('email', { ascending: true });

  if (error) {
    console.error('Error fetching profiles:', error);
    throw new Error(`Failed to fetch profiles: ${error.message}`);
  }

  return data || [];
};

/**
 * Fetch a single profile by user ID
 * @param userId - The user ID to fetch profile for
 * @returns Promise<Tables<'profiles'> | null> Profile data or null if not found
 */
export const fetchProfileByUserId = async (userId: string): Promise<Tables<'profiles'> | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - profile doesn't exist
      return null;
    }
    console.error('Error fetching profile by user ID:', error);
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data;
};

/**
 * Fetch a single profile by ID
 * @param profileId - The profile ID to fetch
 * @returns Promise<Tables<'profiles'> | null> Profile data or null if not found
 */
export const fetchProfileById = async (profileId: string): Promise<Tables<'profiles'> | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching profile by ID:', error);
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data;
};

/**
 * Update a profile
 * @param profileId - The profile ID to update
 * @param updates - Partial profile data to update
 * @returns Promise<Tables<'profiles'>> Updated profile data
 */
export const updateProfile = async (
  profileId: string,
  updates: Partial<Tables<'profiles'>>
): Promise<Tables<'profiles'>> => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return data;
};