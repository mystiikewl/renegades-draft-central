import { useRealtimeStatus, type RealtimeStatus } from '@/api/realtime';
import { cn } from '@/lib/utils';

const cfg: Record<RealtimeStatus, { label: string; dot: string; title: string }> = {
  connected: {
    label: 'Live',
    dot: 'bg-green-500',
    title: 'Realtime connected — the board updates automatically.',
  },
  connecting: { label: 'Connecting…', dot: 'bg-amber-500 animate-pulse', title: 'Connecting to realtime updates…' },
  disconnected: {
    label: 'Reconnecting…',
    dot: 'bg-red-500',
    title: 'Realtime disconnected — the board may be stale. It will refresh when reconnected.',
  },
};

export function RealtimeBadge({ className }: { className?: string }) {
  const status = useRealtimeStatus();
  const c = cfg[status];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}
      title={c.title}
      data-status={status}
    >
      <span className={cn('h-2 w-2 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}
