import { History } from 'lucide-react';
import { useAdminLog } from '@/api/queries';
import type { AdminLogEntry } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const ACTION_LABELS: Record<string, string> = {
  create_season: 'Season created',
  set_draft_order: 'Draft order saved',
  set_draft_status: 'Draft status',
  reset_draft: 'Draft reset',
  undo_draft_action: 'Undo draft action',
  finalize_keepers: 'Keepers finalized',
  revert_finalize_keepers: 'Finalize reverted',
};

function describeEntry(entry: AdminLogEntry): string | null {
  const p = entry.payload ?? {};
  switch (entry.action) {
    case 'create_season':
      return String(p.label ?? '');
    case 'set_draft_order':
      return `${p.rounds} rounds · ${p.draft_type}${Array.isArray(p.order) ? ` · ${p.order.length} teams` : ''}`;
    case 'set_draft_status':
      return `${p.from ?? '?'} → ${p.to ?? '?'}`;
    case 'reset_draft':
      return `${p.picks_cleared ?? 0} pick${p.picks_cleared === 1 ? '' : 's'} cleared`;
    case 'undo_draft_action':
      return `pick #${p.pick_number ?? '?'}${p.was_skipped ? ' (skipped)' : ''}`;
    case 'finalize_keepers':
      return `${p.dropped ?? 0} dropped · ${p.rounds ?? '?'} rounds · ${p.draft_type ?? '?'}`;
    case 'revert_finalize_keepers':
      return `${p.restored ?? 0} roster spot${p.restored === 1 ? '' : 's'} restored`;
    default:
      return Object.keys(p).length ? JSON.stringify(p) : null;
  }
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Recent destructive commissioner actions, straight from the admin_log table. */
export function AdminLogCard() {
  const { data, isLoading } = useAdminLog();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="size-4 text-muted-foreground" /> Action log
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Who did what — resets, undos, keeper finalize and draft control, recorded server-side.
          </p>
        </div>
        {data && data.length > 0 && <Badge variant="outline" className="shrink-0">last {data.length}</Badge>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        ) : !data?.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No admin actions recorded yet.
          </p>
        ) : (
          <ul className="divide-y">
            {data.map((entry) => {
              const detail = describeEntry(entry);
              const who = entry.profiles?.display_name ?? 'unknown';
              return (
                <li key={entry.id} className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-0.5 py-2 text-sm">
                  <span className="font-semibold">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                  {detail && <span className="min-w-0 text-muted-foreground">{detail}</span>}
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {who} · {timeAgo(entry.at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
