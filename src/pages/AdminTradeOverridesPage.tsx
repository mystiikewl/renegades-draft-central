import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRightLeft, RotateCcw, ShieldCheck } from 'lucide-react';
import { useActiveSeason, useDraftPicks, useDraftSettings, useRosters, useTeams, useTrades } from '@/api/queries';
import { useAdminReverseTrade, useAdminTradeOverride } from '@/api/adminTrades';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];

export function AdminTradeOverridesPage() {
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  const { data: settings } = useDraftSettings(seasonId);
  const { data: teams } = useTeams();
  const { data: rosters } = useRosters(seasonId);
  const { data: picks } = useDraftPicks(seasonId);
  const { data: trades } = useTrades(seasonId);
  const override = useAdminTradeOverride(seasonId ?? '');
  const reverse = useAdminReverseTrade(seasonId ?? '');

  const [fromTeamId, setFromTeamId] = useState('');
  const [toTeamId, setToTeamId] = useState('');
  const [fromRosterIds, setFromRosterIds] = useState<string[]>([]);
  const [fromPickIds, setFromPickIds] = useState<string[]>([]);
  const [toRosterIds, setToRosterIds] = useState<string[]>([]);
  const [toPickIds, setToPickIds] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const locked = settings?.status === 'complete';
  const fromPlayers = (rosters ?? []).filter((row) => row.team_id === fromTeamId);
  const toPlayers = (rosters ?? []).filter((row) => row.team_id === toTeamId);
  const fromPicks = (picks ?? []).filter((pick) => pick.team_id === fromTeamId && !pick.is_used);
  const toPicks = (picks ?? []).filter((pick) => pick.team_id === toTeamId && !pick.is_used);
  const accepted = useMemo(() => (trades ?? []).filter((trade) => trade.status === 'accepted'), [trades]);

  const clearAssets = () => {
    setFromRosterIds([]);
    setFromPickIds([]);
    setToRosterIds([]);
    setToPickIds([]);
    setNote('');
  };

  const canApply = !!seasonId && !!fromTeamId && !!toTeamId && fromTeamId !== toTeamId &&
    fromRosterIds.length + fromPickIds.length + toRosterIds.length + toPickIds.length > 0 && !locked;

  if (!season) return <div className="p-8 text-center text-muted-foreground">No active season.</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/admin" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> League administration
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary"><ShieldCheck className="size-4" /> Commissioner override</div>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Trade controls</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Apply agreed swaps on behalf of members. Every override is written into the season trade ledger and can be reversed until the draft is complete.</p>
        </div>
        <Badge variant={locked ? 'outline' : 'secondary'}>{locked ? 'Ledger locked' : `${season.label} editable`}</Badge>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-lg">New commissioner trade</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Team A</Label>
              <Select value={fromTeamId} onValueChange={(value) => { setFromTeamId(value); clearAssets(); }} disabled={locked}>
                <SelectTrigger><SelectValue placeholder="Choose team" /></SelectTrigger>
                <SelectContent>{(teams ?? []).filter((team) => team.id !== toTeamId).map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Team B</Label>
              <Select value={toTeamId} onValueChange={(value) => { setToTeamId(value); clearAssets(); }} disabled={locked}>
                <SelectTrigger><SelectValue placeholder="Choose team" /></SelectTrigger>
                <SelectContent>{(teams ?? []).filter((team) => team.id !== fromTeamId).map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {fromTeamId && toTeamId && (
            <div className="grid gap-4 lg:grid-cols-2">
              <AssetColumn
                title={`${teams?.find((team) => team.id === fromTeamId)?.name ?? 'Team A'} sends`}
                players={fromPlayers.map((row) => ({ id: row.id, label: row.players?.name ?? 'Unknown player' }))}
                picks={fromPicks.map((pick) => ({ id: pick.id, label: `Round ${pick.round} · #${pick.pick_number}` }))}
                rosterIds={fromRosterIds}
                pickIds={fromPickIds}
                onRoster={(id) => setFromRosterIds((ids) => toggle(ids, id))}
                onPick={(id) => setFromPickIds((ids) => toggle(ids, id))}
              />
              <AssetColumn
                title={`${teams?.find((team) => team.id === toTeamId)?.name ?? 'Team B'} sends`}
                players={toPlayers.map((row) => ({ id: row.id, label: row.players?.name ?? 'Unknown player' }))}
                picks={toPicks.map((pick) => ({ id: pick.id, label: `Round ${pick.round} · #${pick.pick_number}` }))}
                rosterIds={toRosterIds}
                pickIds={toPickIds}
                onRoster={(id) => setToRosterIds((ids) => toggle(ids, id))}
                onPick={(id) => setToPickIds((ids) => toggle(ids, id))}
              />
            </div>
          )}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="override-note">Commissioner note</Label>
              <Input id="override-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Agreed in league chat; correcting pick ownership" maxLength={240} disabled={locked} />
            </div>
            <Button disabled={!canApply || override.isPending} onClick={() => override.mutate({ fromTeamId, toTeamId, fromRosterIds, fromPickIds, toRosterIds, toPickIds, note }, { onSuccess: clearAssets })}>
              <ArrowRightLeft className="mr-2 size-4" />{override.isPending ? 'Applying…' : 'Apply override'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold">Accepted trade ledger</h2>
          <p className="text-sm text-muted-foreground">Reverse a mistaken decision, then enter the corrected trade as a new override. Older terms remain visible in history.</p>
        </div>
        {!accepted.length ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No accepted trades yet.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {accepted.map((trade) => (
              <Card key={trade.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{trade.from_team?.name ?? 'Team'} ↔ {trade.to_team?.name ?? 'Team'}</span>
                      {trade.is_admin_override && <Badge variant="secondary">Commissioner</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{trade.assets?.map((asset) => asset.asset_label).join(' · ') || 'Trade assets'}{trade.note ? ` · ${trade.note}` : ''}</div>
                  </div>
                  <Button variant="outline" size="sm" disabled={locked || reverse.isPending} onClick={() => reverse.mutate({ tradeId: trade.id, reason: 'Commissioner correction' })}>
                    <RotateCcw className="mr-2 size-4" />Reverse
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AssetColumn({ title, players, picks, rosterIds, pickIds, onRoster, onPick }: { title: string; players: { id: string; label: string }[]; picks: { id: string; label: string }[]; rosterIds: string[]; pickIds: string[]; onRoster: (id: string) => void; onPick: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="border-b bg-muted/40 px-4 py-3 font-semibold">{title}</div>
      <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <AssetGroup title="Players" items={players} selected={rosterIds} onToggle={onRoster} />
        <AssetGroup title="Unused picks" items={picks} selected={pickIds} onToggle={onPick} />
      </div>
    </div>
  );
}

function AssetGroup({ title, items, selected, onToggle }: { title: string; items: { id: string; label: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="p-3">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">{title}</div>
      <div className="space-y-1">
        {items.length ? items.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
            <Checkbox checked={selected.includes(item.id)} onCheckedChange={() => onToggle(item.id)} />
            <span className="text-sm">{item.label}</span>
          </label>
        )) : <div className="px-2 py-3 text-xs text-muted-foreground">None available</div>}
      </div>
    </div>
  );
}
