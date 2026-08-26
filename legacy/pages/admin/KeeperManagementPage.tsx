import React, { useState, useEffect } from 'react';
import { KeeperManagement } from '@/components/KeeperManagement';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTeams } from '@/hooks/useTeams';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Users, Calendar } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const KeeperManagementPage: React.FC = () => {
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(undefined);
  const [currentSeason, setCurrentSeason] = useState<string>('2025-26');
  const { data: teamsData = [], isLoading: isLoadingTeams } = useTeams();

  useEffect(() => {
    if (!isLoadingTeams && teamsData.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teamsData[0].id);
    }
  }, [teamsData, isLoadingTeams, selectedTeamId]);

  if (isLoadingTeams) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-96" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Keeper Management</h1>
          <p className="text-muted-foreground">Manage keepers for all teams.</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Keeper Configuration
            </CardTitle>
            <CardDescription>Select a team and season to manage keepers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertTitle>Keeper Management</AlertTitle>
              <AlertDescription>
                Select a team to view and manage their keeper players. Keepers are players that teams retain from the previous season.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="team-select" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Select Team
                </Label>
                <Select onValueChange={setSelectedTeamId} value={selectedTeamId}>
                  <SelectTrigger id="team-select">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamsData.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="season-input" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Season
                </Label>
                <Input
                  id="season-input"
                  type="text"
                  value={currentSeason}
                  onChange={(e) => setCurrentSeason(e.target.value)}
                  placeholder="Enter season (e.g., 2025-26)"
                />
              </div>
            </div>

            {selectedTeamId && (
              <div className="pt-4">
                <KeeperManagement 
                  teamId={selectedTeamId} 
                  season={currentSeason} 
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Button asChild variant="outline">
            <Link to="/admin/draft">Back to Draft Admin Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default KeeperManagementPage;
