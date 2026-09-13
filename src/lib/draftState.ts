import type { DraftPick, Team } from '@/api/types';

/**
 * The pick on the clock: the first unused slot. Silently depends on the pick
 * list arriving in pick_number order (useDraftPicks orders by it) — one named
 * home for the rule that eight call sites previously restated.
 */
export function nextPick(picks: DraftPick[]): DraftPick | null {
  return picks.find((pick) => !pick.is_used) ?? null;
}

/** id -> Team index for O(1) lookups; callers keep their own display fallbacks. */
export function teamById(teams: Team[] | undefined): Map<string, Team> {
  return new Map((teams ?? []).map((team) => [team.id, team]));
}
