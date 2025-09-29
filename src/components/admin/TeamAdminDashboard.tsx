import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTeams } from '@/hooks/useTeams';
import { useAuth } from '@/contexts/AuthContext';
import { useAllProfiles } from '@/hooks/useAllProfiles';
import { Tables } from '@/integrations/supabase/types';

// Define types based on Supabase schema
type Team = Tables<'teams'>;

// Import new components
import { TeamsTable } from '@/components/admin/teams/TeamsTable';
import { AddTeamDialog } from '@/components/admin/teams/AddTeamDialog';
import { EditTeamDialog } from '@/components/admin/teams/EditTeamDialog';
import { ManageRosterDialog } from '@/components/admin/teams/ManageRosterDialog';
import { ManageKeepersDialog } from '@/components/admin/teams/ManageKeepersDialog';
import { UsersTable } from '@/components/admin/users/UsersTable';
import { AddUserDialog } from '@/components/admin/users/AddUserDialog';
import { EditUserDialog } from '@/components/admin/users/EditUserDialog';
import { ConfirmDeleteUserDialog } from '@/components/admin/users/ConfirmDeleteUserDialog';

export const TeamAdminDashboard = () => {
  const { data: teamsData = [], isLoading: isLoadingTeams, refetch: refetchTeams } = useTeams();
  const { data: allProfiles = [], isLoading: isLoadingProfiles, error: profilesError } = useAllProfiles();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingAuth } = useAuth();
  const [loading, setLoading] = useState(false);

  // Team Management Dialog States
  const [isAddTeamDialogOpen, setIsAddTeamDialogOpen] = useState(false);
  const [isEditTeamDialogOpen, setIsEditTeamDialogOpen] = useState(false);
  const [currentEditingTeam, setCurrentEditingTeam] = useState<Team | null>(null);
  const [isRosterDialogOpen, setIsRosterDialogOpen] = useState(false);
  const [isKeeperDialogOpen, setIsKeeperDialogOpen] = useState(false);
  const [currentViewingTeam, setCurrentViewingTeam] = useState<Team | null>(null);

  // User Management Dialog States
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [currentEditingUser, setCurrentEditingUser] = useState<Tables<'profiles'> | null>(null);
  const [isConfirmDeleteUserDialogOpen, setIsConfirmDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Tables<'profiles'> | null>(null);

  // Team Action Handlers
  const handleCreateTeam = async (newTeamName: string, newTeamOwnerEmail: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('teams')
      .insert([{ name: newTeamName, owner_email: newTeamOwnerEmail || null }]);

    if (error) {
      toast({ title: "Error", description: "Failed to create team", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Team created successfully" });
      refetchTeams();
      setIsAddTeamDialogOpen(false);
    }
    setLoading(false);
  };

  const handleEditTeam = (team: Team) => {
    setCurrentEditingTeam(team);
    setIsEditTeamDialogOpen(true);
  };

  const handleUpdateTeam = async (teamId: string, editedTeamName: string, editedTeamOwnerEmail: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('teams')
      .update({ name: editedTeamName, owner_email: editedTeamOwnerEmail || null })
      .eq('id', teamId);

    if (error) {
      toast({ title: "Error", description: "Failed to update team", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Team updated successfully" });
      refetchTeams();
      setIsEditTeamDialogOpen(false);
      setCurrentEditingTeam(null);
    }
    setLoading(false);
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!window.confirm("Are you sure you want to delete this team? This action cannot be undone.")) {
      return;
    }

    setLoading(true);
    const { error } = await supabase.functions.invoke('admin-actions', {
      body: {
        action: 'DELETE_TEAM',
        teamId: teamId,
      },
    });

    if (error) {
      toast({ title: "Error", description: `Failed to delete team: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Team deleted successfully" });
      refetchTeams();
    }
    setLoading(false);
  };

  const handleManageRoster = (team: Team) => {
    setCurrentViewingTeam(team);
    setIsRosterDialogOpen(true);
  };

  const handleManageKeepers = (team: Team) => {
    setCurrentViewingTeam(team);
    setIsKeeperDialogOpen(true);
  };

  // User Action Handlers
  const handleInviteAndAssignUser = async (newUserEmail: string, selectedTeamIdForNewUser: string | null) => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: {
        email: newUserEmail,
        team_id: selectedTeamIdForNewUser // Pass directly as string or null
      },
    });

    if (error) {
      toast({ title: "Error", description: `Failed to invite and assign user: ${error.message}`, variant: "destructive" });
    } else if (data && data.error) {
      toast({ title: "Error", description: `Failed to invite and assign user: ${data.error}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `User ${newUserEmail} invited and assigned to team successfully` });
      setIsAddUserDialogOpen(false);
    }
    setLoading(false);
  };

  const handleRemoveUserFromTeam = async (userId: string) => {
    console.log('Removing user from team:', userId);
    setLoading(true);
    const { error } = await supabase.rpc('unassign_team_owner', { p_user_id: userId });

    if (error) {
      console.error('Error removing user from team:', error);
      toast({ title: "Error", description: `Failed to remove user from team: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "User removed from team successfully" });
      refetchTeams(); // Refetch teams to update owner_email in UI
    }
    setLoading(false);
  };

  const handleEditUser = (user: Tables<'profiles'>) => {
    setCurrentEditingUser(user);
    setIsEditUserDialogOpen(true);
  };

  const handleUpdateUser = async (userId: string, editedUserEmail: string, editedUserTeamId: string | null) => {
    setLoading(true);

    const { error } = await supabase.functions.invoke('admin-actions', {
      body: {
        action: 'ASSIGN_USER_TO_TEAM',
        userId: userId,
        teamId: editedUserTeamId, // Pass directly as string or null
      },
    });

    if (error) {
      toast({ title: "Error", description: `Failed to update user: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `User ${editedUserEmail} updated successfully` });
      setIsEditUserDialogOpen(false);
      setCurrentEditingUser(null);
    }
    setLoading(false);
  };

  const confirmDeleteUser = (user: Tables<'profiles'>) => {
    setUserToDelete(user);
    setIsConfirmDeleteUserDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setLoading(true);
    const { error } = await supabase.functions.invoke('admin-actions', {
      body: {
        action: 'DELETE_USER',
        userId: userToDelete.id,
      },
    });

    if (error) {
      toast({ title: "Error", description: `Failed to delete user: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `User ${userToDelete.email} deleted successfully` });
      setIsConfirmDeleteUserDialogOpen(false);
      setUserToDelete(null);
    }
    setLoading(false);
  };

  if (isLoadingAuth || isLoadingTeams || isLoadingProfiles) {
    return <div>Loading admin dashboard...</div>;
  }

  if (!profile?.is_admin) {
    return <div>Access Denied: You must be an admin to view this page.</div>;
  }

  return (
    <div className="space-y-6">
      <TeamsTable
        teamsData={teamsData}
        handleEditTeam={handleEditTeam}
        handleManageRoster={handleManageRoster}
        handleManageKeepers={handleManageKeepers}
        handleDeleteTeam={handleDeleteTeam}
        setIsAddTeamDialogOpen={setIsAddTeamDialogOpen}
        setIsAddUserDialogOpen={setIsAddUserDialogOpen}
      />

      <UsersTable
        allProfiles={allProfiles}
        teamsData={teamsData}
        handleEditUser={handleEditUser}
        handleRemoveUserFromTeam={handleRemoveUserFromTeam}
        confirmDeleteUser={confirmDeleteUser}
      />

      {/* Team Dialogs */}
      <AddTeamDialog
        isOpen={isAddTeamDialogOpen}
        onOpenChange={setIsAddTeamDialogOpen}
        refetchTeams={refetchTeams}
        allProfiles={allProfiles}
      />
      <EditTeamDialog
        isOpen={isEditTeamDialogOpen}
        onOpenChange={setIsEditTeamDialogOpen}
        refetchTeams={refetchTeams}
        allProfiles={allProfiles}
        currentEditingTeam={currentEditingTeam}
        handleUpdateTeam={handleUpdateTeam}
      />
      <ManageRosterDialog
        isOpen={isRosterDialogOpen}
        onOpenChange={setIsRosterDialogOpen}
        currentViewingTeam={currentViewingTeam}
      />
      <ManageKeepersDialog
        isOpen={isKeeperDialogOpen}
        onOpenChange={setIsKeeperDialogOpen}
        currentViewingTeam={currentViewingTeam}
      />

      {/* User Dialogs */}
      <AddUserDialog
        isOpen={isAddUserDialogOpen}
        onOpenChange={setIsAddUserDialogOpen}
        teamsData={teamsData}
        fetchAllProfiles={() => {}} // Remove dependency on manual fetch
      />
      <EditUserDialog
        isOpen={isEditUserDialogOpen}
        onOpenChange={setIsEditUserDialogOpen}
        teamsData={teamsData}
        fetchAllProfiles={() => {}} // Remove dependency on manual fetch
        currentEditingUser={currentEditingUser}
      />
      <ConfirmDeleteUserDialog
        isOpen={isConfirmDeleteUserDialogOpen}
        onOpenChange={setIsConfirmDeleteUserDialogOpen}
        userToDelete={userToDelete}
        fetchAllProfiles={() => {}} // Remove dependency on manual fetch
      />
    </div>
  );
};
