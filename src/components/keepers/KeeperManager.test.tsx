import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { KeeperManager } from './KeeperManager';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const useRosters = vi.fn();
const useSeasons = vi.fn();
const useDraftSettings = vi.fn();
vi.mock('@/api/queries', () => ({
  useRosters: (seasonId?: string) => useRosters(seasonId),
  useSeasons: () => useSeasons(),
  useDraftSettings: () => useDraftSettings(),
}));

const mockAssign = vi.fn();
const mockRemove = vi.fn();
vi.mock('@/api/mutations', () => ({
  useAssignKeeper: () => ({ mutate: mockAssign, isPending: false }),
  useRemoveKeeper: () => ({ mutate: mockRemove, isPending: false }),
}));

const SEASON = 'season-2026-27';
const PRIOR = 'season-2025-26';
const TEAM = 'team-1';

function roster(
  id: string,
  team_id: string,
  player_id: string,
  acquisition: 'keeper' | 'draft' | 'trade',
  name: string,
) {
  return { id, season_id: SEASON, team_id, player_id, acquisition, players: { name, position: 'G', nba_team: 'BOS' } };
}

function setup({
  keeperLimit = 9,
  status = 'pre_draft',
  activeRosters = [],
  priorRosters = [],
}: {
  keeperLimit?: number;
  status?: string;
  activeRosters?: ReturnType<typeof roster>[];
  priorRosters?: ReturnType<typeof roster>[];
} = {}) {
  useSeasons.mockReturnValue({
    data: [
      { id: SEASON, label: '2026-27', is_active: true },
      { id: PRIOR, label: '2025-26', is_active: false },
    ],
  });
  useDraftSettings.mockReturnValue({ data: { keeper_limit: keeperLimit, status } });
  useRosters.mockImplementation((seasonId?: string) =>
    seasonId === PRIOR ? { data: priorRosters, isLoading: false } : { data: activeRosters, isLoading: false },
  );

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<KeeperManager seasonId={SEASON} teamId={TEAM} />, { wrapper });
}

beforeEach(() => {
  mockAssign.mockReset();
  mockRemove.mockReset();
  vi.mocked(toast.info).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('KeeperManager', () => {
  it('renders the counter and candidate rows with keep/unkeep state', async () => {
    setup({
      activeRosters: [
        roster('a1', TEAM, 'p1', 'keeper', 'Kept One'),
        roster('a2', 'team-2', 'p4', 'draft', 'Other Team Guy'),
      ],
      priorRosters: [
        roster('b1', TEAM, 'p1', 'draft', 'Kept One'),
        roster('b2', TEAM, 'p2', 'draft', 'Pickable Guy'),
      ],
    });

    expect(screen.getByTestId('keeper-counter')).toHaveTextContent('1 / 9');

    // kept candidate shows a remove control; pickable one shows Keep
    expect(screen.getByTestId('remove-p1')).toBeInTheDocument();
    const keepBtn = screen.getByTestId('assign-p2');
    expect(keepBtn).toBeEnabled();

    await userEvent.click(keepBtn);
    expect(mockAssign).toHaveBeenCalledWith({ teamId: TEAM, playerId: 'p2' });
  });

  it('blocks players already rostered this season on any team', async () => {
    setup({
      activeRosters: [roster('a2', 'team-2', 'p4', 'draft', 'Other Team Guy')],
      priorRosters: [roster('b3', TEAM, 'p4', 'trade', 'Trade Guy')],
    });

    const btn = screen.getByTestId('assign-p4');
    expect(btn).toBeDisabled();
    await userEvent.click(btn).catch(() => {});
    expect(mockAssign).not.toHaveBeenCalled();
    expect(screen.getByText(/unavailable/)).toBeInTheDocument();
  });

  it('enforces the limit client-side: friendly toast instead of an RPC call at the cap', async () => {
    setup({
      keeperLimit: 1,
      activeRosters: [roster('a1', TEAM, 'p1', 'keeper', 'Kept One')],
      priorRosters: [
        roster('b1', TEAM, 'p1', 'draft', 'Kept One'),
        roster('b2', TEAM, 'p2', 'draft', 'Pickable Guy'),
      ],
    });

    expect(screen.getByTestId('keeper-counter')).toHaveTextContent('1 / 1');
    await userEvent.click(screen.getByTestId('assign-p2'));

    expect(toast.info).toHaveBeenCalledWith('Keeper limit reached (1) — remove one before adding another');
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('removes a keeper via the remove RPC', async () => {
    setup({
      activeRosters: [roster('a1', TEAM, 'p1', 'keeper', 'Kept One')],
      priorRosters: [roster('b1', TEAM, 'p1', 'draft', 'Kept One')],
    });

    await userEvent.click(screen.getByTestId('remove-p1'));
    expect(mockRemove).toHaveBeenCalledWith({ teamId: TEAM, playerId: 'p1' });
  });

  it('locks editing once the draft has started', async () => {
    setup({
      status: 'running',
      activeRosters: [roster('a1', TEAM, 'p1', 'keeper', 'Kept One')],
      priorRosters: [
        roster('b1', TEAM, 'p1', 'draft', 'Kept One'),
        roster('b2', TEAM, 'p2', 'draft', 'Pickable Guy'),
      ],
    });

    expect(screen.getByText(/Keepers are locked/)).toBeInTheDocument();
    expect(screen.getByTestId('assign-p2')).toBeDisabled();
    expect(screen.getByTestId('remove-p1')).toBeDisabled();

    await userEvent.click(screen.getByTestId('assign-p2')).catch(() => {});
    expect(mockAssign).not.toHaveBeenCalled();

    // counter still visible for reference
    expect(screen.getByTestId('keeper-counter')).toHaveTextContent('1 / 9');
  });

  it('shows an empty state when the team has no prior-season roster', () => {
    setup({});
    expect(screen.getByText(/No players on this team's 2025-26 roster/)).toBeInTheDocument();
    const list = screen.queryByTestId('keeper-candidates');
    expect(list).not.toBeInTheDocument();
  });

  it('renders teamName in the title when provided', () => {
    useSeasons.mockReturnValue({
      data: [{ id: PRIOR, label: '2025-26', is_active: false }],
    });
    useDraftSettings.mockReturnValue({ data: { keeper_limit: 9, status: 'pre_draft' } });
    useRosters.mockReturnValue({ data: [], isLoading: false });
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <KeeperManager seasonId={SEASON} teamId={TEAM} teamName="F Dem Kids" />
      </QueryClientProvider>,
    );
    expect(within(screen.getByRole('heading', { level: 3 })).getByText(/F Dem Kids/)).toBeInTheDocument();
  });
});
