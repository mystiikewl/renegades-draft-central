import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePickClock, formatClock } from './PickClock';

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const LIMIT = 60;

function isoSecondsAgo(seconds: number) {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

describe('usePickClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down from the anchor toward the limit', () => {
    // One stable anchor string — a fresh per-render string would retrigger
    // the anchor effect and reset the countdown.
    const anchor = isoSecondsAgo(20);
    const { result, rerender } = renderHook(
      (props: { pickKey: number; anchoredAt: string; running: boolean }) =>
        usePickClock({ ...props, limitSeconds: LIMIT }),
      { initialProps: { pickKey: 1, anchoredAt: anchor, running: true } },
    );
    // 20s already elapsed since the anchor.
    expect(result.current).toBeCloseTo(40, 0);

    tick(5000);
    rerender({ pickKey: 1, anchoredAt: anchor, running: true });
    expect(result.current).toBeLessThanOrEqual(35.1);
    expect(result.current).toBeGreaterThan(34);
  });

  it('freezes while paused and resumes from the frozen remainder', () => {
    const anchor = isoSecondsAgo(0);
    const { result, rerender } = renderHook(
      (props: { pickKey: number; anchoredAt: string; running: boolean }) =>
        usePickClock({ ...props, limitSeconds: LIMIT }),
      { initialProps: { pickKey: 1, anchoredAt: anchor, running: true } },
    );
    expect(result.current).toBeCloseTo(LIMIT, 0);

    tick(10_000);
    rerender({ pickKey: 1, anchoredAt: anchor, running: false });
    expect(result.current).toBeCloseTo(50, 0);

    // Time passes while paused — remaining must not move.
    tick(30_000);
    rerender({ pickKey: 1, anchoredAt: anchor, running: false });
    expect(result.current).toBeCloseTo(50, 0);

    // Resume: continues from the frozen remainder, not from the anchor.
    tick(5000);
    rerender({ pickKey: 1, anchoredAt: anchor, running: true });
    expect(result.current).toBeCloseTo(50, 0);
    tick(10_000);
    expect(result.current).toBeCloseTo(40, 0);
  });

  it('resets to the full limit on a new pick', () => {
    const { result, rerender } = renderHook(
      (props: { pickKey: number; anchoredAt: string; running: boolean }) =>
        usePickClock({ ...props, limitSeconds: LIMIT }),
      { initialProps: { pickKey: 1, anchoredAt: isoSecondsAgo(40), running: true } },
    );
    expect(result.current).toBeCloseTo(20, 0);

    // Next pick lands now → fresh full clock.
    rerender({ pickKey: 2, anchoredAt: new Date().toISOString(), running: true });
    expect(result.current).toBeCloseTo(LIMIT, 0);
  });

  it('clamps at zero when expired', () => {
    const { result } = renderHook(() =>
      usePickClock({
        pickKey: 1,
        anchoredAt: isoSecondsAgo(LIMIT + 10),
        limitSeconds: LIMIT,
        running: true,
      }),
    );
    expect(result.current).toBe(0);
  });
});

describe('formatClock', () => {
  it('formats minutes:seconds, ceil, zero-padded', () => {
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(9.1)).toBe('0:10');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-5)).toBe('0:00');
  });
});
