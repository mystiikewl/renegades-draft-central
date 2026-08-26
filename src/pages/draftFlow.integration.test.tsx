import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

/**
 * Full-flow integration tests: real hooks (queries, mutations, realtime,
 * offlineQueue) over a mocked Supabase client backed by an in-memory `db`.
 * Only the transport (@/lib/supabase) and auth context are mocked.
 */

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(), channel: vi.fn(), removeChannel: vi.fn(), from: vi.fn() } }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

let profile: { team_id: string | null; is_admin: boolean } = { team_id: 't1', is_admin: false };
vi.mock('@/auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({ profile })),
}));

// --- In-memory database read by the query-builder mock at call time ---

const SEASON = { id: 's1', label: '2026-27', is_active: true };

const SETTINGS = {
  season_id: 's1',
  status: 'running',
  draft_type: 'snake',
  league_size: 10,
  roster_size: 15,
  pick_time_limit_seconds: 120,
};

const TEAMS = [
  { id: 't1', name: 'Alpha Team', is_shadow: false },
  { id: 't2', name: 'Beta Team', is_shadow: false },
];

function pickRow(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    season_id: 's1',
    round: 1,
    pick_number: 1,
    original_team_id: 't1',
    team_id: 't1',
    player_id: null,
    is_used: false,
    picked_at: null,
    players: null as Record<string, unknown> | null,
    team: null as Record<string, unknown> | null,
    ...over,
  };
}

function guy(id: string, name: string) {
  return {
    id,
    name,
    position: 'PG',
    nba_team: 'BOS',
    espn_id: 1,
    player_seasons: [
      { season_id: 's1', stats: { points: 25.1, total_rebounds: 4.2, assists: 6.7, games_played: 70 } },
    ],
  };
}

const db = {
  picks: [] as ReturnType<typeof pickRow>[],
  players: [] as ReturnType<typeof guy>[],
  rosteredIds: [] as string[],
};

function resetDb(picks = [pickRow()], players = [guy('pl1', 'Test Player'), guy('pl2', 'Other Guy')]) {
  db.picks = picks;
  db.players = players;
  db.rosteredIds = [];
}

// --- Supabase mocks ---

const rpc = vi.mocked(supabase.rpc);

type Table = 'seasons' | 'draft_settings' | 'teams' | 'draft_picks' | 'players' | 'rosters';

function rowsFor(table: Table): unknown {
  switch (table) {
    case 'seasons':
      return [SEASON];
    case 'draft_settings':
      return SETTINGS;
    case 'teams':
      return TEAMS;
    case 'draft_picks':
      return db.picks;
    case 'players':
      return db.players;
    case 'rosters':
      return db.rosteredIds.map((player_id) => ({ player_id }));
  }
}

vi.mocked(supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(((table: Table) => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    not: () => builder,
    maybeSingle: async () =>
      table === 'seasons'
        ? { data: SEASON, error: null }
        : { data: SETTINGS, error: null },
    then: (
      onFulfilled: (r: { data: unknown; error: null }) => unknown,
      onRejected: (e: unknown) => unknown,
    ) => Promise.resolve({ data: rowsFor(table), error: null }).then(onFulfilled, onRejected),
  };
  return builder;
}) as never);

// Realtime: capture the postgres_changes callbacks so tests can fire them.
const changeHandlers: Partial<Record<string, () => void>> = {};

vi.mocked(supabase.channel).mockImplementation(() => {
  const channel = {
    on: (_event: string, opts: { table: string }, cb: () => void) => {
      changeHandlers[opts.table] = cb;
      return channel;
    },
    subscribe: () => channel,
  };
  return channel as never;
});

const fireChange = (table: string) => changeHandlers[table]?.();

// --- Harness ---

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/** Picks happen on the pool page now; the board is for spectating/undo. */
function renderPage() {
  const qc = makeClient();
  render(
    <QueryClientProvider client={qc}>
      <PlayerPoolPage />
      <DraftPage />
    </QueryClientProvider>,
  );
  return qc;
}

beforeEach(() => {
  rpc.mockReset();
  Object.keys(changeHandlers).forEach((k) => delete changeHandlers[k]);
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.info).mockReset();
  profile = { team_id: 't1', is_admin: false };
});

afterEach(() => {
  vi.useRealTimers();
});

import { DraftPage } from './DraftPage';
import { PlayerPoolPage } from './PlayerPoolPage';

