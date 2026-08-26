import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

function Boom({ boom }: { boom: boolean }) {
  if (boom) throw new Error('kaboom');
  return <div>All good</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary label="draft board">
        <Boom boom={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows recovery UI on render error; Try again resets', async () => {
    // Silence React's expected error logging for the intentional throw.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();

    const { rerender } = render(
      <ErrorBoundary label="draft board">
        <Boom boom={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong loading the draft board.')).toBeInTheDocument();
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();

    // Fresh children that no longer throw; then reset the boundary.
    rerender(
      <ErrorBoundary label="draft board">
        <Boom boom={false} />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('All good')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
