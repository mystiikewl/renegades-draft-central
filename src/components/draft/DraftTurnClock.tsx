import { useEffect, useMemo, useState } from 'react';
import type { DraftSettings } from '@/api/types';

function formatSeconds(total: number) {
  const safe = Math.max(0, total);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function DraftTurnClock({ settings }: { settings: DraftSettings | null | undefined }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (settings?.status !== 'running' || !settings.turn_deadline_at) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [settings?.status, settings?.turn_deadline_at]);

  const seconds = useMemo(() => {
    if (!settings) return 0;
    if (settings.status === 'paused') return Math.max(0, settings.paused_remaining_seconds ?? settings.pick_time_limit_seconds);
    if (settings.status !== 'running' || !settings.turn_deadline_at) return 0;
    return Math.max(0, Math.ceil((new Date(settings.turn_deadline_at).getTime() - now) / 1000));
  }, [settings, now]);

  if (!settings || (settings.status !== 'running' && settings.status !== 'paused')) return null;

  const urgent = settings.status === 'running' && seconds <= 10;
  const expired = settings.status === 'running' && seconds === 0;

  return (
    <div
      aria-label={settings.status === 'paused' ? `Draft paused with ${seconds} seconds remaining` : `${seconds} seconds remaining on the pick clock`}
      className={`rounded-lg border px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums ${
        urgent ? 'border-draft-active/50 bg-draft-active/10 text-draft-active' : 'bg-background text-foreground'
      }`}
    >
      {settings.status === 'paused' ? `PAUSED ${formatSeconds(seconds)}` : expired ? '0:00' : formatSeconds(seconds)}
    </div>
  );
}
