import { useMemo, useState } from 'react';
import { ArrowRightLeft, Clock3 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useActiveSeason, useDraftPicks, useRosters, useTeams, useTrades } from '@/api/queries';
import { useAcceptTrade, useCancelTrade, useProposeTrade, useRejectTrade } from '@/api/trades';
import type { DraftPick, RosterEntry, Trade, TradeAsset } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const toggleId = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id];

export function TradeCenterPage() {
  const { profile } = useAuth();
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  const { data: teams } = useTeams();
  const { data: rosters, isLoading: rostersLoading } = useRosters(seasonId);
  const { data: picks, isLoading: picksLoading } = useDraftPicks(seasonId);
  const { data: trades, isLoading: tradesLoading } = useTrades(seasonId);

  const [partnerId, setPartnerId] = useState('');
  const [offeredRosterIds, setOfferedRosterIds] = useState<string[]>([]);
  const [offeredPickIds, setOfferedPickIds] = useState<string[]>([]);
  const [requestedRosterIds, setRequestedRosterIds] = useState<string[]>([]);
  const [requestedPickIds, setRequestedPickIds] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const propose = useProposeTrade(seasonId ?? '');
  const accept = useAcceptTrade(seasonId ?? '');
  const reject = useRejectTrade(seasonId ?? '');
  const cancel = useCancelTrade(seasonId ?? '');

  const myTeamId = profile?.team_id ?? '';
  const availablePartners = (teams ?? []).filter((team) => team.id !== myTeamId);
  const myPlayers = (rosters ?? []).filter((row) => row.team_id === myTeamId);
  const theirPlayers = (rosters ?? []).filter((row) => row.team_id === partnerId);
  const myPicks = (picks ?? []).filter((pick) => pick.team_id === myTeamId && !pick.is_used);
  const theirPicks = (picks ?? []).filter((pick) => pick.team_id === partnerId && !pick.is_used);

  const pendingForMe = useMemo(
    () => (trades ?? []).filter((trade) => trade.status === 'proposed' && trade.to_team_id === myTeamId),
    [trades, myTeamId],
  );

  const clearDraft = () => {
    setOfferedRosterIds([]);
    setOfferedPickIds([]);
    setRequestedRosterIds([]);
    setRequestedPickIds([]);
    setNote('');
  };

  const changePartner = (teamId: string) => {
    setPartnerId(teamId);
    clearDraft();
  };

  const canSubmit =
    !!seasonId &&
    !!partnerId &&
    offeredRosterIds.length + offeredPickIds.length > 0 &&
    requestedRosterIds.length + requestedPickIds.length > 0;

  if (!season) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No active season.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Trade Center</h1>
        {pendingForMe.length > 0 && (
          <Badge className="shrink-0">
            {pendingForMe.length} pending
          </Badge>
        )}
      </div>

      {pendingForMe.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock3 className="size-4" />
            Needs your response
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {pendingForMe.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                myTeamId={myTeamId}
                onAccept={() => accept.mutate(trade.id)}
                onReject={() => reject.mutate(trade.id)}
                busy={accept.isPending || reject.isPending}
              />
            ))}
          </div>
        </section>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowRightLeft className="size-5" />
            New trade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="max-w-sm space-y-2">
            <Label htmlFor="trade-partner">Trade with</Label>
            <Select value={partnerId} onValueChange={changePartner}>
              <SelectTrigger id="trade-partner">
                <SelectValue placeholder="Choose a team" />
              </SelectTrigger>
              <SelectContent>
                {availablePartners.map((team) => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {partnerId && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <AssetPicker
                  title="You send"
                  players={myPlayers}
                  picks={myPicks}
                  selectedRosterIds={offeredRosterIds}
                  selectedPickIds={offeredPickIds}
                  onToggleRoster={(id) => setOfferedRosterIds((ids) => toggleId(ids, id))}
                  onTogglePick={(id) => setOfferedPickIds((ids) => toggleId(ids, id))}
                  loading={rostersLoading || picksLoading}
                />
                <AssetPicker
                  title="You receive"
                  players={theirPlayers}
                  picks={theirPicks}
                  selectedRosterIds={requestedRosterIds}
                  selectedPickIds={requestedPickIds}
                  onToggleRoster={(id) => setRequestedRosterIds((ids) => toggleId(ids, id))}
                  onTogglePick={(id) => setRequestedPickIds((ids) => toggleId(ids, id))}
                  loading={rostersLoading || picksLoading}
                />
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="trade-note">Note <span className="font-normal text-muted-foreground">optional</span></Label>
                  <Input
                    id="trade-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="e.g. Agreed after Round 3"
                    maxLength={240}
                  />
                </div>
                <Button
                  className="w-full transition-transform active:scale-[0.98] sm:w-auto"
                  disabled={!canSubmit || propose.isPending}
                  onClick={() =>
                    propose.mutate(
                      {
                        toTeamId: partnerId,
                        offeredRosterIds,
                        offeredPickIds,
                        requestedRosterIds,
                        requestedPickIds,
                        note,
                      },
                      { onSuccess: clearDraft },
                    )
                  }
                >
                  {propose.isPending ? 'Sending…' : 'Propose trade'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Trade history</h2>
        {tradesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full" />
            ))}
          </div>
        ) : !trades?.length ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No trades yet.</CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {trades.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                myTeamId={myTeamId}
                onCancel={trade.status === 'proposed' && trade.from_team_id === myTeamId ? () => cancel.mutate(trade.id) : undefined}
                busy={cancel.isPending}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AssetPicker({
  title,
  players,
  picks,
  selectedRosterIds,
  selectedPickIds,
  onToggleRoster,
  onTogglePick,
  loading,
}: {
  title: string;
  players: RosterEntry[];
  picks: DraftPick[];
  selectedRosterIds: string[];
  selectedPickIds: string[];
  onToggleRoster: (id: string) => void;
  onTogglePick: (id: string) => void;
  loading: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-3 font-semibold">{title}</div>
      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <AssetGroup label="Players" empty="No rostered players">
            {players.map((row) => (
              <AssetOption
                key={row.id}
                id={row.id}
                checked={selectedRosterIds.includes(row.id)}
                label={row.players?.name ?? 'Unknown player'}
                detail={[row.players?.position, row.players?.nba_team].filter(Boolean).join(' · ')}
                onToggle={onToggleRoster}
              />
            ))}
          </AssetGroup>
          <AssetGroup label="Picks" empty="No unused picks">
            {picks.map((pick) => (
              <AssetOption
                key={pick.id}
                id={pick.id}
                checked={selectedPickIds.includes(pick.id)}
                label={`Round ${pick.round}`}
                detail={`Pick #${pick.pick_number}`}
                onToggle={onTogglePick}
              />
            ))}
          </AssetGroup>
        </div>
      )}
    </div>
  );
}

