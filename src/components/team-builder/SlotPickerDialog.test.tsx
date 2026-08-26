import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlayerWithStats } from '@/api/types';
import type { CategoryImpact } from '@/lib/projections';

vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));

import { SlotPickerDialog } from './SlotPickerDialog';

const player = {
  id: 'p1',
  espn_id: '123',
  name: 'Test Guard',
  position: 'PG',
  nba_team: 'BOS',
  image_url: null,
  created_at: '',
  player_seasons: [
    {
      season_id: 's1',
      stats: {
        points: 24.5,
        total_rebounds: 4.1,
        assists: 7.2,
        games_played: 70,
      },
    },
  ],
} as PlayerWithStats;

const impact: CategoryImpact[] = [
  { cat: 'pts', before: 100, after: 110, delta: 10, flipsVsBaseline: true },
  { cat: 'to', before: 50, after: 48, delta: -2, flipsVsBaseline: false },
  { cat: 'fgPct', before: 0.48, after: 0.46, delta: -0.02, flipsVsBaseline: false },
];

describe('SlotPickerDialog', () => {
  it('summarises candidate fit instead of rendering every raw category delta', () => {
    render(
      <SlotPickerDialog
        open
        onOpenChange={vi.fn()}
        pool={[player]}
        current={null}
        impactFor={() => impact}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByText('Test Guard')).toBeInTheDocument();
    expect(screen.getByText(/24.5 PTS/)).toBeInTheDocument();
    expect(screen.getByText('+1 fit')).toBeInTheDocument();
    expect(screen.getByText('boosts PTS')).toBeInTheDocument();
    expect(screen.getByText('watch FG%')).toBeInTheDocument();
    expect(screen.queryByText(/pts \+10/i)).not.toBeInTheDocument();
  });

  it('selects a player and closes the picker', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SlotPickerDialog
        open
        onOpenChange={onOpenChange}
        pool={[player]}
        current={null}
        onPick={onPick}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Test Guard/i }));
    expect(onPick).toHaveBeenCalledWith(player);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
