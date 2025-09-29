import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserCard } from './UserCard';
import { UserTableRow } from './UserTableRow';
import { UserSearchFilter } from './UserSearchFilter';
import { MobileTable } from '@/components/admin/shared/MobileTable';
import { LoadingSkeleton } from '@/components/admin/shared/LoadingSkeleton';
import { ErrorBoundary } from '@/components/admin/shared/ErrorBoundary';
import { cn } from '@/lib/utils';
import { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface Team {
  id: string;
  name: string;
  owner_email: string | null;
}

interface UsersTableProps {
  allProfiles: Profile[];
  teamsData: Team[];
  handleEditUser: (user: Profile) => void;
  handleRemoveUserFromTeam: (userId: string) => void;
  confirmDeleteUser: (user: Profile) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Enhanced UsersTable component with mobile-first design
 *
 * Features:
 * - Responsive design that switches between table and card layouts
 * - Integrated search and filtering
 * - Touch interactions and swipe gestures
 * - Loading states and error handling
 * - Team assignment display
 * - Accessibility support
 */
export const UsersTable = React.memo(({
  allProfiles,
  teamsData,
  handleEditUser,
  handleRemoveUserFromTeam,
  confirmDeleteUser,
  isLoading = false,
  error = null,
}: UsersTableProps) => {
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>(allProfiles);

  // Update filtered users when data changes
  React.useEffect(() => {
    setFilteredUsers(allProfiles);
  }, [allProfiles]);

  // Memoized action handlers
  const actionHandlers = useMemo(() => ({
    onEdit: handleEditUser,
    onRemoveFromTeam: handleRemoveUserFromTeam,
    onDelete: (userId: string) => {
      const user = allProfiles.find(u => u.id === userId);
      if (user) confirmDeleteUser(user);
    },
  }), [handleEditUser, handleRemoveUserFromTeam, confirmDeleteUser, allProfiles]);

  // Get team information for a user
  const getUserTeam = (user: Profile) => {
    if (!user.team_id) return undefined;
    return teamsData.find(team => team.id === user.team_id);
  };

  // Render loading state
  if (isLoading) {
    return (
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle>League Users Overview</CardTitle>
          <CardDescription>Loading users...</CardDescription>
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
          <CardTitle>League Users Overview</CardTitle>
          <CardDescription>Error loading users</CardDescription>
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
          <CardTitle>League Users Overview</CardTitle>
          <CardDescription>Manage all user accounts in the league.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Search and Filter */}
          <UserSearchFilter
            users={allProfiles}
            teams={teamsData}
            onFilteredUsers={setFilteredUsers}
          />

          {/* Users Display */}
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 opacity-50">
                👥
              </div>
              <p className="text-lg font-medium">
                {allProfiles.length === 0 ? 'No users found' : 'No users match your filters'}
              </p>
              <p className="text-sm">
                {allProfiles.length === 0
                  ? 'Start by adding your first user'
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
                    <TableHead className="font-semibold">User Email</TableHead>
                    <TableHead className="font-semibold">Team</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <UserTableRow
                      key={user.id}
                      user={user}
                      team={getUserTeam(user)}
                      onEdit={actionHandlers.onEdit}
                      onDelete={actionHandlers.onDelete}
                      onRemoveFromTeam={actionHandlers.onRemoveFromTeam}
                    />
                  ))}
                </TableBody>
              </Table>

              {/* Card Layout */}
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    team={getUserTeam(user)}
                    onEdit={actionHandlers.onEdit}
                    onDelete={actionHandlers.onDelete}
                    onRemoveFromTeam={actionHandlers.onRemoveFromTeam}
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

UsersTable.displayName = 'UsersTable';
