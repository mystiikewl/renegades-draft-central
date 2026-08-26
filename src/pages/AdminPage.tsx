import { useEffect, useMemo, useState } from 'react';
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
import { CalendarPlus, ClipboardList, GripVertical, Settings2, ShieldAlert, Trophy, UsersRound } from 'lucide-react';
import { useActiveSeason, useDraftPicks, useDraftSettings, useRosters, useTeams } from '@/api/queries';
import {
  useCreateSeason,
  useFinalizeKeepers,
  useResetDraft,
  useSetTeamColor,
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

export function AdminPage() {
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  const { data: settings } = useDraftSettings(seasonId);
  const { data: picks } = useDraftPicks(seasonId);
  const createSeason = useCreateSeason();
  const [newSeasonLabel, setNewSeasonLabel] = useState('');

  const picksUsed = useMemo(() => (picks ?? []).some((p) => p.is_used), [picks]);
  const statusLabel = settings?.status.replace('_', ' ') ?? 'Not configured';

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-[max(5rem,env(safe-area-inset-bottom))] md:p-6">
      <header className="rounded-xl border bg-card px-4 py-5 shadow-sm sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Commissioner</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Commissioner control room</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Set up the season, manage the draft, and keep league data in order.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="bg-background px-2.5 py-1 font-medium">
              {season?.label ?? 'No active season'}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {statusLabel}
            </Badge>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <ControlRoomSection
          title="Season setup"
          description="Create a new season and set the rules before the draft starts."
          icon={CalendarPlus}
        >
          <CreateSeasonCard
            onCreate={(label) => createSeason.mutate(label)}
            pending={createSeason.isPending}
            label={newSeasonLabel}
            setLabel={setNewSeasonLabel}
          />
        </ControlRoomSection>

        <ControlRoomSection
          title="Draft room"
          description="Set the draft state and prepare the league for the next pick."
          icon={ClipboardList}
        >
          {seasonId && settings ? (
            <div className="space-y-4">
              <DraftStatusCard seasonId={seasonId} status={settings.status} />
              <DraftSettingsCard seasonId={seasonId} settings={settings} />
            </div>
          ) : seasonId ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <EmptyControlRoomState message="Create a season to configure the draft room." />
          )}
        </ControlRoomSection>

        {seasonId && settings && (
          <ControlRoomSection
            title="Draft order"
            description="Set the team order before any picks have been made."
            icon={Settings2}
            className="xl:col-span-2"
          >
            <DraftOrderCard seasonId={seasonId} locked={picksUsed} />
          </ControlRoomSection>
        )}

        <ControlRoomSection
          title="Team colours"
          description="Choose a colour for each team. Completed picks use it on the draft board."
          icon={Trophy}
          className="xl:col-span-2"
        >
          <TeamColoursCard />
        </ControlRoomSection>

        <ControlRoomSection
          title="Keeper operations"
          description="Sync league data, manage keepers, then lock in the next draft."
          icon={UsersRound}
        >
          {seasonId && settings ? (
            <div className="space-y-4">
              <SyncEspnKeepersCard />
              <AdminKeepersCard seasonId={seasonId} keeperLimit={settings.keeper_limit} />
            </div>
          ) : (
            <EmptyControlRoomState message="Create a season to manage keepers." />
          )}
        </ControlRoomSection>

        <ControlRoomSection
          title="Danger zone"
          description="Resetting the draft cannot be undone. Use this only when you need to start over."
          icon={ShieldAlert}
          tone="danger"
        >
          {seasonId ? <DangerZoneCard seasonId={seasonId} /> : <EmptyControlRoomState message="There is no active draft to reset." />}
        </ControlRoomSection>
      </div>
    </div>
  );
}

