import { useMemo, useState } from 'react';
import { useActiveSeason, useRosters, useSeasons, useTeams } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';
import type { Acquisition, RosterEntry } from '@/api/types';
import { KeeperManager } from '@/components/keepers/KeeperManager';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const GROUPS: { key: Acquisition; label: string }[] = [
  { key: 'keeper', label: 'Keepers' },
  { key: 'draft', label: 'Drafted' },
  { key: 'trade', label: 'Acquired via trade' },
];

/**
 * Per-team rosters for a chosen season (active by default, archived seasons
 * switchable). Entries grouped by acquisition: keepers vs drafted vs trade.
 */
export function RostersPage() {
  const { profile } = useAuth();
  const { data: seasons } = useSeasons();
  const { data: activeSeason } = useActiveSeason();
  const [seasonId, setSeasonId] = useState<string | null>(null);

  const chosen = seasonId ?? activeSeason?.id ?? null;
  const { data: rosters, isLoading } = useRosters(chosen ?? undefined);
  const { data: teams } = useTeams();

  // Owner self-service keeper marking — only on the active season, only for
  // the viewer's own team (the RPC enforces the same rule server-side).
  const showKeeperManager = !!chosen && chosen === activeSeason?.id && !!profile?.team_id;

  const byTeam = useMemo(() => {
    const map = new Map<string, RosterEntry[]>();
    (rosters ?? []).forEach((r) => {
      const list = map.get(r.team_id) ?? [];
      list.push(r);
      map.set(r.team_id, list);
    });
    // newest acquisition first within a team
    map.forEach((list) => list.sort((a, b) => b.acquired_at.localeCompare(a.acquired_at)));
    return map;
  }, [rosters]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Rosters</h1>
        {seasons && seasons.length > 0 && (
          <Tabs value={chosen ?? undefined} onValueChange={setSeasonId}>
            <TabsList className="max-w-full flex-wrap">
              {seasons.map((s) => (
                <TabsTrigger key={s.id} value={s.id}>
                  {s.label}
                  {s.is_active ? ' (active)' : ''}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      {showKeeperManager && (
        <KeeperManager seasonId={chosen} teamId={profile.team_id ?? ''} />
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(teams ?? []).map((team) => (
            <TeamRosterCard key={team.id} name={team.name} entries={byTeam.get(team.id) ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamRosterCard({ name, entries }: { name: string; entries: RosterEntry[] }) {
  return (
    <Card className="h-fit">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">{name}</CardTitle>
        {/* ponytail: roster size is the card's one anchor stat — tinted, not just a gray pill */}
        <Badge variant="secondary" className="bg-primary/10 text-primary ring-1 ring-primary/30">{entries.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players yet.</p>
        ) : (
          GROUPS.map(({ key, label }) => {
            const group = entries.filter((e) => e.acquisition === key);
            if (!group.length) return null;
            return (
              <div key={key}>
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  {label}
                </div>
                <ul className="space-y-1">
                  {group.map((e) => (
                    <li key={e.id} className="flex items-center justify-between text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <PlayerHeadshot espnId={e.players?.espn_id ?? null} name={e.players?.name ?? '—'} size={24} />
                        <span className="truncate font-medium">{e.players?.name ?? '—'}</span>
                      </span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        {e.players?.position ?? '—'} · {e.players?.nba_team ?? '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
