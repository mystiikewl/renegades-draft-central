import { useQuery } from '@tanstack/react-query';
import { fetchProfiles } from '@/integrations/supabase/services/profiles';
import { Tables } from '@/integrations/supabase/types';

/**
 * Custom hook to fetch all profiles from the database
 * Uses React Query for caching, background updates, and error handling
 *
 * @returns Query result with profiles data, loading state, and error state
 */
export const useAllProfiles = () => {
  return useQuery<Tables<'profiles'>[]>({
    queryKey: ['allProfiles'],
    queryFn: () => fetchProfiles(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: (failureCount, error) => {
      // Don't retry on 403/404 errors
      if (error instanceof Error && error.message.includes('permission denied')) {
        return false;
      }
      return failureCount < 3;
    },
    refetchOnWindowFocus: false, // Prevent excessive refetching
  });
};

/**
 * Hook for fetching a single profile by user ID
 * Useful for getting current user's profile data
 */
export const useProfileByUserId = (userId: string | undefined) => {
  return useQuery<Tables<'profiles'> | null>({
    queryKey: ['profile', 'userId', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { fetchProfileByUserId } = await import('@/integrations/supabase/services/profiles');
      return fetchProfileByUserId(userId);
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for fetching a single profile by profile ID
 */
export const useProfileById = (profileId: string | undefined) => {
  return useQuery<Tables<'profiles'> | null>({
    queryKey: ['profile', 'id', profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { fetchProfileById } = await import('@/integrations/supabase/services/profiles');
      return fetchProfileById(profileId);
    },
    enabled: !!profileId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};