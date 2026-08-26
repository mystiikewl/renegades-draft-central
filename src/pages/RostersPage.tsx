import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { useActiveSeason, useRosters, useSeasons, useTeams } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';
import type { Acquisition, RosterEntry } from '@/api/types';
import { KeeperManager } from '@/components/keepers/KeeperManager';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const GROUPS: { key: Acquisition; label: string; short: string }[] = [
  { key: 'keeper', label: 'Keepers', short: 'Keeper' },
  { key: 'draft', label: 'Drafted', short: 'Draft' },
  { key: 'trade', label: 'Trades', short: 'Trade' },
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

  const orderedTeams = useMemo(() => {
    const list = [...(teams ?? [])];
    return list.sort((a, b) => {
      if (a.id === profile?.team_id) return -1;
      if (b.id === profile?.team_id) return 1;
      const countDiff = (byTeam.get(b.id)?.length ?? 0) - (byTeam.get(a.id)?.length ?? 0);
      return countDiff || a.name.localeCompare(b.name);
    });
  }, [teams, profile?.team_id, byTeam]);

  const totalPlayers = rosters?.length ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-3 px-0 py-3 sm:px-4 md:space-y-4 md:p-6">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Rosters</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{totalPlayers} rostered players</p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-[10px]">
          <Users className="size-3" />
          {orderedTeams.length} teams
        </Badge>
      </div>

      {seasons && seasons.length > 0 && (
        <div className="overflow-x-auto border-y bg-card px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:rounded-xl sm:border sm:px-3">
          <Tabs value={chosen ?? undefined} onValueChange={setSeasonId}>
            <TabsList className="h-auto w-max min-w-full justify-start gap-1 bg-transparent p-0 sm:min-w-0">
              {seasons.map((s) => (
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  className="shrink-0 rounded-full border px-3 py-1.5 text-xs data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background"
                >
                  {s.label}{s.is_active ? ' · Active' : ''}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {showKeeperManager && (
        <div className="px-4 sm:px-0">
          <KeeperManager seasonId={chosen} teamId={profile.team_id ?? ''} />
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full sm:rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orderedTeams.map((team) => (
            <TeamRosterSection
              key={team.id}
              name={team.name}
              entries={byTeam.get(team.id) ?? []}
              isMine={team.id === profile?.team_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamRosterSection({
  name,
  entries,
  isMine,
}: {
  name: string;
  entries: RosterEntry[];
  isMine: boolean;
}) {
  return (
    <section className={`overflow-hidden border-y bg-card sm:rounded-xl sm:border ${isMine ? 'sm:ring-1 sm:ring-primary/40' : ''}`}>
      <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${isMine ? 'bg-primary/[0.05]' : 'bg-muted/20'}`}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="line-clamp-1 font-bold leading-tight">{name}</h2>
            {isMine && <Badge className="shrink-0 px-1.5 py-0 text-[9px]">Yours</Badge>}
          </div>
          {entries.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {GROUPS.map(({ key, label }) => {
                const count = entries.filter((entry) => entry.acquisition === key).length;
                if (!count) return null;
                return (
                  <span key={key} className="text-[10px] text-muted-foreground">{count} {label.toLowerCase()}</span>
                );
              })}
            </div>
          )}
        </div>
        <span className="shrink-0 font-mono text-sm font-bold tabular-nums">{entries.length}</span>
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">No players yet.</div>
      ) : (
        <div className="divide-y divide-border/50">
          {entries.map((entry, index) => {
            const group = GROUPS.find((g) => g.key === entry.acquisition);
            return (
              <div
                key={entry.id}
                className={`flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 ${index % 2 ? 'bg-muted/[0.14]' : ''}`}
              >
                <PlayerHeadshot
                  espnId={entry.players?.espn_id ?? null}
                  name={entry.players?.name ?? '—'}
                  size={38}
                  variant="bare"
                />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-semibold leading-tight">{entry.players?.name ?? '—'}</div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                    {entry.players?.nba_team ?? 'FA'} · {entry.players?.position ?? '—'}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 px-1.5 py-0.5 text-[9px] uppercase ${entry.acquisition === 'trade' ? 'border-amber-500/40 text-amber-600' : ''}`}
                >
                  {group?.short ?? entry.acquisition}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
