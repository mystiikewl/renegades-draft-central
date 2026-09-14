import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AdminLogEntry } from '@/api/types';

const entries: AdminLogEntry[] = [
  {
    id: 2,
    at: new Date(Date.now() - 5 * 60_000).toISOString(),
    actor: 'u1',
    action: 'finalize_keepers',
    payload: { dropped: 40, rounds: 9, draft_type: 'linear' },
    profiles: { display_name: 'ataha91' },
  },
  {
    id: 1,
    at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    actor: 'u1',
    action: 'set_draft_status',
    payload: { from: 'pre_draft', to: 'paused' },
    profiles: { display_name: 'ataha91' },
  },
];

vi.mock('@/api/queries', () => ({
  useAdminLog: () => ({ data: entries, isLoading: false }),
}));

import { AdminLogCard } from './AdminLogCard';

afterEach(cleanup);

describe('AdminLogCard', () => {
  it('renders friendly labels, details and actors for each entry', () => {
    render(<AdminLogCard />);

    expect(screen.getByText('Keepers finalized')).toBeInTheDocument();
    expect(screen.getByText('40 dropped · 9 rounds · linear')).toBeInTheDocument();
    expect(screen.getByText('Draft status')).toBeInTheDocument();
    expect(screen.getByText('pre_draft → paused')).toBeInTheDocument();
    expect(screen.getAllByText(/ataha91/)).toHaveLength(2);
    expect(screen.getByText(/5m ago/)).toBeInTheDocument();
    expect(screen.getByText(/2h ago/)).toBeInTheDocument();
  });
});
