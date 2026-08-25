import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DraftHero from '@/components/draft/DraftHero';

describe('DraftHero', () => {
  const mockActiveTeams = [
    { teamId: 'team-1', teamName: 'Team 1' },
    { teamId: 'team-2', teamName: 'Team 2' },
  ];

  const mockCurrentPick = {
    id: 'pick-1',
    round: 1,
    pick_number: 1,
    player_id: null,
    original_team_id: 'team-1',
    current_team_id: 'team-1',
    is_used: false,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    player: null,
    original_team: {
      id: 'team-1',
      name: 'Team 1',
      owner_id: 'user-1',
      draft_order: 1,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    },
    current_team: {
      id: 'team-1',
      name: 'Team 1',
      owner_id: 'user-1',
      draft_order: 1,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    },
  };

  const mockDraftStats = {
    totalPicks: 180,
    completedPicks: 45,
    availablePlayers: 1200,
    progress: 25,
  };

  it('renders draft information correctly', () => {
    render(
      <DraftHero
        activeTeams={mockActiveTeams}
        connectionStatus="connected"
        currentPickIndex={0}
        currentPick={mockCurrentPick}
        draftStats={mockDraftStats}
      />
    );

    expect(screen.getByText('Renegades NBA Fantasy')).toBeInTheDocument();
    expect(screen.getByText('2025-26')).toBeInTheDocument();
    expect(screen.getByText('Draft Central')).toBeInTheDocument();
    expect(screen.getByText('Pick #1')).toBeInTheDocument();
    expect(screen.getByText('Team 1 on the clock')).toBeInTheDocument();
  });

  it('displays correct pick number', () => {
    render(
      <DraftHero
        activeTeams={mockActiveTeams}
        connectionStatus="connected"
        currentPickIndex={4}
        currentPick={mockCurrentPick}
        draftStats={mockDraftStats}
      />
    );

    expect(screen.getByText('Pick #5')).toBeInTheDocument();
  });

  it('renders RealTimeStatus component with correct props', () => {
    render(
      <DraftHero
        activeTeams={mockActiveTeams}
        connectionStatus="connected"
        currentPickIndex={0}
        currentPick={mockCurrentPick}
        draftStats={mockDraftStats}
      />
    );

    // Check that the RealTimeStatus component is rendered with the correct props
    // Since we're not mocking the RealTimeStatus component, we can check for its content
    expect(screen.getByText('2 Teams Active')).toBeInTheDocument();
    // Check that the component renders without error
    expect(screen.getByText('Team 1')).toBeInTheDocument();
    expect(screen.getByText('Team 2')).toBeInTheDocument();
  });
});