import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobileTabs, MobileTabsContent, MobileTabsList, MobileTabsTrigger } from '@/components/ui/mobile-tabs';
import { calculateFantasyScore } from '@/utils/fantasyScore';
import type { Player } from './player-pool/PlayerCard';
import { FantasyImpactSection } from './player-details/FantasyImpactSection';
import { RankingImpactSection } from './player-details/RankingImpactSection';
import { EnhancedStatsSection } from './player-details/EnhancedStatsSection';
import { DraftImpactSummary } from './player-details/DraftImpactSummary';
import { useFantasyImpact } from '@/hooks/useFantasyImpact';
import { useRankingImpact } from '@/hooks/useRankingImpact';
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';
import { useResponsive } from '@/hooks/use-responsive';
import { useFavourites } from '@/hooks/useFavourites';
import { useAuth } from '@/contexts/AuthContext';
import {
  Trophy,
  Target,
  Users,
  Award,
  TrendingUp,
  Calendar,
  BarChart3,
  Activity,
  Zap,
  Star
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { makeDraftPick } from '@/hooks/makeDraftPick';
import { supabase } from '@/integrations/supabase/client';

interface PlayerDetailsModalProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (player: Player) => void;
  canMakePick?: boolean;
}

export const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({
  player,
  isOpen,
  onClose,
  onConfirm,
  canMakePick
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
   const [isMakingPick, setIsMakingPick] = useState(false);
   const [activeTab, setActiveTab] = useState('stats');
   const { isMobile, tabLayout } = useResponsive();
   const { toast } = useToast();
   const { user } = useAuth();
   const { isFavourite, toggleFavouriteMutation } = useFavourites();

  // Responsive tab label handler
  const getTabLabel = (fullText: string, mobileText: string): string => {
    switch (tabLayout) {
      case 'icon-only':
        return '';
      case 'abbreviated':
        return mobileText;
      case 'full-text':
      case 'grid-layout':
      default:
        return fullText;
    }
  };

  // Get user profile for team information
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('team_id, teams(*)')
          .eq('user_id', user.id)
          .single();
        return data;
      }
      return null;
    },
  });

  // Initialize hooks for fantasy analysis
  const { fantasyImpact, isLoading: isLoadingFantasyImpact } = useFantasyImpact({
    player,
    teamId: profile?.team_id || '',
    season: '2025-26',
  });

  const { rankingImpact, isLoading: isLoadingRankingImpact } = useRankingImpact({
    player,
    teamId: profile?.team_id || '',
    season: '2025-26',
  });

  // Set up real-time updates
  useRealTimeUpdates({
    season: '2025-26',
  });

  if (!player) return null;

  const fantasyScore = calculateFantasyScore(player);

  // Check if we have all required data for impact analysis
  const hasRequiredData = !!profile?.team_id && !!player && !isLoadingProfile;
  const hasImpactData = fantasyImpact && rankingImpact;
  const isImpactLoading = isLoadingFantasyImpact || isLoadingRankingImpact;
  const shouldShowImpactSummary = hasRequiredData && (hasImpactData || isImpactLoading);

  const handleSelectClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmSelection = async () => {
    if (!player) return;
    
    setShowConfirmDialog(false);
    setIsMakingPick(true);
    
    try {
      // Verify user has a team
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('team_id, teams(name)')
          .eq('user_id', user.id)
          .single();

        if (!userProfile?.team_id) {
          toast({
            title: "Error",
            description: "You are not assigned to a team. Please contact the draft administrator.",
            variant: "destructive",
          });
          setIsMakingPick(false);
          return;
        }
      }

      // Make the draft pick
      const result = await makeDraftPick(player.id);
      
      // Close the modal and notify success
      onClose();
      toast({
        title: "Pick confirmed!",
        description: `${result.current_team.name} selected ${player.name}`,
      });
      
      // Call onConfirm to update parent state if needed
      onConfirm(player);
    } catch (error: unknown) {
      console.error('Error making draft pick:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      if (errorMessage.includes('already been drafted')) {
        toast({
          title: "Error",
          description: "This player has already been drafted by another team.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('already been used')) {
        toast({
          title: "Error",
          description: "This draft pick has already been used. The draft state may have changed.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('is a keeper')) {
        toast({
          title: "Error",
          description: "This player is a keeper and cannot be drafted.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage || "Failed to make draft pick. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsMakingPick(false);
    }
  };

  const handleCancelSelection = () => {
    setShowConfirmDialog(false);
  };

  const handleToggleFavourite = async () => {
    if (!user || !player) return;

    const wasFavourite = isFavourite(player.id);

    try {
      await toggleFavouriteMutation.mutateAsync(player.id);

      // Show success toast
      toast({
        title: wasFavourite ? "Removed from favourites" : "Added to favourites",
        description: `${player.name} ${wasFavourite ? 'removed from' : 'added to'} your favourites.`,
      });
    } catch (error) {
      console.error('Failed to toggle favourite:', error);
      toast({
        title: "Error",
        description: "Failed to update favourites. Please try again.",
        variant: "destructive",
      });
      // Error is already handled in the hook with UI rollback
    }
  };

  return (
    <>
      <Dialog open={isOpen && !showConfirmDialog} onOpenChange={onClose}>
        <DialogContent 
          className={`flex flex-col max-h-[90vh] ${isMobile ? 'w-[95vw] max-w-[95vw]' : 'sm:max-w-[500px] md:max-w-[600px] lg:max-w-[700px]'}`}
        >
          <DialogHeader className={isMobile ? "flex-shrink-0" : ""}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className={`text-2xl ${isMobile ? 'text-xl' : ''}`}>{player.name}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2">
                  <span>{player.position}</span>
                  <span>•</span>
                  <span>{player.nba_team}</span>
                  {(player.is_drafted || player.is_keeper) && (
                    <Badge variant="default" className="ml-2 bg-gray-600 text-white">
                      {player.is_keeper ? "Keeper" : "Drafted"}
                    </Badge>
                  )}
                </DialogDescription>
              </div>
              {user && (
                <button
                  onClick={handleToggleFavourite}
                  className="p-2 rounded-full hover:bg-accent transition-colors ml-2"
                  disabled={toggleFavouriteMutation.isPending}
                  title={user && isFavourite(player.id) ? "Remove from favourites" : "Add to favourites"}
                >
                  <Star
                    className={`h-5 w-5 transition-colors ${
                      toggleFavouriteMutation.isPending
                        ? 'text-muted-foreground'
                        : user && isFavourite(player.id)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground hover:text-yellow-400'
                    }`}
                  />
                </button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-grow overflow-y-auto py-2">
            <MobileTabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <MobileTabsList>
                <MobileTabsTrigger value="stats" className="flex items-center gap-1" aria-label="Player Statistics">
                  <Activity className="h-4 w-4" />
                  {getTabLabel('Stats', 'Stats')}
                </MobileTabsTrigger>
                <MobileTabsTrigger value="fantasy" className="flex items-center gap-1" aria-label="Fantasy Impact Analysis">
                  <Zap className="h-4 w-4" />
                  {getTabLabel('Fantasy Impact', 'Fantasy')}
                </MobileTabsTrigger>
                <MobileTabsTrigger value="rankings" className="flex items-center gap-1" aria-label="Player Rankings">
                  <Trophy className="h-4 w-4" />
                  {getTabLabel('Rankings', 'Rank')}
                </MobileTabsTrigger>
                <MobileTabsTrigger value="analysis" className="flex items-center gap-1" aria-label="Detailed Analysis">
                  <BarChart3 className="h-4 w-4" />
                  {getTabLabel('Analysis', 'Analysis')}
                </MobileTabsTrigger>
              </MobileTabsList>

              <MobileTabsContent value="stats" className="space-y-6">
                <EnhancedStatsSection player={player} />
              </MobileTabsContent>

              <MobileTabsContent value="fantasy" className="space-y-6">
                <FantasyImpactSection
                  fantasyImpact={fantasyImpact}
                  isLoading={isLoadingFantasyImpact}
                />
              </MobileTabsContent>

              <MobileTabsContent value="rankings" className="space-y-6">
                <RankingImpactSection
                  rankingImpact={rankingImpact}
                  isLoading={isLoadingRankingImpact}
                />
              </MobileTabsContent>

              <MobileTabsContent value="analysis" className="space-y-6">
                {/* Legacy detailed stats section for backward compatibility */}
                <div className="space-y-4">
                  <h3 className={`font-semibold ${isMobile ? 'text-lg' : 'text-lg'}`}>Detailed Statistics</h3>
                  <div className={`card-grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Field Goal %</span>
                      </div>
                      <span className="font-medium">{player.field_goal_percentage?.toFixed(3) || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Free Throw %</span>
                      </div>
                      <span className="font-medium">{player.free_throw_percentage?.toFixed(3) || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">3PM</span>
                      </div>
                      <span className="font-medium">{player.three_pointers_made?.toFixed(1) || '0.0'}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Turnovers</span>
                      </div>
                      <span className="font-medium">{player.turnovers?.toFixed(1) || '0.0'}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Games Played</span>
                      </div>
                      <span className="font-medium">{player.games_played || '0'}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Rank</span>
                      </div>
                      <span className="font-medium">#{player.rank || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Player Info */}
                <div className="space-y-4">
                  <h3 className={`font-semibold ${isMobile ? 'text-lg' : 'text-lg'}`}>Player Information</h3>
                  <div className={`card-grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Age</span>
                      <span className="font-medium">{player.age || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Experience</span>
                      <span className="font-medium">{player.is_rookie ? 'Rookie' : 'NBA Player'}</span>
                    </div>
                  </div>
                </div>
              </MobileTabsContent>
            </MobileTabs>
          </div>

          <DialogFooter className={`gap-2 ${isMobile ? 'flex-col' : 'sm:justify-between'}`}>
            <Button variant="outline" onClick={onClose} className={isMobile ? "w-full" : ""}>
              Cancel
            </Button>
            {canMakePick && !player.is_drafted && !player.is_keeper && (
              <Button onClick={handleSelectClick} className={isMobile ? "w-full" : ""}>
                Select {player.name}
              </Button>
            )}
            {(player.is_drafted || player.is_keeper) && (
              <Button disabled variant="secondary" className={isMobile ? "w-full" : ""}>
                {player.is_keeper ? "Keeper Player" : "Already Drafted"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className={`${isMobile ? "w-[95vw] max-w-[95vw] max-h-[90vh]" : "sm:max-w-[600px]"}`}>
          <DialogHeader>
            <DialogTitle>Confirm Player Selection</DialogTitle>
            <DialogDescription>
              Are you sure you want to select <span className="font-bold">{player.name}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {/* Draft Impact Summary */}
          <div className="py-4">
            <DraftImpactSummary
              fantasyImpact={fantasyImpact}
              rankingImpact={rankingImpact}
              isLoading={isLoadingFantasyImpact || isLoadingRankingImpact}
            />
          </div>

          <DialogFooter className={`gap-2 ${isMobile ? 'flex-col' : ''}`}>
            <Button variant="outline" onClick={handleCancelSelection} className={isMobile ? "w-full" : ""} disabled={isMakingPick}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSelection} className={isMobile ? "w-full" : ""} disabled={isMakingPick}>
              {isMakingPick ? "Confirming..." : "Confirm Selection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
