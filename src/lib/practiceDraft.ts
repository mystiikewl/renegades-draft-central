import type { DraftPick, DraftSettings, PlayerWithStats } from '@/api/types';
import { LEAGUE_CATEGORIES, zScores } from '@/lib/projections';

/**
 * Build a disposable board for practice mode.
 *
 * When the real board already exists we clone its slot ownership so traded picks
 * are represented, but deliberately strip every live result. When it does not
 * exist yet, generate the configured snake/linear order locally. Nothing here
 * writes to Supabase.
 */
export function buildPracticeBoard(settings: DraftSettings, sourcePicks: DraftPick[]): DraftPick[] {
  if (sourcePicks.length > 0) {
    return sourcePicks
      .slice()
      .sort((a, b) => a.pick_number - b.pick_number)
      .map((pick) => ({
        ...pick,
        player_id: null,
        is_used: false,
        is_skipped: false,
        skipped_at: null,
        picked_at: null,
        players: null,
      }));
  }

  const order = settings.draft_order ?? [];
  if (order.length === 0 || settings.roster_size <= 0) return [];

  const picks: DraftPick[] = [];
  let pickNumber = 1;
  for (let round = 1; round <= settings.roster_size; round += 1) {
    const roundOrder = settings.draft_type === 'snake' && round % 2 === 0
      ? [...order].reverse()
      : order;

    for (const teamId of roundOrder) {
      picks.push({
        id: `practice-${pickNumber}`,
        season_id: settings.season_id,
        round,
        pick_number: pickNumber,
        team_id: teamId,
        original_team_id: teamId,
        player_id: null,
        is_used: false,
        is_skipped: false,
        skipped_at: null,
        picked_at: null,
        players: null,
        team: null,
      });
      pickNumber += 1;
    }
  }
  return picks;
}

export function availablePracticePlayers(players: PlayerWithStats[], picks: DraftPick[]): PlayerWithStats[] {
  const drafted = new Set(picks.flatMap((pick) => pick.player_id ? [pick.player_id] : []));
  return players.filter((player) => !drafted.has(player.id));
}

/**
 * Deterministic 13-category value for CPU drafting. Z-scores keep counting and
 * percentage categories on comparable scales; turnovers are already inverted
 * by zScores(). This is intentionally simple and predictable rather than an AI
 * opponent hidden behind network calls.
 */
export function practiceScores(players: PlayerWithStats[]): Map<string, number> {
  const totals = new Map<string, number>(players.map((player) => [player.id, 0]));
  for (const category of LEAGUE_CATEGORIES) {
    const categoryScores = zScores(players, category, 'totals');
    for (const player of players) {
      totals.set(player.id, (totals.get(player.id) ?? 0) + (categoryScores.get(player.id) ?? 0));
    }
  }
  return totals;
}

export function bestPracticePlayer(players: PlayerWithStats[]): PlayerWithStats | null {
  if (players.length === 0) return null;
  const scores = practiceScores(players);
  return [...players].sort((a, b) => {
    const diff = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
    return diff || a.name.localeCompare(b.name);
  })[0] ?? null;
}

export function makePracticePick(picks: DraftPick[], pickId: string, player: PlayerWithStats): DraftPick[] {
  if (picks.some((pick) => pick.player_id === player.id)) return picks;
  return picks.map((pick) =>
    pick.id === pickId && !pick.is_used
      ? {
          ...pick,
          player_id: player.id,
          is_used: true,
          is_skipped: false,
          picked_at: new Date().toISOString(),
          players: {
            name: player.name,
            position: player.position,
            nba_team: player.nba_team,
            espn_id: player.espn_id,
          },
        }
      : pick,
  );
}

export function skipPracticePick(picks: DraftPick[], pickId: string): DraftPick[] {
  return picks.map((pick) =>
    pick.id === pickId && !pick.is_used
      ? {
          ...pick,
          is_used: true,
          is_skipped: true,
          skipped_at: new Date().toISOString(),
          picked_at: null,
          player_id: null,
          players: null,
        }
      : pick,
  );
}
