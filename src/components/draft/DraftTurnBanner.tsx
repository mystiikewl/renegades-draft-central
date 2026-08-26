import { Link, useLocation } from '@tanstack/react-router';
import { ArrowRight, Clock3 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useActiveSeason, useDraftPicks, useDraftSettings } from '@/api/queries';
import { useDraftRealtime } from '@/api/realtime';

/** Pull a manager back into the live draft when their turn arrives elsewhere in the app. */
export function DraftTurnBanner() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const { data: season } = useActiveSeason();
  const seasonId = season?.id;
  useDraftRealtime(seasonId);
  const { data: settings } = useDraftSettings(seasonId);
  const { data: picks } = useDraftPicks(seasonId);

  const nextPick = picks?.find((pick) => !pick.is_used) ?? null;
  const isMyTurn =
    settings?.status === 'running' &&
    !!profile?.team_id &&
    !!nextPick &&
    nextPick.team_id === profile.team_id;

  // Draft and Pool already have full on-clock treatments; avoid stacking banners there.
  if (!isMyTurn || pathname === '/' || pathname === '/pool') return null;

  return (
    <div className="sticky top-0 z-50 border-b border-draft-active/40 bg-background/95 px-3 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-draft-active/10 text-draft-active">
          <Clock3 className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-draft-active">It's your pick</div>
          <div className="truncate text-sm font-semibold">Pick #{nextPick.pick_number} is yours</div>
        </div>
        <Link
          to="/pool"
          className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          Pick player <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
