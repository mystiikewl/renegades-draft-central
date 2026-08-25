import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthForm } from '@/components/AuthForm';
import { AuthProvider } from '@/contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Mock window.matchMedia for use-mobile hook
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock the Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      onAuthStateChange: vi.fn().mockImplementation((callback) => {
        // Mock the subscription object
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('AuthForm', () => {
  it('renders sign in and sign up tabs', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <AuthForm />
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
  });

  it('allows user to switch between sign in and sign up', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <AuthForm />
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Password')).toBeInTheDocument();

    // Switch to sign in
    const signinTab = screen.getByText('Sign In');
    fireEvent.click(signinTab);

    // Should still show email and password fields
    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });
  });
});