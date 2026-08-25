import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Per-player game log, fetched live from ESPN's public gamelog endpoint keyed
 * by the espn_id we already store on players. No table — fetch-through-cache
 * with a 15-min staleTime (games don't resolve faster than that for our use).
 */

export interface GameLogRow {
  gameId: string;
  date: string;
  opponent: string;
  location: 'vs' | '@';
  result: string;
  score: string;
  min: string;
  pts: string;
  reb: string;
  ast: string;
  stl: string;
  blk: string;
  to: string;
  fgm_fga: string;
  tp_tpa: string;
  ft_fta: string;
}

interface EspnGame {
  id: string;
  atVs?: string;
  gameDate: string;
  score?: string;
  gameResult?: string;
  opponent?: { abbreviation?: string };
}

const STATS_SEASON = 2026; // ESPN year for the 2025-26 campaign

async function fetchGameLog(espnId: string): Promise<GameLogRow[]> {
  const res = await fetch(
    `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}/gamelog?season=${STATS_SEASON}`,
  );
  if (!res.ok) throw new Error(`ESPN gamelog: HTTP ${res.status}`);
  const j = await res.json();

  // names are stable camelCase keys; labels are display abbreviations
  const names: string[] = j.names ?? [];
  const idx = (name: string) => names.findIndex((n) => n.startsWith(name));
  const iMin = idx('minutes');
  const iPts = idx('points');
  const iReb = idx('totalRebounds');
  const iAst = idx('assists');
  const iStl = idx('steals');
  const iBlk = idx('blocks');
  const iTo = idx('turnovers');
  const iFg = idx('fieldGoalsMade');
  const iTp = idx('threePointFieldGoalsMade');
  const iFt = idx('freeThrowsMade');

  // Regular season section only; categories are month buckets of {eventId, stats}.
  const reg = (j.seasonTypes as { displayName: string; categories: { events: { eventId: string; stats: string[] }[] }[] }[])
    ?.find((s) => s.displayName.includes('Regular Season'));
  if (!reg) return [];

  const games = j.events as Record<string, EspnGame>;
  const rows: GameLogRow[] = [];
  for (const cat of reg.categories) {
    for (const ev of cat.events) {
      const g = games[ev.eventId];
      if (!g || !ev.stats) continue;
      const v = (i: number) => (i >= 0 ? (ev.stats[i] ?? '—') : '—');
      rows.push({
        gameId: ev.eventId,
        date: new Date(g.gameDate).toISOString().slice(0, 10),
        opponent: g.opponent?.abbreviation ?? '—',
        location: g.atVs === '@' ? '@' : 'vs',
        result: g.gameResult ?? '—',
        score: g.score ?? '—',
        min: v(iMin),
        pts: v(iPts),
        reb: v(iReb),
        ast: v(iAst),
        stl: v(iStl),
        blk: v(iBlk),
        to: v(iTo),
        fgm_fga: v(iFg),
        tp_tpa: v(iTp),
        ft_fta: v(iFt),
      });
    }
  }
  // ponytail: newest-first by date; ESPN's month buckets are already ordered
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function useGameLog(espnId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['game-log', espnId],
    enabled: enabled && !!espnId,
    staleTime: 15 * 60 * 1000,
    retry: false,
    queryFn: () => fetchGameLog(espnId!),
  });
}
