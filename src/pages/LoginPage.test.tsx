import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginPage } from './LoginPage';

const { signInWithOtp } = vi.hoisted(() => ({ signInWithOtp: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ session: null, loading: false }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp,
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({ error: null });
  });

  it('sends a passwordless sign-in link without allowing account creation', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'manager@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'manager@example.com',
      options: { shouldCreateUser: false },
    });
  });
});
