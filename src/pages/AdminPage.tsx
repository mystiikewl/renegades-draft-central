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
import { GripVertical } from 'lucide-react';
import { useActiveSeason, useDraftPicks, useDraftSettings, useRosters, useTeams } from '@/api/queries';
import {
  useCreateSeason,
  useResetDraft,
  useSetDraftOrder,
  useSetDraftStatus,
} from '@/api/mutations';
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

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-muted-foreground">
          {season ? `Managing ${season.label}` : 'No active season'}
        </p>
      </div>

      <CreateSeasonCard
        onCreate={(label) => createSeason.mutate(label)}
        pending={createSeason.isPending}
        label={newSeasonLabel}
        setLabel={setNewSeasonLabel}
      />

      {seasonId && settings && (
        <>
          <DraftOrderCard seasonId={seasonId} locked={picksUsed} />
          <DraftStatusCard seasonId={seasonId} status={settings.status} />
          <AdminKeepersCard seasonId={seasonId} keeperLimit={settings.keeper_limit} />
          <DangerZoneCard seasonId={seasonId} />
        </>
      )}
      {seasonId && !settings && <Skeleton className="h-40 w-full" />}
    </div>
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
            (snake rounds per settings). {dirty && <span className="text-primary">Unsaved changes.</span>}
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
      </CardContent>
    </Card>
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
