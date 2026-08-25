import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TeamAdminDashboard } from '@/components/admin/TeamAdminDashboard';

// Mock the Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

// Mock the use-toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock the useTeams hook
vi.mock('@/hooks/useTeams', () => ({
  useTeams: vi.fn(() => ({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

// Mock the useAuth hook
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    profile: {
      id: 'user-1',
      email: 'admin@example.com',
      is_admin: true,
    },
    isLoading: false,
  })),
}));

// Mock child components
vi.mock('@/components/admin/teams/TeamsTable', () => ({
  TeamsTable: () => <div data-testid="teams-table">Teams Table</div>,
}));

vi.mock('@/components/admin/users/UsersTable', () => ({
  UsersTable: () => <div data-testid="users-table">Users Table</div>,
}));

vi.mock('@/components/admin/teams/AddTeamDialog', () => ({
  AddTeamDialog: () => <div>Add Team Dialog</div>,
}));

vi.mock('@/components/admin/teams/EditTeamDialog', () => ({
  EditTeamDialog: () => <div>Edit Team Dialog</div>,
}));

vi.mock('@/components/admin/teams/ManageRosterDialog', () => ({
  ManageRosterDialog: () => <div>Manage Roster Dialog</div>,
}));

vi.mock('@/components/admin/teams/ManageKeepersDialog', () => ({
  ManageKeepersDialog: () => <div>Manage Keepers Dialog</div>,
}));

vi.mock('@/components/admin/users/AddUserDialog', () => ({
  AddUserDialog: () => <div>Add User Dialog</div>,
}));

vi.mock('@/components/admin/users/EditUserDialog', () => ({
  EditUserDialog: () => <div>Edit User Dialog</div>,
}));

vi.mock('@/components/admin/users/ConfirmDeleteUserDialog', () => ({
  ConfirmDeleteUserDialog: () => <div>Confirm Delete User Dialog</div>,
}));

describe('TeamAdminDashboard', () => {
  it('renders without crashing', () => {
    render(<TeamAdminDashboard />);
    
    // Just check that the component renders without crashing
    expect(true).toBe(true);
  });
});