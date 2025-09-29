import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileWithTeam } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

export const AuthForm = () => {
  const { onboardingComplete, profile, isLoading: isAuthLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Function to determine where to redirect the user
  const getRedirectUrl = (onboardingComplete: boolean, profile: ProfileWithTeam | null) => {
    // If onboarding is complete and user has a team, go to draft
    if (onboardingComplete && profile?.team) {
      return '/';
    }
    // Otherwise go to onboarding
    return '/onboarding';
  };

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setInitialLoading(false);
      
      // If user is already authenticated, redirect appropriately
      if (session?.user) {
        // Fetch the latest profile data to make a correct redirect decision
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(async ({ data: profileData, error }) => {
            if (error) {
              console.error('Error fetching profile on session load:', error);
              window.location.href = '/onboarding'; // Default redirect on error
            } else {
              let teamData = null;
              if (profileData?.team_id) {
                const { data: teamResult, error: teamError } = await supabase
                  .from('teams')
                  .select('*')
                  .eq('id', profileData.team_id)
                  .maybeSingle();
                if (!teamError && teamResult) {
                  teamData = teamResult;
                }
              }
              const userProfile = profileData ? { ...profileData, team: teamData } : null;
              const onboardingStatus = profileData?.onboarding_complete ?? false;
              const redirectUrl = getRedirectUrl(onboardingStatus, userProfile);
              window.location.href = redirectUrl;
            }
          });
      }
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        setUser(session?.user ?? null);
        setInitialLoading(false);
        
        // Redirect to appropriate page after successful authentication
        if (event === 'SIGNED_IN' && session?.user) {
          toast({
            title: "Success",
            description: "Welcome back! Redirecting..."
          });
          
          // Small delay to show the success message
          setTimeout(() => {
            // Fetch the latest profile data to check for team assignment
            supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle()
              .then(async ({ data: profileData, error }) => {
                if (error) {
                  console.error('Error fetching profile:', error);
                  window.location.href = '/onboarding';
                } else {
                  // If profile has a team_id, fetch the team details
                  let teamData = null;
                  if (profileData?.team_id) {
                    const { data: teamResult, error: teamError } = await supabase
                      .from('teams')
                      .select('*')
                      .eq('id', profileData.team_id)
                      .maybeSingle();

                    if (!teamError && teamResult) {
                      teamData = teamResult;
                    }
                  }

                  // Create the combined profile with team
                  const userProfile = profileData ? {
                    ...profileData,
                    team: teamData
                  } : null;

                  const onboardingStatus = profileData?.onboarding_complete ?? false;
                  const redirectUrl = getRedirectUrl(onboardingStatus, userProfile);
                  window.location.href = redirectUrl;
                }
              });
          }, 1000);
        }
        
        // Handle email confirmation
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('Token refreshed, user confirmed');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [onboardingComplete, profile, toast]);

  const signUp = async (email: string, password: string) => {
    // Use the current origin for redirect, but ensure it's not localhost in production
    let redirectUrl = `${window.location.origin}/`;
    
    // If running in development, you might want to use a specific URL
    // In production, this should be your actual domain
    if (window.location.hostname === 'localhost') {
      redirectUrl = `${window.location.origin}/`;
    }
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };


  const handleAuth = async (type: 'signin' | 'signup') => {
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const { error } = type === 'signin' 
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        if (type === 'signup') {
          toast({
            title: "Success",
            description: "Account created! Check your email to confirm your account."
          });
        }
        // For signin, the success message and redirect will be handled by the auth state change listener
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking authentication state
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // If user is already authenticated, show a message while redirecting
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className={`w-full ${isMobile ? 'max-w-[95vw]' : 'max-w-md'}`}>
          <CardContent className="pt-6 text-center">
            <div className="text-lg">You're already signed in!</div>
            <div className="text-sm text-muted-foreground mt-2">Redirecting to draft...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className={`w-full ${isMobile ? 'max-w-[95vw]' : 'max-w-md'}`}>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Renegades Draft</CardTitle>
          <CardDescription>Access your fantasy basketball draft</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signup" className="w-full">
            <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-2'}`}>
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className={`text-sm ${isMobile ? 'text-center' : 'text-right'}`}>
                <Link to="/reset-password"
                   className="font-medium text-primary hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <Button
                onClick={() => handleAuth('signin')}
                className="w-full"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
              
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => handleAuth('signup')} 
                className="w-full"
                disabled={loading}
              >
                {loading ? "Creating account..." : "Create Account"}
              </Button>
              
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
