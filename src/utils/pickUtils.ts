import type { DraftPickWithRelations } from '@/integrations/supabase/types/draftPicks';

/**
 * Formats pick number consistently across components
 * Uses the same approach as DraftHero component for consistency
 *
 * @param currentPickIndex - Zero-based index of current pick (0, 1, 2, etc.)
 * @returns Formatted pick number string with leading zero for single digits
 */
export const formatPickNumber = (currentPickIndex: number): string => {
  return String(currentPickIndex + 1).padStart(2, '0');
};

/**
 * Alternative calculation using round and pick_number (for reference/debugging)
 * This is the proper mathematical calculation but less efficient than using index
 */
export const calculatePickNumberFromRound = (
  round: number,
  pickNumber: number,
  teamCount: number
): string => {
  const overallPick = (round - 1) * teamCount + pickNumber;
  return String(overallPick).padStart(2, '0');
};

/**
 * Validates pick number calculation consistency
 */
export const validatePickNumber = (
  currentPick: DraftPickWithRelations,
  currentPickIndex: number,
  teamCount: number
): { isValid: boolean; expected: string; actual: string } => {
  const fromIndex = formatPickNumber(currentPickIndex);
  const fromRound = calculatePickNumberFromRound(currentPick.round, currentPick.pick_number, teamCount);

  return {
    isValid: fromIndex === fromRound,
    expected: fromIndex,
    actual: fromRound
  };
};