import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

let isAdmin = false;
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ profile: { team_id: 't1', is_admin: isAdmin } }),
}));

import { LeagueHubPage, MorePage } from './HubPages';

describe('navigation hubs', () => {
  it('makes Draft Intelligence the front door to the analysis suite', () => {
    render(<LeagueHubPage />);
    expect(screen.getByRole('link', { name: /Draft Intelligence/i })).toHaveAttribute('href', '/analysis');
    expect(screen.getByRole('link', { name: /Rosters/i })).toHaveAttribute('href', '/rosters');
    expect(screen.getByRole('link', { name: /Trade Center/i })).toHaveAttribute('href', '/trades');
    expect(screen.getByRole('link', { name: /League Forecast/i })).toHaveAttribute('href', '/power-rankings');
  });

  it('does not duplicate analysis tools under More', () => {
    render(<MorePage />);
    expect(screen.queryByRole('link', { name: /Team Builder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Player Lab/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Practice Draft/i })).toHaveAttribute('href', '/practice-draft');
  });

  it('keeps Admin secondary and only exposes it to admins', () => {
    isAdmin = false;
    const { rerender } = render(<MorePage />);
    expect(screen.queryByRole('link', { name: /Admin/i })).not.toBeInTheDocument();

    isAdmin = true;
    rerender(<MorePage />);
    expect(screen.getByRole('link', { name: /Admin/i })).toHaveAttribute('href', '/admin');
  });
});
