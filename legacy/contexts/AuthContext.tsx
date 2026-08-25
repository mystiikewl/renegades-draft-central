import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

// Define a custom profile type that includes the nested team object
interface ProfileWithTeam extends Profile {
  team: Team | null;
}

interface AuthContextType {
  user: User | null;
  profile: ProfileWithTeam | null;
  isLoading: boolean;
  onboardingComplete: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  onboardingComplete: false,
  refreshProfile: async () => {}, // Placeholder
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileWithTeam | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const refreshProfile = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);

    if (session?.user) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setProfile(null);
        setOnboardingComplete(false);
        setIsLoading(false);
        return;
      }

      if (!profileData) {
        setProfile(null);
        setOnboardingComplete(false);
        setIsLoading(false);
        return;
      }

      let teamData = null;
      if (profileData.team_id) {
        const { data: teamResult, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .eq('id', profileData.team_id)
          .maybeSingle();

        if (teamError) {
          console.error('Error fetching team:', teamError);
        } else {
          teamData = teamResult;
        }
      }

      const profileWithTeam: ProfileWithTeam = {
        ...profileData,
        team: teamData
      };

      setProfile(profileWithTeam);
      setOnboardingComplete(profileData.onboarding_complete ?? false);
    } else {
      setProfile(null);
      setOnboardingComplete(false);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refreshProfile(); // Initial fetch

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          refreshProfile(); // Refresh profile on auth state change
        } else {
          setProfile(null);
          setOnboardingComplete(false);
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, onboardingComplete, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
