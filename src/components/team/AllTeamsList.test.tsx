import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AllTeamsList } from '@/components/team/AllTeamsList';

describe('AllTeamsList', () => {
  const mockTeamsData = [
    {
      id: 'team-1',
      name: 'Team 1',
      owner_email: 'owner1@example.com',
    },
    {
      id: 'team-2',
      name: 'Team 2',
      owner_email: 'owner2@example.com',
    },
    {
      id: 'team-3',
      name: 'Team 3',
      owner_email: null,
    },
  ];

  it('renders all teams correctly', () => {
    render(<AllTeamsList teamsData={mockTeamsData} />);

    expect(screen.getByText('All Teams')).toBeInTheDocument();
    expect(screen.getByText('League members and their teams')).toBeInTheDocument();

    // Check that all team names are rendered
    mockTeamsData.forEach((team) => {
      expect(screen.getByText(team.name)).toBeInTheDocument();
    });
  });

  it('displays owner email when available', () => {
    render(<AllTeamsList teamsData={mockTeamsData} />);

    // Check that owner emails are displayed for teams that have them
    expect(screen.getByText('owner1@example.com')).toBeInTheDocument();
    expect(screen.getByText('owner2@example.com')).toBeInTheDocument();
  });

  it('displays "No owner" when owner email is null', () => {
    render(<AllTeamsList teamsData={mockTeamsData} />);

    // Check that "No owner" is displayed for teams without an owner
    expect(screen.getByText('No owner')).toBeInTheDocument();
  });

  it('renders correct number of team items', () => {
    render(<AllTeamsList teamsData={mockTeamsData} />);

    // Check that the correct number of team items are rendered
    const teamItems = screen.getAllByText(/Team \d/);
    expect(teamItems).toHaveLength(3);
  });
});