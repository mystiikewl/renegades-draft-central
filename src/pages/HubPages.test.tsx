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
  it('groups league activity into Rosters, Trade Center and Rankings', () => {
    render(<LeagueHubPage />);
    expect(screen.getByRole('link', { name: /Rosters/i })).toHaveAttribute('href', '/rosters');
    expect(screen.getByRole('link', { name: /Trade Center/i })).toHaveAttribute('href', '/trades');
    expect(screen.getByRole('link', { name: /^Rankings / })).toHaveAttribute('href', '/rankings');
    expect(screen.getByRole('link', { name: /^Power Rankings / })).toHaveAttribute('href', '/power-rankings');
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
