import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTeams } from '@/hooks/useTeams';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Trophy, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface RpcResponse {
  status: 'success' | 'error';
  message?: string;
}

function isRpcResponse(data: unknown): data is RpcResponse {
  return data && (data.status === 'success' || data.status === 'error');
}

interface TeamSelectionProps {
  onTeamSelected: () => void;
}

export const TeamSelection = ({ onTeamSelected }: TeamSelectionProps) => {
  const { data: teamsData = [], isLoading: isLoadingTeams } = useTeams();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingAuth, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingAuth && profile && profile.team_id !== null) {
      toast({
        title: "Already Assigned",
        description: "You are already assigned to a team.",
        variant: "default"
      });
    }
  }, [profile, isLoadingAuth, toast]);

  const handleClaimTeam = async () => {
    if (!selectedTeamId) {
      toast({ title: "Error", description: "Please select a team", variant: "destructive" });
      return;
    }

    setLoading(true);
    // Ensure the team ID is passed as a string, not converted
    const { data, error } = await supabase.rpc('claim_team', {
      target_team_id: selectedTeamId,
    });

    if (error) {
      toast({ title: "Error", description: `Failed to claim team: ${error.message}`, variant: "destructive" });
    } else if (isRpcResponse(data) && data.status === 'error') {
      toast({ title: "Error", description: `Failed to claim team: ${data.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Team claimed successfully!" });
      await refreshProfile(); // Refresh profile after successful claim
      onTeamSelected();
    }
    setLoading(false);
  };

  if (isLoadingAuth || isLoadingTeams) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading team selection...</p>
        </div>
      </div>
    );
  }

  if (profile?.team_id !== null) {
    return null;
  }

  const availableTeams = teamsData;
  const selectedTeam = availableTeams.find(team => team.id === selectedTeamId);

  return (
    <div className="flex justify-center items-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-4xl bg-gradient-card shadow-card border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Select Your Team
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Choose a team to join for the league and start building your fantasy dynasty
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Team Selection Panel */}
            <div className="space-y-6">
              <div className="space-y-4">
                <Label htmlFor="selectTeam" className="text-lg font-semibold">
                  Available Teams
                </Label>
                <Select onValueChange={setSelectedTeamId} value={selectedTeamId || ''}>
                  <SelectTrigger className="bg-input text-foreground border-border h-12 text-lg">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border-border">
                    {availableTeams.length > 0 ? (
                      availableTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id} className="py-2">
                          <div className="flex items-center justify-between w-full">
                            <span>{team.name}</span>
                            {team.owner_email ? (
                              <span className="text-xs text-muted-foreground">Taken</span>
                            ) : (
                              <span className="text-xs text-green-500">Available</span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-teams" disabled>No available teams</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleClaimTeam} 
                disabled={loading || !selectedTeamId || availableTeams.length === 0}
                className="w-full h-12 text-lg"
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Claiming Team...
                  </>
                ) : (
                  "Claim Team"
                )}
              </Button>

              {/* Team Benefits */}
              <Card className="bg-background/50 border-0">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Team Benefits
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Compete against friends in a real NBA fantasy league</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Build and manage your roster with draft picks and keepers</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Track performance with detailed analytics and rankings</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Trade draft picks and make strategic roster moves</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Team Preview Panel */}
            <div className="space-y-6">
              <Card className="bg-background/50 border-0 h-full">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4 text-center">Team Preview</h3>
                  
                  {selectedTeam ? (
                    <div className="space-y-6">
                      <div className="text-center">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary-glow mx-auto mb-4 flex items-center justify-center">
                          <span className="text-2xl font-bold text-white">
                            {selectedTeam.name.charAt(0)}
                          </span>
                        </div>
                        <h2 className="text-2xl font-bold">{selectedTeam.name}</h2>
                        <p className="text-muted-foreground">
                          {selectedTeam.owner_email ? `Owned by ${selectedTeam.owner_email}` : "Available for claiming"}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">League Size</span>
                          </div>
                          <div className="text-xl font-bold">12 Teams</div>
                        </div>
                        
                        <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Roster Size</span>
                          </div>
                          <div className="text-xl font-bold">15 Players</div>
                        </div>
                        
                        <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Draft Rounds</span>
                          </div>
                          <div className="text-xl font-bold">15 Rounds</div>
                        </div>
                        
                        <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Trophy className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Keepers</span>
                          </div>
                          <div className="text-xl font-bold">Up to 9</div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-sm">
                          <span className="font-semibold">Pro Tip:</span> Choose a team name that reflects 
                          your strategy. Whether it's aggressive, defensive, or balanced - make it count!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <Users className="h-12 w-12 mb-4" />
                      <p className="text-center">
                        Select a team to see details and preview your fantasy journey
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
