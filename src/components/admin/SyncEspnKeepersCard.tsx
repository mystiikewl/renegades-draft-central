import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type SyncResult = {
  teams_updated?: number;
  roster_upserted?: number;
  players_resolved?: number;
  players_skipped?: number;
};

/** Admin action: refresh rosters (incl. keeper flags) from the live ESPN league. */
export function SyncEspnKeepersCard() {
  const [pending, setPending] = useState(false);

  const sync = async () => {
    setPending(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-keepers', {
        body: { season: 2026 },
      });
      if (error) throw error;
      const r = data as SyncResult;
      toast.success(
        `Synced ${r.roster_upserted ?? 0} roster spots across ${r.teams_updated ?? 0} teams` +
          ` (${r.players_skipped ? `${r.players_skipped} skipped — not in pool` : 'all players resolved'})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not found|404|FunctionsHttpError|Failed to fetch/i.test(msg)) {
        toast.error(
          'The sync-keepers edge function is not deployed yet. Run: supabase functions deploy sync-keepers',
        );
      } else {
        toast.error(`ESPN sync failed: ${msg}`);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">ESPN keepers</CardTitle>
        <CardDescription>
          Pulls current rosters and keeper flags from the live ESPN league into this season.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="sm" disabled={pending} onClick={sync}>
          <RefreshCw className={`mr-2 h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
          {pending ? 'Syncing…' : 'Sync from ESPN'}
        </Button>
      </CardContent>
    </Card>
  );
}
