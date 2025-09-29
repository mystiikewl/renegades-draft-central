import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TeamCard } from './TeamCard';
import { TeamTableRow } from './TeamTableRow';
import { TeamSearchFilter } from './TeamSearchFilter';
import { MobileTable } from '@/components/admin/shared/MobileTable';
import { LoadingSkeleton } from '@/components/admin/shared/LoadingSkeleton';
import { ErrorBoundary } from '@/components/admin/shared/ErrorBoundary';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface TeamsTableProps {
  teamsData: Team[];
  handleEditTeam: (team: Team) => void;
  handleManageRoster: (team: Team) => void;
  handleManageKeepers: (team: Team) => void;
  handleDeleteTeam: (teamId: string) => void;
  setIsAddTeamDialogOpen: (isOpen: boolean) => void;
  setIsAddUserDialogOpen: (isOpen: boolean) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Enhanced TeamsTable component with mobile-first design
 *
 * Features:
 * - Responsive design that switches between table and card layouts
 * - Integrated search and filtering
 * - Touch interactions and swipe gestures
 * - Loading states and error handling
 * - Accessibility support
 * - Real-time updates ready
 */
export const TeamsTable = React.memo(({
  teamsData,
  handleEditTeam,
  handleManageRoster,
  handleManageKeepers,
  handleDeleteTeam,
  setIsAddTeamDialogOpen,
  setIsAddUserDialogOpen,
  isLoading = false,
  error = null,
}: TeamsTableProps) => {
  const [filteredTeams, setFilteredTeams] = useState<Team[]>(teamsData);

  // Update filtered teams when data changes
  React.useEffect(() => {
    setFilteredTeams(teamsData);
  }, [teamsData]);

  // Memoized action handlers
  const actionHandlers = useMemo(() => ({
    onEdit: handleEditTeam,
    onManageRoster: handleManageRoster,
    onManageKeepers: handleManageKeepers,
    onDelete: handleDeleteTeam,
  }), [handleEditTeam, handleManageRoster, handleManageKeepers, handleDeleteTeam]);

  // Render loading state
  if (isLoading) {
    return (
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle>League Teams Overview</CardTitle>
          <CardDescription>Loading teams...</CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton variant="table" rows={3} />
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle>League Teams Overview</CardTitle>
          <CardDescription>Error loading teams</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <ErrorBoundary>
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle>League Teams Overview</CardTitle>
          <CardDescription>Manage all fantasy teams in the league.</CardDescription>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => setIsAddTeamDialogOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add New Team
            </Button>
            <Button
              onClick={() => setIsAddUserDialogOpen(true)}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add New User
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Search and Filter */}
          <TeamSearchFilter
            teams={teamsData}
            onFilteredTeams={setFilteredTeams}
          />

          {/* Teams Display */}
          {filteredTeams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 opacity-50">
                🏀
              </div>
              <p className="text-lg font-medium">
                {teamsData.length === 0 ? 'No teams found' : 'No teams match your filters'}
              </p>
              <p className="text-sm">
                {teamsData.length === 0
                  ? 'Start by adding your first team'
                  : 'Try adjusting your search or filters'
                }
              </p>
            </div>
          ) : (
            <MobileTable layout="auto">
              {/* Table Layout */}
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-semibold">Team Name</TableHead>
                    <TableHead className="font-semibold">Owner Email</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeams.map((team) => (
                    <TeamTableRow
                      key={team.id}
                      team={team}
                      onEdit={actionHandlers.onEdit}
                      onDelete={actionHandlers.onDelete}
                      onManageRoster={actionHandlers.onManageRoster}
                      onManageKeepers={actionHandlers.onManageKeepers}
                    />
                  ))}
                </TableBody>
              </Table>

              {/* Card Layout */}
              <div className="space-y-3">
                {filteredTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onEdit={actionHandlers.onEdit}
                    onDelete={actionHandlers.onDelete}
                    onManageRoster={actionHandlers.onManageRoster}
                    onManageKeepers={actionHandlers.onManageKeepers}
                  />
                ))}
              </div>
            </MobileTable>
          )}
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
});

TeamsTable.displayName = 'TeamsTable';
