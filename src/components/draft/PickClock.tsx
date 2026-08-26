import { useEffect, useRef, useState } from 'react';
import { Pause } from 'lucide-react';

/**
 * Visual pick clock. The backend does NOT enforce expiry — this is display
 * only. The countdown anchors to the previous pick's `picked_at` (or the
 * settings row's `updated_at` for the first pick) and freezes while paused,
 * resuming from the frozen remainder when the draft un-pauses.
 */
export function usePickClock({
  pickKey,
  anchoredAt,
  limitSeconds,
  running,
}: {
  pickKey: string | number | null;
  anchoredAt: string | null;
  limitSeconds: number;
  running: boolean;
}) {
  const [remaining, setRemaining] = useState(limitSeconds);
  const deadlineRef = useRef<number | null>(null);
  const frozenRef = useRef(limitSeconds);

  // New turn (or fresh page load): recompute from the anchor timestamp.
  useEffect(() => {
    const anchor = anchoredAt ? Date.parse(anchoredAt) : Date.now();
    deadlineRef.current = null;
    frozenRef.current = limitSeconds;
    if (running) {
      deadlineRef.current = anchor + limitSeconds * 1000;
      frozenRef.current = Math.max(0, (deadlineRef.current - Date.now()) / 1000);
    }
    setRemaining(frozenRef.current);
    // `running` intentionally excluded: it must not reset an in-flight countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickKey, anchoredAt, limitSeconds]);

  // Pause freezes the remaining time; resume opens a new deadline from it.
  useEffect(() => {
    if (running && deadlineRef.current === null) {
      deadlineRef.current = Date.now() + frozenRef.current * 1000;
    } else if (!running && deadlineRef.current !== null) {
      frozenRef.current = Math.max(0, (deadlineRef.current - Date.now()) / 1000);
      deadlineRef.current = null;
      setRemaining(frozenRef.current);
    }
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const d = deadlineRef.current;
      if (d == null) return;
      setRemaining(Math.max(0, (d - Date.now()) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  return remaining;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function PickClock({
  remaining,
  limitSeconds,
  paused,
}: {
  remaining: number;
  limitSeconds: number;
  paused: boolean;
}) {
  const expired = remaining <= 0;
  const urgent = !expired && remaining <= Math.min(30, limitSeconds * 0.25);
  return (
    <span
      className={`rounded-md px-3 py-1 font-mono text-2xl font-bold tabular-nums ${
        expired
          ? 'bg-destructive/15 text-destructive'
          : urgent
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted text-foreground'
      }`}
      aria-label={`Time remaining ${formatClock(remaining)}`}
    >
      {paused && <Pause className="mr-1 inline size-4 -translate-y-0.5" aria-label="Paused" />}
      {formatClock(remaining)}
    </span>
  );
}
