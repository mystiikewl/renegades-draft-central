import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import type { DraftSettings } from '@/api/types';
import { DraftSettingsCard } from './DraftSettingsCard';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockSave = vi.fn();
vi.mock('@/api/mutations', () => ({
  useUpdateDraftSettings: () => ({ mutate: mockSave, isPending: false }),
}));

const SEASON = 'season-1';

function settings(overrides: Partial<DraftSettings> = {}): DraftSettings {
  return {
    id: 'ds-1',
    season_id: SEASON,
    league_size: 10,
    roster_size: 13,
    keeper_limit: 9,
    draft_type: 'snake',
    pick_time_limit_seconds: 120,
    status: 'pre_draft',
    draft_order: [],
    updated_at: '2026-08-26T00:00:00Z',
    ...overrides,
  };
}

function setup(overrides: Partial<DraftSettings> = {}) {
  return render(<DraftSettingsCard seasonId={SEASON} settings={settings(overrides)} />);
}

beforeEach(() => {
  mockSave.mockReset();
});

describe('DraftSettingsCard', () => {
  it('renders the current values', () => {
    setup({ league_size: 12, roster_size: 14, keeper_limit: 8, pick_time_limit_seconds: 90 });

    expect(screen.getByTestId('ds-league')).toHaveValue(12);
    expect(screen.getByTestId('ds-roster')).toHaveValue(14);
    expect(screen.getByTestId('ds-keeper')).toHaveValue(8);
    expect(screen.getByTestId('ds-time')).toHaveValue(90);
    expect(screen.getByTestId('ds-type')).toHaveTextContent('Snake');
    expect(screen.getByTestId('ds-save')).toBeEnabled();
  });

  it('rejects keeper_limit > roster_size via zod and does not save', async () => {
    setup({ roster_size: 10, keeper_limit: 9 });

    const keeper = screen.getByTestId('ds-keeper');
    await userEvent.clear(keeper);
    await userEvent.type(keeper, '11');
    await userEvent.click(screen.getByTestId('ds-save'));

    expect(mockSave).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot exceed roster size/i)).toBeInTheDocument();
  });

  it('is read-only with an explanation when the draft has started', async () => {
    setup({ status: 'running' });

    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    for (const id of ['ds-league', 'ds-roster', 'ds-keeper', 'ds-time']) {
      expect(screen.getByTestId(id)).toBeDisabled();
    }
    expect(screen.queryByTestId('ds-save')).not.toBeInTheDocument();

    await userEvent.type(screen.getByTestId('ds-league'), '15').catch(() => {});
    expect(mockSave).not.toHaveBeenCalled();
  });
});
