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

// Fit summary arithmetic for this fixture (see fitScore in SlotPickerDialog):
//   pts:   gap 5 -> need 1.5, scale 5.25, +10 -> 1.905*1.5 + flip 1 = 3.857
//   to:    gap 0 -> need 0.35, scale 2.5, -2 (inverted) -> 0.8*0.35 = 0.28
//   fgPct: pct scale 0.01, -0.02 -> -2*0.35 = -0.7
//   total = 3.44 -> "+3.4 fit"
const impact: CategoryImpact[] = [
  { cat: 'pts', before: 100, after: 110, baseline: 105, delta: 10, flipsVsBaseline: true },
  { cat: 'to', before: 50, after: 48, baseline: 50, delta: -2, flipsVsBaseline: false },
  { cat: 'fgPct', before: 0.48, after: 0.46, baseline: 0.48, delta: -0.02, flipsVsBaseline: false },
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
    expect(screen.getByText('+3.4 fit')).toBeInTheDocument();
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
