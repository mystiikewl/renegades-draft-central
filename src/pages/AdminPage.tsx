import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowRight,
  CalendarPlus,
  ClipboardList,
  GripVertical,
  LayoutDashboard,
  ListOrdered,
  ShieldAlert,
  SlidersHorizontal,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useActiveSeason, useDraftPicks, useDraftSettings, useRosters, useTeams } from '@/api/queries';
import {
  useCreateSeason,
  useFinalizeKeepers,
  useResetDraft,
  useRevertFinalizeKeepers,
  useSetDraftOrder,
  useSetDraftStatus,
} from '@/api/mutations';
import { SyncEspnKeepersCard } from '@/components/admin/SyncEspnKeepersCard';
import { DraftSettingsCard } from '@/components/admin/DraftSettingsCard';
import { KeeperManager } from '@/components/keepers/KeeperManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export type AdminSection = 'overview' | 'season' | 'draft' | 'order' | 'keepers';

type AdminPath = '/admin' | '/admin/season' | '/admin/draft' | '/admin/order' | '/admin/keepers';

const ADMIN_NAV: Array<{ section: AdminSection; to: AdminPath; label: string; icon: LucideIcon }> = [
  { section: 'overview', to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { section: 'season', to: '/admin/season', label: 'Season', icon: CalendarPlus },
  { section: 'draft', to: '/admin/draft', label: 'Draft', icon: ClipboardList },
  { section: 'order', to: '/admin/order', label: 'Draft order', icon: ListOrdered },
  { section: 'keepers', to: '/admin/keepers', label: 'Keepers', icon: UsersRound },
];

export function AdminPage({ section = 'overview' }: { section?: AdminSection }) {
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  const { data: settings } = useDraftSettings(seasonId);
  const { data: picks } = useDraftPicks(seasonId);
  const { data: rosters } = useRosters(seasonId);
  const picksUsed = useMemo(() => (picks ?? []).some((pick) => pick.is_used), [picks]);
  const keeperCount = (rosters ?? []).filter((entry) => entry.acquisition === 'keeper').length;
  const statusLabel = settings?.status.replace('_', ' ') ?? 'Not configured';

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-0 py-3 sm:px-4 md:p-6">
      <header className="px-4 sm:px-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Commissioner</div>
            <h1 className="mt-1 text-2xl font-black tracking-tight">League administration</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{season?.label ?? 'No active season'}</Badge>
            <Badge variant="secondary" className="capitalize">{statusLabel}</Badge>
          </div>
        </div>
      </header>

      <nav aria-label="Admin sections" className="overflow-x-auto border-y bg-card px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:rounded-xl sm:border sm:px-3">
        <div className="flex w-max gap-1">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = item.section === section;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                  active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {section === 'overview' && (
        <AdminOverview
          seasonId={seasonId}
          settings={settings}
          picksUsed={picksUsed}
          keeperCount={keeperCount}
        />
      )}
      {section === 'season' && <SeasonAdminPage />}
      {section === 'draft' && <DraftAdminPage seasonId={seasonId} settings={settings} />}
      {section === 'order' && <OrderAdminPage seasonId={seasonId} settingsReady={!!settings} locked={picksUsed} />}
      {section === 'keepers' && <KeepersAdminPage seasonId={seasonId} keeperLimit={settings?.keeper_limit} />}
    </div>
  );
}

