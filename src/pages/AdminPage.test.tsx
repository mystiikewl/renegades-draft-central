import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const season = { id: 'season-1', label: '2026-27' };
const settings = {
  status: 'pre_draft',
  draft_order: ['team-1'],
  league_size: 10,
  roster_size: 13,
  keeper_limit: 9,
};
const teams = [{ id: 'team-1', name: 'Alpha Team', owner_profile_id: 'owner-1' }];

vi.mock('@/api/queries', () => ({
  useActiveSeason: () => ({ data: season }),
  useDraftSettings: () => ({ data: settings }),
  useDraftPicks: () => ({ data: [] }),
  useRosters: () => ({ data: [] }),
  useTeams: () => ({ data: teams }),
}));

vi.mock('@/api/mutations', () => ({
  useCreateSeason: () => ({ mutate: vi.fn(), isPending: false }),
  useFinalizeKeepers: () => ({ mutate: vi.fn(), isPending: false }),
  useResetDraft: () => ({ mutate: vi.fn(), isPending: false }),
  useSetTeamColor: () => ({ mutate: vi.fn(), isPending: false }),
  useSetDraftOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useSetDraftStatus: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/components/admin/SyncEspnKeepersCard', () => ({
  SyncEspnKeepersCard: () => <div>ESPN roster sync</div>,
}));

vi.mock('@/components/admin/DraftSettingsCard', () => ({
  DraftSettingsCard: () => <div>Draft settings form</div>,
}));

vi.mock('@/components/keepers/KeeperManager', () => ({
  KeeperManager: () => <div>Keeper manager</div>,
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  KeyboardSensor: class {},
  PointerSensor: class {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  arrayMove: vi.fn(),
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, transition: '', isDragging: false }),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({ CSS: { Transform: { toString: () => '' } } }));

import { AdminPage } from './AdminPage';

afterEach(cleanup);

describe('AdminPage', () => {
  it('groups commissioner workflows into a scannable control room', () => {
    render(<AdminPage />);

    expect(screen.getByRole('heading', { name: /commissioner control room/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /season setup/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /draft room/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /keeper operations/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /danger zone/i, level: 2 })).toBeInTheDocument();
  });

  it('gives the commissioner a saved colour control for each team', () => {
    render(<AdminPage />);

    expect(screen.getByRole('heading', { name: /team colours/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Alpha Team colour')).toHaveAttribute('type', 'color');
  });
});
