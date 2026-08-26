import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useTeams } from '@/hooks/useTeams';
import { KeeperManagement } from '@/components/KeeperManagement';
import { UserTeamActions } from '@/components/team/UserTeamActions';
import { TeamOwnerControls } from '@/components/team/TeamOwnerControls';
import { AllTeamsList } from '@/components/team/AllTeamsList';

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface AdminSettings {
  draft_rounds: number;
  team_count: number;
  current_season: string;
}

export const TeamManagement = () => {
  const { user, profile, isLoading: isLoadingAuth } = useAuth();
  const { data: teamsData = [], isLoading: isLoadingTeams, refetch: refetchTeams } = useTeams();
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    draft_rounds: 15,
    team_count: 10,
    current_season: '2025-26'
  });

  useEffect(() => {
    if (!isLoadingAuth && !isLoadingTeams) {
      // Check if user is admin (you can modify this logic based on your requirements)
      if (profile?.is_admin) {
        fetchAdminSettings();
      }
    }
  }, [profile, isLoadingAuth, isLoadingTeams]);

  const fetchAdminSettings = async () => {
    // For now, we'll use default values
    // In a real implementation, you might store these in a database table
    setAdminSettings({
      draft_rounds: 15,
      team_count: 10,
      current_season: '2025-26'
    });
  };

  const userTeam = profile?.team;

  if (isLoadingAuth || isLoadingTeams) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 animate-pulse"></div>
            <div className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Team Information - High level display at the top */}
      {userTeam ? (
        <Card>
          <CardHeader>
            <CardTitle>Your Team</CardTitle>
            <CardDescription>You are on: {userTeam.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-2">Team Details</h3>
                <p className="text-sm text-muted-foreground">Team Name: {userTeam.name}</p>
                <p className="text-sm text-muted-foreground">Team ID: {userTeam.id}</p>
                {userTeam.owner_email && (
                  <p className="text-sm text-muted-foreground">Owner: {userTeam.owner_email}</p>
                )}
              </div>
              {userTeam.owner_email === user?.email && (
                <div>
                  <h3 className="font-medium mb-2">Team Owner Actions</h3>
                  <p className="text-sm text-muted-foreground">You are the owner of this team</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Team</CardTitle>
            <CardDescription>You are not on a team yet</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Team Owner Controls */}
      {userTeam && userTeam.owner_email === user?.email && (
        <Card>
          <CardHeader>
            <CardTitle>Team Owner Controls</CardTitle>
            <CardDescription>Manage your team's details.</CardDescription>
          </CardHeader>
          <CardContent>
            <TeamOwnerControls userTeam={userTeam} refetchTeams={refetchTeams} />
          </CardContent>
        </Card>
      )}

      {/* Keeper Management */}
      {userTeam && (
        <KeeperManagement 
          teamId={userTeam.id} 
          season={adminSettings.current_season} 
        />
      )}

      {/* All Teams List */}
      <AllTeamsList teamsData={teamsData} />

      {/* User Team Actions - Moved to the bottom */}
      <UserTeamActions teamsData={teamsData} refetchTeams={refetchTeams} userTeam={userTeam} />
    </div>
  );
};
