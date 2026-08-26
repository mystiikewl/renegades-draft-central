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

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

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

describe('Admin workspace', () => {
  it('uses the overview as a workflow launcher instead of rendering every control', () => {
    render(<AdminPage />);

    expect(screen.getByRole('heading', { name: /league administration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Season/i })).toHaveAttribute('href', '/admin/season');
    expect(screen.getByRole('link', { name: /Draft setup & control/i })).toHaveAttribute('href', '/admin/draft');
    expect(screen.getByRole('link', { name: /Draft order/i })).toHaveAttribute('href', '/admin/order');
    expect(screen.getByRole('link', { name: /Keepers/i })).toHaveAttribute('href', '/admin/keepers');
    expect(screen.queryByText('Draft settings form')).not.toBeInTheDocument();
    expect(screen.queryByText('Keeper manager')).not.toBeInTheDocument();
  });

  it('keeps draft lifecycle controls, settings and reset together', () => {
    render(<AdminPage section="draft" />);

    expect(screen.getByRole('heading', { name: /draft setup & control/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start \/ Resume/i })).toBeInTheDocument();
    expect(screen.getByText('Draft settings form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset draft/i })).toBeInTheDocument();
    expect(screen.queryByText('Keeper manager')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Season label/i)).not.toBeInTheDocument();
  });

  it('keeps keeper operations self-contained', () => {
    render(<AdminPage section="keepers" />);

    expect(screen.getByRole('heading', { name: /keeper management/i })).toBeInTheDocument();
    expect(screen.getByText('ESPN roster sync')).toBeInTheDocument();
    expect(screen.getByText('Keeper manager')).toBeInTheDocument();
    expect(screen.queryByText('Draft settings form')).not.toBeInTheDocument();
  });
});
