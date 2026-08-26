import { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useActiveSeason, useTeams } from '@/api/queries';

type Announcement = {
  id: string;
  fromTeamId: string;
  toTeamId: string;
  override: boolean;
};

export function TradeAnnouncementBanner() {
  const { data: season } = useActiveSeason();
  const { data: teams } = useTeams();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const seasonId = season?.id;
    if (!seasonId) return;

    const announce = (row: Record<string, unknown>) => {
      if (row.season_id !== seasonId || row.status !== 'accepted') return;
      setAnnouncement({
        id: String(row.id),
        fromTeamId: String(row.from_team_id),
        toTeamId: String(row.to_team_id),
        override: Boolean(row.is_admin_override),
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setAnnouncement(null), 7000);
    };

    const channel = supabase
      .channel(`trade-announcements-${seasonId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trades', filter: `season_id=eq.${seasonId}` },
        (payload) => announce(payload.new as Record<string, unknown>),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trades', filter: `season_id=eq.${seasonId}` },
        (payload) => announce(payload.new as Record<string, unknown>),
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [season?.id]);

  if (!announcement) return null;

  const from = teams?.find((team) => team.id === announcement.fromTeamId)?.name ?? 'Team';
  const to = teams?.find((team) => team.id === announcement.toTeamId)?.name ?? 'Team';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex justify-center px-3 sm:top-4">
      <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-primary/40 bg-card px-4 py-3 shadow-2xl shadow-black/30">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ArrowRightLeft className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            {announcement.override ? 'Commissioner trade' : 'Trade alert'}
          </div>
          <div className="mt-0.5 truncate font-bold">{from} ↔ {to}</div>
          <div className="text-xs text-muted-foreground">The league ledger and draft assets have updated live.</div>
        </div>
        <button
          type="button"
          aria-label="Dismiss trade alert"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setAnnouncement(null)}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
