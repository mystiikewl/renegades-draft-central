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

import { LeagueHubPage, MorePage, PlayersHubPage } from './HubPages';

describe('navigation hubs', () => {
  it('groups player discovery into Pool and Rankings', () => {
    render(<PlayersHubPage />);
    expect(screen.getByRole('link', { name: /Player Pool/i })).toHaveAttribute('href', '/pool');
    expect(screen.getByRole('link', { name: /Rankings/i })).toHaveAttribute('href', '/rankings');
  });

  it('groups league activity into Rosters and Trade Center', () => {
    render(<LeagueHubPage />);
    expect(screen.getByRole('link', { name: /Rosters/i })).toHaveAttribute('href', '/rosters');
    expect(screen.getByRole('link', { name: /Trade Center/i })).toHaveAttribute('href', '/trades');
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
