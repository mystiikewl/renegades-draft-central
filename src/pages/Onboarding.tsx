import React, { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftState } from '@/hooks/useDraftState';
import { useTeams } from '@/hooks/useTeams';
import { useToast } from '@/hooks/use-toast';
import { useOnboarding, OnboardingProvider } from '@/contexts/OnboardingContext';
import { OnboardingErrorBoundary } from '@/components/onboarding/ErrorBoundary';
import { LoadingState } from '@/components/onboarding/LoadingState';
import { ProgressIndicator } from '@/components/onboarding/ProgressIndicator';
import { FeatureCard } from '@/components/onboarding/FeatureCard';
import { Sidebar } from '@/components/onboarding/Sidebar';
import { TeamSelection } from '@/components/TeamSelection';
import { KeeperManagement } from '@/components/KeeperManagement';
import { supabase } from '@/integrations/supabase/client';
import { LeagueData } from '@/types/onboarding';
import {
  Trophy,
  Zap,
  Shield,
  Award
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { data: teamsData, isLoading: teamsLoading } = useTeams();
  const { draftSettings, isLoadingDraftState } = useDraftState();
  const isMobile = useIsMobile();

  // Onboarding state management
  const {
    currentStep,
    isLoading: onboardingLoading,
    error,
    setError,
    setLoading,
    completeStep,
    updateData,
    goToStep,
  } = useOnboarding();

  // Calculate loading state
  const isLoading = authLoading || teamsLoading || isLoadingDraftState || onboardingLoading;

  // Memoize league data from draft settings
  const leagueData: LeagueData = useMemo(() => ({
    name: 'Renegades Draft',
    size: draftSettings.teamCount,
    rosterSize: draftSettings.roundCount,
    draftRounds: draftSettings.roundCount,
    keeperLimit: 9, // Could be made configurable
    draftType: draftSettings.draftType === 'snake' ? 'Snake' : 'Linear',
  }), [draftSettings]);

  // Memoize onboarding steps
  const onboardingSteps = useMemo(() => [
    {
      id: 'team-selection',
      title: 'Select Team',
      description: 'Choose your team',
      component: TeamSelection,
    },
    {
      id: 'keeper-management',
      title: 'Set Keepers',
      description: 'Manage your keepers',
      component: KeeperManagement,
    },
  ], []);

  // Current step component
  const CurrentStepComponent = onboardingSteps[currentStep - 1]?.component;

  // Redirect logic
  useEffect(() => {
    if (!authLoading && profile?.team && profile.onboarding_complete) {
      navigate('/');
    } else if (!authLoading && profile?.team && !profile.onboarding_complete) {
      // If user already has a team but hasn't completed onboarding, skip to step 2
      goToStep(2);
    }
  }, [profile, authLoading, navigate, goToStep]);

  // Handle team selection completion
  const handleTeamSelected = useCallback(() => {
    completeStep(1);
    updateData({ selectedTeamId: profile?.team_id });
    goToStep(2);
  }, [completeStep, updateData, profile?.team_id, goToStep]);

  // Handle keepers selection completion
  const handleKeepersSelected = useCallback(async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_complete: true })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      completeStep(2);
      toast({
        title: "Onboarding Complete!",
        description: "Welcome to Renegades Draft! You're all set to start building your dynasty.",
      });

      // Navigate to teams page after a short delay
      setTimeout(() => {
        navigate('/teams');
      }, 1500);
    } catch (error: any) {
      console.error('Error updating onboarding status:', error);
      setError(`Failed to complete onboarding: ${error.message}`);
      toast({
        title: "Error",
        description: "Failed to complete onboarding. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, setLoading, completeStep, toast, navigate, setError]);

  // Show loading state while checking profile
  if (isLoading) {
    return <LoadingState title="Loading Onboarding..." />;
  }

  // If user already has a team and completed onboarding, they shouldn't be here
  if (profile?.team && profile.onboarding_complete) {
    return null; // Will be redirected by useEffect
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center text-red-600">
          <p>Error: {error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <OnboardingErrorBoundary>
      <div className={cn(
        "container mx-auto p-4 max-w-6xl",
        isMobile ? "p-2" : "p-4"
      )}>
        {/* Header Section */}
        <div className="text-center mb-8 mt-6">
          <h1 className={cn(
            "font-bold mb-4 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent",
            isMobile ? "text-2xl" : "text-4xl"
          )}>
            Welcome to Renegades Draft!
          </h1>
          <p className={cn(
            "text-muted-foreground max-w-3xl mx-auto",
            isMobile ? "text-lg" : "text-xl"
          )}>
            Build your fantasy basketball dynasty with friends. Draft, manage, and compete in the ultimate NBA fantasy experience.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <ProgressIndicator
            currentStep={currentStep}
            totalSteps={onboardingSteps.length}
            completedSteps={[1]} // Step 1 is always completed when we reach this point
            steps={onboardingSteps}
          />
        </div>

        {/* Features Overview - Only show on step 1 */}
        {currentStep === 1 && (
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FeatureCard
                icon={<Zap />}
                title="Real-Time Drafting"
                description="Experience live drafting with friends, complete with real NBA player statistics and performance tracking."
              />
              <FeatureCard
                icon={<Shield />}
                title="Keeper System"
                description="Retain your best players for next season and build long-term competitive advantages with strategic keeper selections."
              />
              <FeatureCard
                icon={<Award />}
                title="Advanced Analytics"
                description="Track performance with detailed metrics, power rankings, and categorical comparisons to optimize your roster."
              />
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className={cn(
          "grid gap-8",
          isMobile ? "grid-cols-1" : "lg:grid-cols-3"
        )}>
          {/* Main Step Content */}
          <div className={isMobile ? "col-span-1" : "lg:col-span-2"}>
            {CurrentStepComponent && (
              <div>
                {currentStep === 1 && (
                  <TeamSelection onTeamSelected={handleTeamSelected} />
                )}
                {currentStep === 2 && (
                  <KeeperManagement onKeepersSelected={handleKeepersSelected} />
                )}
              </div>
            )}
          </div>

          {/* Sidebar with Tips and Info */}
          <div className="space-y-6">
            <Sidebar
              currentStep={currentStep}
              leagueData={leagueData}
            />
          </div>
        </div>
      </div>
    </OnboardingErrorBoundary>
  );
};

const OnboardingWithProvider: React.FC = () => {
  return (
    <OnboardingProvider>
      <Onboarding />
    </OnboardingProvider>
  );
};

export default OnboardingWithProvider;
