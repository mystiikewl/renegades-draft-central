import { useMemo } from 'react';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import {
  useDraftSettings,
  useRosters,
  useSeasons,
} from '@/api/queries';
import { useAssignKeeper, useRemoveKeeper } from '@/api/mutations';
import type { RosterEntry } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';

/**
 * Keeper selection for one team in one season. Candidates come from the
 * team's roster in the most recent archived ("prior") season — dynasty
 * keepers are chosen off your own last roster. All writes go through the
 * assign_keeper/remove_keeper RPCs, which re-enforce ownership and the
 * keeper_limit server-side.
 *
 * Used by both surfaces: owner self-service (RostersPage, own team) and the
 * admin override (AdminPage, any team).
 */
export function KeeperManager({
  seasonId,
  teamId,
  teamName,
}: {
  seasonId: string;
  teamId: string;
  teamName?: string;
}) {
  const { data: settings } = useDraftSettings(seasonId);
  const { data: seasons } = useSeasons();
  const { data: activeRosters, isLoading: activeLoading } = useRosters(seasonId);

  // Seasons are listed newest-first; the first non-active one is the season
  // keepers are carried over from.
  const priorSeason = seasons?.find((s) => !s.is_active);
  const { data: priorRosters, isLoading: priorLoading } = useRosters(priorSeason?.id);

  const limit = settings?.keeper_limit ?? 9;
  const locked = !!settings && settings.status !== 'pre_draft';

  const assignKeeper = useAssignKeeper(seasonId);
  const removeKeeper = useRemoveKeeper(seasonId);
  const pending = assignKeeper.isPending || removeKeeper.isPending;

  const keeperRows = useMemo(
    () =>
      (activeRosters ?? []).filter(
        (r) => r.team_id === teamId && r.acquisition === 'keeper',
      ),
    [activeRosters, teamId],
  );
  const keeperIds = useMemo(() => new Set(keeperRows.map((r) => r.player_id)), [keeperRows]);

  // Blocked = already kept (any team) or sitting on ANOTHER team's active
  // roster (ESPN moved them since last season). Own-team mirror rows are NOT
  // blocked — assign_keeper flips them to 'keeper' (the mirror is just
  // "rostered" status; keeper choice stays open until finalize).
  const blockedIds = useMemo(() => {
    const ids = new Set<string>();
    (activeRosters ?? []).forEach((r) => {
      // kept by anyone, or sitting on another team's roster
      if (r.acquisition === 'keeper' || r.team_id !== teamId) ids.add(r.player_id);
    });
    return ids;
  }, [activeRosters, teamId]);

  const candidates = useMemo(() => {
    return (priorRosters ?? [])
      .filter((r) => r.team_id === teamId)
      .sort((a, b) => (a.players?.name ?? '').localeCompare(b.players?.name ?? ''));
  }, [priorRosters, teamId]);

  const count = keeperRows.length;
  const atLimit = count >= limit;

  const onAssign = (playerId: string) => {
    if (locked || pending) return;
    if (atLimit) {
      toast.info(`Keeper limit reached (${limit}) — remove one before adding another`);
      return;
    }
    assignKeeper.mutate({ teamId, playerId });
  };

  const onRemove = (playerId: string) => {
    if (locked || pending) return;
    removeKeeper.mutate({ teamId, playerId });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">
            Keepers{teamName ? ` — ${teamName}` : ''}
          </CardTitle>
          <CardDescription>
            Protect up to {limit} players from your {priorSeason?.label ?? 'previous'} roster for
            the new season. Kept players are removed from the draft pool.
          </CardDescription>
        </div>
        <Badge
          variant={atLimit ? 'destructive' : 'secondary'}
          aria-label={`${count} of ${limit} keepers selected`}
          data-testid="keeper-counter"
        >
          {count} / {limit}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {locked && (
          <p className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            Keepers are locked — the draft has started.
          </p>
        )}

        {priorLoading || activeLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !priorSeason ? (
          <p className="text-sm text-muted-foreground">No previous season to pick keepers from.</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No players on this team's {priorSeason.label} roster.
          </p>
        ) : (
          <ul className="divide-y rounded-md border" data-testid="keeper-candidates">
            {candidates.map((c) => (
              <CandidateRow
                key={c.id}
                entry={c}
                kept={keeperIds.has(c.player_id)}
                blocked={blockedIds.has(c.player_id)}
                disabled={pending || locked}
                onAssign={onAssign}
                onRemove={onRemove}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CandidateRow({
  entry,
  kept,
  blocked,
  disabled,
  onAssign,
  onRemove,
}: {
  entry: RosterEntry;
  kept: boolean;
  blocked: boolean;
  disabled: boolean;
  onAssign: (playerId: string) => void;
  onRemove: (playerId: string) => void;
}) {
  const name = entry.players?.name ?? 'Unknown player';
  // Fixed 3-column grid (headshot | label block | action) keeps every row's
  // text starting at the same x-origin regardless of name/meta length.
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2 transition-colors hover:bg-muted/40">
      <PlayerHeadshot espnId={entry.players?.espn_id ?? null} name={name} />
      <div className="min-w-0">
        <span className="block truncate text-sm font-medium leading-tight">{name}</span>
        <span className="mt-0.5 block truncate text-xs leading-tight text-muted-foreground">
          {entry.players?.position ?? '—'} · {entry.players?.nba_team ?? '—'}
          {blocked && !kept ? ' · unavailable' : ''}
        </span>
      </div>
      {kept ? (
        <Button
          size="sm"
          variant="secondary"
          className="min-w-[5.5rem]"
          disabled={disabled}
          onClick={() => onRemove(entry.player_id)}
          data-testid={`remove-${entry.player_id}`}
        >
          Keeper ✓
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="min-w-[5.5rem]"
          disabled={disabled || blocked}
          title={blocked ? 'Already kept or on another team’s roster' : undefined}
          onClick={() => onAssign(entry.player_id)}
          data-testid={`assign-${entry.player_id}`}
        >
          Keep
        </Button>
      )}
    </li>
  );
}
