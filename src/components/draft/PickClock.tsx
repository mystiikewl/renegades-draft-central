import { useEffect, useState } from 'react';

/**
 * Display-only draft clock (backlog P3 #10).
 *
 * The league drafts untimed: the server keeps turn_deadline_at null
 * (see migration 20260827130000_no_pick_timer) and nothing enforces expiry,
 * so this component renders nothing until a deadline is configured — the
 * clock ships dormant and settings-driven. Pause is a draft-flow gate that
 * already exists server-side (set_draft_status 'paused'): while paused the
 * countdown freezes instead of ticking.
 */

export function usePickClock(deadline: string | null | undefined, paused = false): number | null {
  const [seconds, setSeconds] = useState<number | null>(() =>
    deadline ? secondsUntil(deadline) : null,
  );

  // Re-anchor whenever the deadline itself changes (new turn, resume).
  useEffect(() => {
    if (!deadline) {
      setSeconds(null);
      return;
    }
    if (paused) return;
    const tick = () => setSeconds(secondsUntil(deadline));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, paused]);

  return seconds;
}

function secondsUntil(deadline: string): number {
  return Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function PickClock({
  deadline,
  paused = false,
}: {
  deadline: string | null | undefined;
  paused?: boolean;
}) {
  const seconds = usePickClock(deadline, paused);

  if (!deadline) return null;
  if (paused) {
    return (
      <span
        className="flex items-center gap-1.5 rounded-md border bg-background/70 px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums text-muted-foreground"
        data-testid="pick-clock"
        data-state="paused"
      >
        {seconds !== null ? formatClock(seconds) : ''} · Paused
      </span>
    );
  }

  const urgent = seconds !== null && seconds <= 30;
  return (
    <span
      role="timer"
      className={`flex items-center rounded-md border bg-background/70 px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums ${
        urgent ? 'border-destructive/40 text-destructive' : 'text-foreground'
      }`}
      data-testid="pick-clock"
      data-state={urgent ? 'urgent' : 'running'}
    >
      {formatClock(seconds ?? 0)}
    </span>
  );
}
