import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { PickClock, usePickClock } from './PickClock';

afterEach(cleanup);

describe('PickClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T20:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no deadline is configured (league drafts untimed)', () => {
    const { container } = render(<PickClock deadline={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the remaining time and counts down every second', () => {
    render(<PickClock deadline={new Date(Date.now() + 90_000).toISOString()} />);
    expect(screen.getByRole('timer')).toHaveTextContent('1:30');
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('0:59');
  });

  it('marks the last 30 seconds as urgent', () => {
    render(<PickClock deadline={new Date(Date.now() + 20_000).toISOString()} />);
    const clock = screen.getByRole('timer');
    expect(clock).toHaveTextContent('0:20');
    expect(clock).toHaveAttribute('data-state', 'urgent');
  });

  it('freezes while paused and labels it', () => {
    render(<PickClock deadline={new Date(Date.now() + 60_000).toISOString()} paused />);
    const clock = screen.getByTestId('pick-clock');
    expect(clock).toHaveTextContent('1:00 · Paused');
    act(() => {
      vi.advanceTimersByTime(45_000);
    });
    expect(clock).toHaveTextContent('1:00 · Paused');
  });

  it('clamps at zero instead of going negative', () => {
    render(<PickClock deadline={new Date(Date.now() + 5_000).toISOString()} />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('0:00');
  });

  it('re-anchors when the deadline changes (resume / new turn)', () => {
    const { rerender } = render(<PickClock deadline={new Date(Date.now() + 60_000).toISOString()} />);
    expect(screen.getByRole('timer')).toHaveTextContent('1:00');
    act(() => {
      vi.advanceTimersByTime(50_000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('0:10');
    // Server re-anchors the deadline on resume; a new deadline restarts the clock.
    rerender(<PickClock deadline={new Date(Date.now() + 120_000).toISOString()} />);
    expect(screen.getByRole('timer')).toHaveTextContent('2:00');
  });
});

describe('usePickClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T20:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null without a deadline and seconds with one', () => {
    let valueA: number | null | undefined;
    let valueB: number | null | undefined;
    function Probe() {
      valueA = usePickClock(null);
      valueB = usePickClock(new Date(Date.now() + 42_000).toISOString());
      return null;
    }
    render(<Probe />);
    expect(valueA).toBeNull();
    expect(valueB).toBe(42);
  });
});