function AdminOverview({
  seasonId,
  settings,
  picksUsed,
  keeperCount,
}: {
  seasonId?: string;
  settings: ReturnType<typeof useDraftSettings>['data'];
  picksUsed: boolean;
  keeperCount: number;
}) {
  const orderReady = !!settings?.draft_order?.length;
  const cards: Array<{
    to: AdminPath;
    icon: LucideIcon;
    title: string;
    status: string;
    detail: string;
  }> = [
    {
      to: '/admin/season',
      icon: CalendarPlus,
      title: 'Season',
      status: seasonId ? 'Ready' : 'Required',
      detail: seasonId ? 'Active season is configured.' : 'Create the league season before continuing.',
    },
    {
      to: '/admin/draft',
      icon: SlidersHorizontal,
      title: 'Draft setup & control',
      status: settings ? settings.status.replace('_', ' ') : 'Required',
      detail: 'Rules, roster size, timer and live start / pause controls.',
    },
    {
      to: '/admin/order',
      icon: ListOrdered,
      title: 'Draft order',
      status: orderReady ? (picksUsed ? 'Locked' : 'Ready') : 'Not set',
      detail: 'Set the team sequence before the first selection is made.',
    },
    {
      to: '/admin/keepers',
      icon: UsersRound,
      title: 'Keepers',
      status: `${keeperCount} selected`,
      detail: 'Sync, review and finalize keeper selections before the draft.',
    },
  ];

  return (
    <div className="space-y-4">
      <section className="border-y bg-card px-4 py-4 sm:rounded-2xl sm:border">
        <h2 className="font-bold">Commissioner checklist</h2>
        <p className="mt-1 text-sm text-muted-foreground">Move through setup in order, then use Draft for live controls on draft day.</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ to, icon: Icon, title, status, detail }) => (
          <Link key={to} to={to} className="group rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/40 active:scale-[0.99]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-muted"><Icon className="size-4" /></div>
              <Badge variant="outline" className="capitalize">{status}</Badge>
            </div>
            <h3 className="mt-4 font-bold">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail}</p>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary">Open <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PageIntro({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="px-4 sm:px-0">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function SeasonAdminPage() {
  const createSeason = useCreateSeason();
  const [newSeasonLabel, setNewSeasonLabel] = useState('');
  return (
    <div className="space-y-4">
      <PageIntro title="Season setup" detail="Create and activate the season that all draft, roster and keeper data belongs to." />
      <CreateSeasonCard
        onCreate={(label) => createSeason.mutate(label)}
        pending={createSeason.isPending}
        label={newSeasonLabel}
        setLabel={setNewSeasonLabel}
      />
    </div>
  );
}

function DraftAdminPage({
  seasonId,
  settings,
}: {
  seasonId?: string;
  settings: ReturnType<typeof useDraftSettings>['data'];
}) {
  return (
    <div className="space-y-4">
      <PageIntro title="Draft setup & control" detail="Configure the draft rules here. On draft day, this is also where you start, pause or return the room to pre-draft." />
      {!seasonId ? (
        <EmptyState message="Create a season before configuring the draft." />
      ) : !settings ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <section className="space-y-2">
            <SectionLabel title="Live controls" detail="Operational controls for the current draft state." />
            <DraftStatusCard seasonId={seasonId} status={settings.status} />
          </section>
          <section className="space-y-2">
            <SectionLabel title="Draft settings" detail="League size, roster construction, keeper allowance, draft type and pick timer." />
            <DraftSettingsCard seasonId={seasonId} settings={settings} />
          </section>
          <section className="space-y-2 pt-2">
            <SectionLabel title="Danger zone" detail="Use reset only when the current draft must be rebuilt from the beginning." danger />
            <DangerZoneCard seasonId={seasonId} />
          </section>
        </>
      )}
    </div>
  );
}

function OrderAdminPage({ seasonId, settingsReady, locked }: { seasonId?: string; settingsReady: boolean; locked: boolean }) {
  return (
    <div className="space-y-4">
      <PageIntro title="Draft order" detail="Set the team sequence as its own preparation step. Saving the order regenerates draft slots from the current draft settings." />
      {seasonId && settingsReady ? <DraftOrderCard seasonId={seasonId} locked={locked} /> : <EmptyState message="Create a season and configure draft settings before setting the order." />}
    </div>
  );
}

function KeepersAdminPage({ seasonId, keeperLimit }: { seasonId?: string; keeperLimit?: number }) {
  return (
    <div className="space-y-4">
      <PageIntro title="Keeper management" detail="Sync keeper data, review each team, make corrections and finalize the keeper set before drafting." />
      {seasonId && keeperLimit !== undefined ? (
        <>
          <section className="space-y-2">
            <SectionLabel title="Import" detail="Pull the source league keeper data into this season before reviewing team selections." />
            <SyncEspnKeepersCard />
          </section>
          <section className="space-y-2">
            <SectionLabel title="Review & finalize" detail="Inspect keepers team by team, then finalize once draft order is ready." />
            <AdminKeepersCard seasonId={seasonId} keeperLimit={keeperLimit} />
          </section>
        </>
      ) : (
        <EmptyState message="Create a season and configure draft settings before managing keepers." />
      )}
    </div>
  );
}