function AssetGroup({ label, empty, children }: { label: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="min-w-0 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="space-y-1">
        {hasChildren ? children : <div className="py-2 text-xs text-muted-foreground">{empty}</div>}
      </div>
    </div>
  );
}

function AssetOption({
  id,
  checked,
  label,
  detail,
  onToggle,
}: {
  id: string;
  checked: boolean;
  label: string;
  detail: string;
  onToggle: (id: string) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 active:bg-muted/70">
      <Checkbox checked={checked} onCheckedChange={() => onToggle(id)} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-sm font-medium leading-tight">{label}</span>
        {detail && <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>}
      </span>
    </label>
  );
}

function TradeCard({
  trade,
  myTeamId,
  onAccept,
  onReject,
  onCancel,
  busy,
}: {
  trade: Trade;
  myTeamId: string;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const fromAssets = (trade.assets ?? []).filter((asset) => asset.from_team_id === trade.from_team_id);
  const toAssets = (trade.assets ?? []).filter((asset) => asset.from_team_id === trade.to_team_id);
  const incoming = trade.to_team_id === myTeamId;

  return (
    <Card className={trade.status === 'proposed' && incoming ? 'border-primary/50' : undefined}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 font-semibold leading-tight">
            <span className="line-clamp-2">{trade.from_team?.name ?? 'Team'}</span>
            <span className="text-muted-foreground"> ↔ </span>
            <span className="line-clamp-2">{trade.to_team?.name ?? 'Team'}</span>
          </div>
          <TradeStatusBadge status={trade.status} />
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <TradeSide label={`${trade.from_team?.name ?? 'Team'} sends`} assets={fromAssets} />
          <TradeSide label={`${trade.to_team?.name ?? 'Team'} sends`} assets={toAssets} />
        </div>

        {trade.note && <p className="border-t pt-3 text-sm text-muted-foreground">{trade.note}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="mr-auto text-xs text-muted-foreground">
            {new Date(trade.created_at).toLocaleDateString()}
          </span>
          {onReject && (
            <Button size="sm" variant="outline" disabled={busy} onClick={onReject} className="active:scale-[0.98]">
              Reject
            </Button>
          )}
          {onAccept && (
            <Button size="sm" disabled={busy} onClick={onAccept} className="active:scale-[0.98]">
              Accept
            </Button>
          )}
          {onCancel && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel} className="active:scale-[0.98]">
              Cancel proposal
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TradeSide({ label, assets }: { label: string; assets: TradeAsset[] }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">{label}</div>
      <ul className="space-y-1.5">
        {assets.map((asset) => (
          <li key={asset.id} className="flex items-center gap-2">
            <Badge variant="outline" className="shrink-0 px-1.5 text-[10px] uppercase">
              {asset.asset_type}
            </Badge>
            <span className="line-clamp-2 min-w-0 leading-tight">{asset.asset_label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TradeStatusBadge({ status }: { status: Trade['status'] }) {
  if (status === 'accepted') return <Badge>Accepted</Badge>;
  if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
  if (status === 'cancelled') return <Badge variant="outline">Cancelled</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}
