import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/hooks/useTeams';

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface UserTeamActionsProps {
  teamsData: Team[];
  refetchTeams: () => void;
  userTeam: Team | null | undefined;
}

export const UserTeamActions = ({ teamsData, refetchTeams, userTeam }: UserTeamActionsProps) => {
  const { user } = useAuth();
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createTeam = async () => {
    if (!newTeamName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a team name",
        variant: "destructive"
      });
      return;
    }
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a team.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('teams')
      .insert([{
        name: newTeamName,
        owner_email: user.email
      }]);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create team",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Team created successfully"
      });
      setNewTeamName('');
      refetchTeams();
    }
    setLoading(false);
  };

  const joinTeam = async () => {
    if (!selectedTeam) {
      toast({
        title: "Error",
        description: "Please select a team",
        variant: "destructive"
      });
      return;
    }
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to join a team.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ team_id: selectedTeam ? Number(selectedTeam) : null })
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to join team",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Successfully joined team"
      });
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Team</CardTitle>
        <CardDescription>
          {userTeam ? `You are on: ${userTeam.name}` : 'You are not on a team yet'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="team-select">Join Existing Team</Label>
          <Select onValueChange={setSelectedTeam} value={selectedTeam}>
            <SelectTrigger>
              <SelectValue placeholder="Select a team to join" />
            </SelectTrigger>
            <SelectContent>
              {teamsData.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name} {team.owner_email ? `(${team.owner_email})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={joinTeam} disabled={loading || !selectedTeam}>
          {loading ? "Joining..." : "Join Team"}
        </Button>
        
        <div className="border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="new-team">Create New Team</Label>
            <Input
              id="new-team"
              placeholder="Enter team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-team-owner-email">Owner Email (Optional)</Label>
            <Input
              id="new-team-owner-email"
              type="email"
              placeholder="Enter owner email"
              value={user?.email || ''}
              disabled
            />
          </div>
          <Button onClick={createTeam} disabled={loading} className="mt-2">
            {loading ? "Creating..." : "Create Team"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