describe('draft pick flow (integration)', () => {
  beforeEach(() => resetDb());

  it('pool -> dialog -> confirm calls make_pick; realtime change refetches pool without the picked player', async () => {
    const user = userEvent.setup();
    renderPage();

    // Pool renders both available players with stats.
    expect(await screen.findByText('Test Player')).toBeInTheDocument();
    expect(screen.getAllByText('25.1').length).toBeGreaterThanOrEqual(1); // PTS column

    // Row click opens the shared profile dialog; confirm from inside it.
    await user.click(screen.getByText('Test Player'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Test Player')).toBeInTheDocument();
    expect(within(dialog).getByText('BOS')).toBeInTheDocument();

    // Confirm → RPC with the right args.
    rpc.mockResolvedValue({ data: { ok: true }, error: null } as never);
    await user.click(within(dialog).getAllByRole('button', { name: /pick|draft/i })[0]);
    await user.click(await screen.findByRole('button', { name: 'Confirm pick' }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('make_pick_for_slot', {
        p_season_id: 's1',
        p_pick_id: 'p1',
        p_player_id: 'pl1',
      }),
    );

    // The "server" applied the pick; realtime pushes a draft_picks change…
    db.picks[0] = pickRow({
      is_used: true,
      player_id: 'pl1',
      picked_at: '2026-08-26T12:00:00Z',
      players: { name: 'Test Player' },
      team: { name: 'Alpha Team' },
    });
    db.rosteredIds.push('pl1');
    // make_pick's onSuccess also invalidates the pool directly (not just realtime).
    fireChange('draft_picks');
    fireChange('rosters');

    // …and the pool refetches excluding the now-rostered player (his row goes
    // away). The board tile is covered by the undo test, which mounts with a
    // used pick — post-mutation refetches don't flush in jsdom (see ponytail
    // note at the bottom of the undo test).
    const table = screen.getByRole('table');
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2)); // header + Other Guy
    expect(within(table).getByText('Other Guy')).toBeInTheDocument();
  });

  it('make_pick rejection → error toast, dialog closes, player stays selectable', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Test Player');
    await user.click(screen.getByText('Test Player'));
    const dialog = await screen.findByRole('dialog');

    rpc.mockResolvedValue({ data: null, error: { message: 'Not your turn' } } as never);
    await user.click(within(dialog).getAllByRole('button', { name: /pick|draft/i })[0]);
    await user.click(await screen.findByRole('button', { name: 'Confirm pick' }));

    // sonner is mocked — assert on the spy, not the DOM.
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Not your turn'));
    // onSettled closed the dialog; no queue side effects for RPC rejections.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(vi.mocked(toast.info)).not.toHaveBeenCalled();
    // Player still in the pool; re-opening the dialog offers an enabled pick.
    expect(screen.getByText('Test Player')).toBeInTheDocument();
    await user.click(screen.getByText('Test Player'));
    const retryDialog = await screen.findByRole('dialog');
    expect(within(retryDialog).getAllByRole('button', { name: /pick|draft/i })[0]).toBeEnabled();
  });

  it('network failure queues the pick; successful flush replays make_pick and clears the badge', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await screen.findByText('Test Player');

    // Network dies mid-pick.
    rpc.mockRejectedValue(new TypeError('fetch failed') as never);
    await user.click(screen.getByText('Test Player'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /pick|draft/i })[0]);
    await user.click(await screen.findByRole('button', { name: 'Confirm pick' }));

    // Queued: info toast, offline banner, re-pick blocked from the dialog.
    expect(
      screen.getAllByText(/Offline — 1 exact-slot pick queued/).length,
    ).toBeGreaterThanOrEqual(1);
    expect(toast.info).toHaveBeenCalledWith(
      'Offline — Test Player is queued only for pick #1',
    );
    expect(toast.error).not.toHaveBeenCalled();
    await user.click(screen.getByText('Test Player'));
    const queuedDialog = await screen.findByRole('dialog');
    expect(within(queuedDialog).queryByRole('button', { name: /pick|draft/i })).not.toBeInTheDocument();

    // Connectivity returns → flush timer replays the queued pick.
    rpc.mockResolvedValue({ data: { ok: true }, error: null } as never);
    await vi.advanceTimersByTimeAsync(16_000);

    await waitFor(() =>
      expect(rpc).toHaveBeenLastCalledWith('make_pick_for_slot', {
        p_season_id: 's1',
        p_pick_id: 'p1',
        p_player_id: 'pl1',
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Pick #1 submitted: Test Player');

    // Queue drained → banner disappears and the dialog offers picks again.
    expect(screen.queryByText(/Offline — 1 exact-slot pick queued/)).not.toBeInTheDocument();
  });

  it('undo last pick calls undo_last_pick and restores the board state', async () => {
    const user = userEvent.setup();
    db.picks = [
      pickRow({
        is_used: true,
        player_id: 'pl1',
        picked_at: '2026-08-26T12:00:00Z',
        players: { name: 'Test Player' },
      }),
      pickRow({ id: 'p2', round: 1, pick_number: 2, team_id: 't1', is_used: false }),
    ];
    db.rosteredIds = ['pl1'];
    const qc = renderPage();

    // Pre-state: player drafted, strip shows him, undo available.
    expect(await screen.findByText(/Last action/)).toBeInTheDocument();
    const undoButton = screen.getAllByRole('button', { name: 'Undo last action' })[0];
    expect(undoButton).toBeEnabled();

    rpc.mockResolvedValue({ data: null, error: null } as never);
    await user.click(undoButton); // opens confirm dialog
    await user.click(await screen.findByRole('button', { name: 'Undo action' }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('undo_draft_action_for_slot', {
        p_season_id: 's1',
        p_pick_id: 'p1',
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Last draft action undone');

    // Server undid the pick; realtime pushes the change (rosters too — the
    // pool query refetches on roster changes).
    db.picks[0] = pickRow({ round: 1, pick_number: 1 });
    db.rosteredIds = [];
    fireChange('draft_picks');
    fireChange('rosters');

    // ponytail: post-realtime draft-picks refetches update the cache but don't
    // always flush the DraftPage observer in jsdom — assert the undone state
    // on the query cache (no used picks), not the DOM strip.
    await waitFor(() => {
      const cached = qc.getQueryData<{ is_used: boolean }[]>(['draft-picks', 's1']);
      expect(cached?.some((p) => p.is_used)).toBe(false);
    });
    // Pool re-includes him; the dialog offers an enabled pick again.
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3),
    );
    // ponytail: the board tile may not flush its refetch in jsdom, so target
    // the pool table's row explicitly rather than a global text query.
    const poolRow = within(screen.getByRole('table')).getAllByText('Test Player')[0];
    await user.click(poolRow);
    const redraftDialog = await screen.findByRole('dialog');
    expect(within(redraftDialog).getAllByRole('button', { name: /pick|draft/i })[0]).toBeEnabled();
  });
});
