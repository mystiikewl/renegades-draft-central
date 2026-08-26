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

export function RostersPage() {
  const { profile } = useAuth();
  const { data: seasons } = useSeasons();
  const { data: activeSeason } = useActiveSeason();
  const [seasonId, setSeasonId] = useState<string | null>(null);

  const chosen = seasonId ?? activeSeason?.id ?? null;
  const { data: rosters, isLoading } = useRosters(chosen ?? undefined);
  const { data: teams } = useTeams();
  const showKeeperManager = !!chosen && chosen === activeSeason?.id && !!profile?.team_id;

  const byTeam = useMemo(() => {
    const map = new Map<string, RosterEntry[]>();
    (rosters ?? []).forEach((r) => {
      const list = map.get(r.team_id) ?? [];
      list.push(r);
      map.set(r.team_id, list);
    });
    map.forEach((list) => list.sort((a, b) => b.acquired_at.localeCompare(a.acquired_at)));
    return map;
  }, [rosters]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:space-y-6 md:p-6">
      <div className="space-y-3 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
        <h1 className="text-2xl font-bold">Rosters</h1>
        {seasons && seasons.length > 0 && (
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <Tabs value={chosen ?? undefined} onValueChange={setSeasonId}>
              <TabsList className="w-max min-w-full justify-start sm:min-w-0">
                {seasons.map((s) => (
                  <TabsTrigger key={s.id} value={s.id} className="shrink-0">
                    {s.label}
                    {s.is_active ? ' (active)' : ''}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
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
    <Card className="h-fit overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-4">
        <CardTitle className="min-w-0 text-lg leading-tight">{name}</CardTitle>
        <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary ring-1 ring-primary/30">{entries.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No players yet.</p>
        ) : (
          GROUPS.map(({ key, label }) => {
            const group = entries.filter((e) => e.acquisition === key);
            if (!group.length) return null;
            return (
              <div key={key}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                <ul className="divide-y divide-border/50">
                  {group.map((e) => (
                    <li key={e.id} className="flex min-h-12 items-center gap-3 py-2 text-sm">
                      <PlayerHeadshot espnId={e.players?.espn_id ?? null} name={e.players?.name ?? '—'} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-medium leading-tight">{e.players?.name ?? '—'}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                          {e.players?.position ?? '—'} · {e.players?.nba_team ?? '—'}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
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