function ControlRoomSection({
  title,
  description,
  icon: Icon,
  tone = 'default',
  className,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Trophy;
  tone?: 'default' | 'danger';
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = `${title.toLowerCase().replaceAll(' ', '-')}-heading`;
  return (
    <section aria-labelledby={headingId} className={`space-y-3 ${className ?? ''}`}>
      <div className="flex items-start gap-3 px-1">
        <div className={`rounded-lg p-2 ${tone === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
          <Icon className="size-4" />
        </div>
        <div>
          <h2 id={headingId} className="font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyControlRoomState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">{message}</div>;
}

function TeamColoursCard() {
  const { data: teams } = useTeams();
  const setTeamColor = useSetTeamColor();

  if (!teams) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {teams.map((team) => {
          const color = team.team_color ?? '#2563EB';
          return (
            <div key={team.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden className="size-3 shrink-0 rounded-full ring-1 ring-border" style={{ backgroundColor: color }} />
                <span className="truncate text-sm font-medium">{team.name}</span>
              </div>
              <input
                aria-label={`${team.name} colour`}
                type="color"
                defaultValue={color}
                disabled={setTeamColor.isPending}
                className="size-9 shrink-0 cursor-pointer rounded border bg-transparent p-1 disabled:cursor-not-allowed"
                onChange={(event) => setTeamColor.mutate({ teamId: team.id, teamColor: event.target.value.toUpperCase() })}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CreateSeasonCard({
  onCreate,
  pending,
  label,
  setLabel,
}: {
  onCreate: (label: string) => void;
  pending: boolean;
  label: string;
  setLabel: (v: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create season</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Creates a new active season (e.g. 2027-28) and deactivates the current one.
          A blank draft settings row is created with it.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = label.trim();
            if (trimmed) onCreate(trimmed);
          }}
        >
          <Input
            placeholder="Season label, e.g. 2027-28"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button type="submit" disabled={pending || !label.trim()}>
            Create
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DraftOrderCard({ seasonId, locked }: { seasonId: string; locked: boolean }) {
  const { data: settings } = useDraftSettings(seasonId);
  const { data: teams } = useTeams();
  const setDraftOrder = useSetDraftOrder(seasonId);

  const teamName = (id: string) => teams?.find((t) => t.id === id)?.name ?? '—';
  const teamClaimed = (id: string) => !!teams?.find((t) => t.id === id)?.owner_profile_id;

  // Local reorder state, seeded from the saved order (or alphabetical teams).
  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => {
    if (!teams) return;
    if (settings?.draft_order?.length === teams.length) {
      setOrder(settings.draft_order);
    } else {
      setOrder(teams.map((t) => t.id));
    }
  }, [teams, settings?.draft_order]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setOrder((prev) => arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id))));
    }
  };

  const dirty =
    !!settings?.draft_order &&
    settings.draft_order.length === order.length &&
    settings.draft_order.some((id, i) => id !== order[i]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Draft order</CardTitle>
        <Button
          size="sm"
          className="transition-transform active:scale-[0.98]"
          disabled={locked || setDraftOrder.isPending || !order.length}
          onClick={() => setDraftOrder.mutate(order)}
        >
          Save order
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {locked ? (
          <p className="text-sm text-destructive">
            Picks have been made — the order can't change once the draft has started.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Drag to reorder, then save. Saving regenerates the pick slots
            (snake rounds per settings). {dirty && <span className="font-medium text-primary">Unsaved changes.</span>}
          </p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} disabled={locked} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {order.map((id, i) => (
                <SortableTeamRow
                  key={id}
                  id={id}
                  index={i}
                  name={teamName(id)}
                  claimed={teamClaimed(id)}
                  disabled={locked}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}

function SortableTeamRow({
  id,
  index,
  name,
  claimed,
  disabled,
}: {
  id: string;
  index: number;
  name: string;
  claimed: boolean;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-md border bg-card p-2 ${isDragging ? 'opacity-50 shadow' : ''}`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground disabled:cursor-default"
        disabled={disabled}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${name}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 text-center font-mono text-sm text-muted-foreground">{index + 1}</span>
      <span className="font-medium">{name}</span>
      {!claimed && <Badge variant="outline">unclaimed</Badge>}
    </div>
  );
}

function DraftStatusCard({ seasonId, status }: { seasonId: string; status: string }) {
  const setDraftStatus = useSetDraftStatus(seasonId);
  const p = setDraftStatus.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Draft status</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">current: {status}</Badge>
        <Button size="sm" disabled={p || status === 'running'} onClick={() => setDraftStatus.mutate('running')}>
          Start / Resume
        </Button>
        <Button size="sm" variant="outline" disabled={p || status !== 'running'} onClick={() => setDraftStatus.mutate('paused')}>
          Pause
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={p || status === 'pre_draft'}
          onClick={() => setDraftStatus.mutate('pre_draft')}
        >
          Back to pre-draft
        </Button>
      </CardContent>
    </Card>
  );
}

function AdminKeepersCard({
  seasonId,
  keeperLimit,
}: {
  seasonId: string;
  keeperLimit: number;
}) {
  const { data: teams } = useTeams();
  const { data: rosters } = useRosters(seasonId);
  const [teamId, setTeamId] = useState<string>('');

  // Default to the first team once loaded.
  useEffect(() => {
    if (!teamId && teams?.length) setTeamId(teams[0].id);
  }, [teams, teamId]);

  const keeperCount = (id: string) =>
    (rosters ?? []).filter((r) => r.team_id === id && r.acquisition === 'keeper').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Keepers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Manage keepers for any team ({keeperLimit} max each). Owners can also mark their own via
          the Rosters page. Kept players leave the draft pool automatically.
        </p>
        <div className="space-y-2">
          <Label htmlFor="keeper-team">Team</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger id="keeper-team" className="w-full sm:w-72">
              <SelectValue placeholder="Pick a team" />
            </SelectTrigger>
            <SelectContent>
              {(teams ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({keeperCount(t.id)} / {keeperLimit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {teamId && (
          <KeeperManager
            key={teamId}
            seasonId={seasonId}
            teamId={teamId}
            teamName={teams?.find((t) => t.id === teamId)?.name}
          />
        )}
        <FinalizeKeepersButton seasonId={seasonId} />
      </CardContent>
    </Card>
  );
}

/** Drops all non-keepers and generates empty snake-draft pick slots. Admin-only. */
function FinalizeKeepersButton({ seasonId }: { seasonId: string }) {
  const finalize = useFinalizeKeepers(seasonId);
  const { data: settings } = useDraftSettings(seasonId);
  const { data: rosters } = useRosters(seasonId);
  const keeperCount = (rosters ?? []).filter((r) => r.acquisition === 'keeper').length;
  const orderSet = !!settings?.draft_order?.length;
  const finalized = (settings?.status ?? 'pre_draft') !== 'pre_draft';

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={finalized || !orderSet || finalize.isPending}>
          {finalized ? 'Keepers finalized' : `Finalize keepers (${keeperCount})`}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalize keepers?</AlertDialogTitle>
          <AlertDialogDescription>
            Drops every non-kept player from all rosters, then generates the empty draft pick
            slots ({settings?.roster_size} − {settings?.keeper_limit} ={' '}
            {(settings?.roster_size ?? 0) - (settings?.keeper_limit ?? 0)} rounds ×{' '}
            {settings?.league_size}). Non-keepers return to the pool. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => finalize.mutate()}>Yes, finalize</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DangerZoneCard({ seasonId }: { seasonId: string }) {
  const resetDraft = useResetDraft(seasonId);
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-lg text-destructive">Danger zone</CardTitle>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={resetDraft.isPending}>
              Reset draft
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset the entire draft?</AlertDialogTitle>
              <AlertDialogDescription>
                This clears every pick and all drafted roster spots for the season (keepers are
                kept), restores traded picks to their original teams, and sets the status back to
                pre-draft. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => resetDraft.mutate()}
              >
                Yes, reset draft
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