function SectionLabel({ title, detail, danger = false }: { title: string; detail: string; danger?: boolean }) {
  return (
    <div className="px-4 sm:px-1">
      <h3 className={`text-sm font-bold ${danger ? 'text-destructive' : ''}`}>{title}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="border-y bg-card px-4 py-10 text-sm text-muted-foreground sm:rounded-xl sm:border">{message}</div>;
}

function CreateSeasonCard({ onCreate, pending, label, setLabel }: { onCreate: (label: string) => void; pending: boolean; label: string; setLabel: (value: string) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Create season</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Creating a season makes it active, deactivates the previous season and creates its initial draft settings.</p>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = label.trim();
            if (trimmed) onCreate(trimmed);
          }}
        >
          <Input placeholder="Season label, e.g. 2027-28" value={label} onChange={(event) => setLabel(event.target.value)} />
          <Button type="submit" className="sm:w-auto" disabled={pending || !label.trim()}>Create season</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DraftOrderCard({ seasonId, locked }: { seasonId: string; locked: boolean }) {
  const { data: settings } = useDraftSettings(seasonId);
  const { data: teams } = useTeams();
  const setDraftOrder = useSetDraftOrder(seasonId);
  const teamName = (id: string) => teams?.find((team) => team.id === id)?.name ?? '—';
  const teamClaimed = (id: string) => !!teams?.find((team) => team.id === id)?.owner_profile_id;
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    if (!teams) return;
    setOrder(settings?.draft_order?.length === teams.length ? settings.draft_order : teams.map((team) => team.id));
  }, [teams, settings?.draft_order]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      setOrder((previous) => arrayMove(previous, previous.indexOf(String(active.id)), previous.indexOf(String(over.id))));
    }
  };
  const dirty = !!settings?.draft_order && settings.draft_order.length === order.length && settings.draft_order.some((id, index) => id !== order[index]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-lg">Team sequence</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{order.length} teams</p>
        </div>
        <Button size="sm" disabled={locked || setDraftOrder.isPending || !order.length} onClick={() => setDraftOrder.mutate(order)}>Save order</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {locked ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">The order is locked because picks have already been made.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Drag teams into position, then save. {dirty && <span className="font-semibold text-primary">Unsaved changes.</span>}</p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} disabled={locked} strategy={verticalListSortingStrategy}>
            <div className="divide-y overflow-hidden rounded-xl border">
              {order.map((id, index) => <SortableTeamRow key={id} id={id} index={index} name={teamName(id)} claimed={teamClaimed(id)} disabled={locked} />)}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}

function SortableTeamRow({ id, index, name, claimed, disabled }: { id: string; index: number; name: string; claimed: boolean; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex min-h-14 items-center gap-3 bg-card px-3 py-2 ${isDragging ? 'opacity-50 shadow' : ''}`}>
      <button type="button" className="touch-none text-muted-foreground disabled:cursor-default" disabled={disabled} {...attributes} {...listeners} aria-label={`Reorder ${name}`}><GripVertical className="size-4" /></button>
      <span className="w-7 text-center font-mono text-xs font-bold text-muted-foreground">{index + 1}</span>
      <span className="min-w-0 flex-1 line-clamp-1 font-semibold">{name}</span>
      {!claimed && <Badge variant="outline" className="text-[9px]">Unclaimed</Badge>}
    </div>
  );
}

function DraftStatusCard({ seasonId, status }: { seasonId: string; status: string }) {
  const setDraftStatus = useSetDraftStatus(seasonId);
  const pending = setDraftStatus.isPending;
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div><div className="text-xs text-muted-foreground">Current state</div><div className="mt-0.5 font-bold capitalize">{status.replace('_', ' ')}</div></div>
          <Badge variant={status === 'running' ? 'default' : 'secondary'} className="capitalize">{status.replace('_', ' ')}</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button disabled={pending || status === 'running'} onClick={() => setDraftStatus.mutate('running')}>Start / Resume</Button>
          <Button variant="outline" disabled={pending || status !== 'running'} onClick={() => setDraftStatus.mutate('paused')}>Pause</Button>
          <Button variant="outline" disabled={pending || status === 'pre_draft'} onClick={() => setDraftStatus.mutate('pre_draft')}>Return to pre-draft</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminKeepersCard({ seasonId, keeperLimit }: { seasonId: string; keeperLimit: number }) {
  const { data: teams } = useTeams();
  const { data: rosters } = useRosters(seasonId);
  const [teamId, setTeamId] = useState('');
  useEffect(() => {
    if (!teamId && teams?.length) setTeamId(teams[0].id);
  }, [teams, teamId]);
  const keeperCount = (id: string) => (rosters ?? []).filter((entry) => entry.team_id === id && entry.acquisition === 'keeper').length;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Team keepers</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="keeper-team">Team</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger id="keeper-team" className="w-full sm:w-80"><SelectValue placeholder="Pick a team" /></SelectTrigger>
            <SelectContent>
              {(teams ?? []).map((team) => <SelectItem key={team.id} value={team.id}>{team.name} ({keeperCount(team.id)} / {keeperLimit})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {teamId && <KeeperManager key={teamId} seasonId={seasonId} teamId={teamId} teamName={teams?.find((team) => team.id === teamId)?.name} />}
        <div className="border-t pt-4"><FinalizeKeepersButton seasonId={seasonId} /></div>
      </CardContent>
    </Card>
  );
}

function FinalizeKeepersButton({ seasonId }: { seasonId: string }) {
  const finalize = useFinalizeKeepers(seasonId);
  const revert = useRevertFinalizeKeepers(seasonId);
  const { data: settings } = useDraftSettings(seasonId);
  const { data: rosters } = useRosters(seasonId);
  const { data: teams } = useTeams();
  const keeperCount = (rosters ?? []).filter((entry) => entry.acquisition === 'keeper').length;
  const orderSet = !!settings?.draft_order?.length;
  const finalized = !!settings?.keepers_finalized_at;
  const rounds = (settings?.roster_size ?? 0) - (settings?.keeper_limit ?? 0);

  const keeperCountByTeam = new Map<string, number>(
    (teams ?? []).map((team) => [
      team.id,
      (rosters ?? []).filter((entry) => entry.team_id === team.id && entry.acquisition === 'keeper').length,
    ]),
  );
  const unkeptTeams = (teams ?? []).filter((team) => !keeperCountByTeam.get(team.id));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild><Button disabled={finalized || !orderSet || finalize.isPending}>{finalized ? 'Keepers finalized' : `Finalize keepers (${keeperCount})`}</Button></AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize keepers?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Drops every non-kept player from all rosters ({rounds} rounds × {settings?.league_size} pick slots generated). Non-keepers return to the pool and can be restored later by reverting the finalize.</p>
                <p className="font-medium">Keepers tagged: {keeperCount}</p>
                {unkeptTeams.length > 0 && (
                  <p className="font-medium text-destructive">
                    No keepers tagged for: {unkeptTeams.map((team) => team.name).join(', ')} — their whole roster would be dropped. Tag keepers for every team first.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => finalize.mutate()}>Yes, finalize</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {finalized && (
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline" disabled={revert.isPending}>Revert finalize</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revert keeper finalize?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>Restores every roster spot that was dropped at finalize (with the exact tags they had), clears the generated draft pick slots, and reopens keeper editing.</p>
                  <p className="text-destructive">Only possible before any pick has been made.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => revert.mutate()}>Yes, revert</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function DangerZoneCard({ seasonId }: { seasonId: string }) {
  const resetDraft = useResetDraft(seasonId);
  return (
    <Card className="border-destructive/40">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><div className="font-bold text-destructive">Reset entire draft</div><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Clears drafted selections, keeps keepers, restores traded picks to original owners and returns the room to pre-draft.</p></div>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" className="shrink-0" disabled={resetDraft.isPending}>Reset draft</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset the entire draft?</AlertDialogTitle>
              <AlertDialogDescription>This clears every pick and all drafted roster spots for the season, preserves keepers, restores traded picks to their original teams, and sets the status back to pre-draft. This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => resetDraft.mutate()}>Yes, reset draft</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
