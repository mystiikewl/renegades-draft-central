import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, ArrowRightLeft, ClipboardList, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useActiveSeason, useDraftPicks, useRosters, useTeams, useTrades } from '@/api/queries';
import type { RosterEntry } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { PlayerHeadshot } from '@/components/player/PlayerHeadshot';
import { Skeleton } from '@/components/ui/skeleton';

const acquisitionLabel: Record<RosterEntry['acquisition'], string> = {
  keeper: 'Keeper',
  draft: 'Draft',
  trade: 'Trade',
};

type QuickPath = '/pool' | '/trades' | '/team-builder';

export function MyTeamPage() {
  const { profile } = useAuth();
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  const { data: teams } = useTeams();
  const { data: rosters, isLoading: rosterLoading } = useRosters(seasonId);
  const { data: picks, isLoading: picksLoading } = useDraftPicks(seasonId);
  const { data: trades, isLoading: tradesLoading } = useTrades(seasonId);

  const teamId = profile?.team_id ?? '';
  const team = teams?.find((candidate) => candidate.id === teamId);

  const myRoster = useMemo(
    () =>
      (rosters ?? [])
        .filter((entry) => entry.team_id === teamId)
        .sort((a, b) => a.players?.name?.localeCompare(b.players?.name ?? '') ?? 0),
    [rosters, teamId],
  );

  const ownedUpcomingPicks = useMemo(
    () => (picks ?? []).filter((pick) => pick.team_id === teamId && !pick.is_used),
    [picks, teamId],
  );
  const upcomingPicks = ownedUpcomingPicks.slice(0, 6);

  const teamTrades = useMemo(
    () =>
      (trades ?? [])
        .filter((trade) => trade.from_team_id === teamId || trade.to_team_id === teamId)
        .slice(0, 4),
    [trades, teamId],
  );

  const counts = useMemo(
    () => ({
      keeper: myRoster.filter((entry) => entry.acquisition === 'keeper').length,
      draft: myRoster.filter((entry) => entry.acquisition === 'draft').length,
      trade: myRoster.filter((entry) => entry.acquisition === 'trade').length,
    }),
    [myRoster],
  );

  if (!season) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No active season.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-0 py-3 sm:px-4 md:p-6">
      <section className="border-y bg-card px-4 py-4 sm:rounded-2xl sm:border sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">My Team</div>
            <h1 className="mt-1 line-clamp-2 text-2xl font-black tracking-tight sm:text-3xl">{team?.name ?? 'Your team'}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{season.label}</span>
              <span>·</span>
              <span>{myRoster.length} players</span>
              <span>·</span>
              <span>{ownedUpcomingPicks.length} upcoming pick{ownedUpcomingPicks.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">ACTIVE</Badge>
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x rounded-xl border bg-muted/20 text-center">
          <SummaryStat label="Keepers" value={counts.keeper} />
          <SummaryStat label="Drafted" value={counts.draft} />
          <SummaryStat label="Trades" value={counts.trade} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        <section className="overflow-hidden border-y bg-card sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="font-bold">Roster</h2>
            <Link to="/rosters" className="text-xs font-semibold text-primary hover:underline">League rosters</Link>
          </div>

          {rosterLoading ? (
            <div className="space-y-1 p-3">
              {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}
            </div>
          ) : myRoster.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No players rostered yet.</div>
          ) : (
            <div className="divide-y divide-border/50">
              {myRoster.map((entry, index) => (
                <div key={entry.id} className={`flex min-h-14 items-center gap-3 px-4 py-2.5 ${index % 2 ? 'bg-muted/[0.14]' : ''}`}>
                  <PlayerHeadshot espnId={entry.players?.espn_id ?? null} name={entry.players?.name ?? '—'} size={40} variant="bare" />
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
                    {acquisitionLabel[entry.acquisition]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="overflow-hidden border-y bg-card sm:rounded-2xl sm:border">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <h2 className="font-bold">Upcoming picks</h2>
              <ClipboardList className="size-4 text-muted-foreground" />
            </div>
            {picksLoading ? (
              <div className="space-y-2 p-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : upcomingPicks.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No unused picks owned.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {upcomingPicks.map((pick) => (
                  <div key={pick.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <div className="font-semibold">Round {pick.round}</div>
                      <div className="text-xs text-muted-foreground">Overall #{pick.pick_number}</div>
                    </div>
                    {pick.team_id !== pick.original_team_id && <Badge variant="outline" className="border-amber-500/40 text-[9px] text-amber-600">TRADED</Badge>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="overflow-hidden border-y bg-card sm:rounded-2xl sm:border">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <h2 className="font-bold">Trade activity</h2>
              <ArrowRightLeft className="size-4 text-muted-foreground" />
            </div>
            {tradesLoading ? (
              <div className="space-y-2 p-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
            ) : teamTrades.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No trade activity yet.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {teamTrades.map((trade) => {
                  const other = trade.from_team_id === teamId ? trade.to_team?.name : trade.from_team?.name;
                  return (
                    <div key={trade.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="line-clamp-1 text-sm font-semibold">{other ?? 'League team'}</span>
                        <Badge variant="outline" className="shrink-0 px-1.5 py-0.5 text-[9px] uppercase">{trade.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{trade.assets?.length ?? 0} assets · {new Date(trade.created_at).toLocaleDateString()}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="grid gap-2 px-4 sm:grid-cols-3 sm:px-0">
        <QuickLink to="/pool" icon={Users} label="Find players" />
        <QuickLink to="/trades" icon={ArrowRightLeft} label="Open trades" />
        <QuickLink to="/team-builder" icon={ArrowRight} label="Team builder" />
      </section>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-3">
      <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-black tabular-nums">{value}</div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: QuickPath; icon: LucideIcon; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/50 active:scale-[0.98]"
    >
      <span className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" />{label}</span>
      <ArrowRight className="size-4 text-muted-foreground" />
    </Link>
  );
}
