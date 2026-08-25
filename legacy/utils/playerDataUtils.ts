import { Tables } from '@/integrations/supabase/types';

export type Player = Tables<'players'>;
export type Keeper = Tables<'keepers'>;
export type KeeperPlayer = Keeper & { player: Player };

/**
 * Transforms keeper data to ensure consistent structure
 * Handles cases where keeper data might be malformed or missing player information
 */
export function transformKeeperData(keepers: any[]): KeeperPlayer[] {
  if (!keepers || !Array.isArray(keepers)) {
    return [];
  }

  return keepers
    .filter(keeper => keeper && keeper.player) // Remove keepers with null players
    .map(keeper => ({
      ...keeper,
      player: keeper.player,
      // Ensure consistent structure
      team_id: keeper.team_id || keeper.keeper_team_id,
      is_keeper: true,
      is_drafted: true
    }));
}

/**
 * Transforms drafted player data to ensure consistent structure
 */
export function transformDraftedPlayerData(players: Player[]): Player[] {
  if (!players || !Array.isArray(players)) {
    return [];
  }

  return players.map(player => ({
    ...player,
    is_keeper: false,
    is_drafted: true
  }));
}

/**
 * Combines and transforms both drafted players and keepers into a unified format
 */
export function getCombinedPlayersForTeam(
  draftedPlayers: Player[],
  keepers: any[]
): Player[] {
  try {
    const transformedKeepers = transformKeeperData(keepers);
    const transformedDrafted = transformDraftedPlayerData(draftedPlayers);

    // Convert keepers to player format for consistency
    const keeperPlayers = transformedKeepers
      .filter(keeper => keeper.player)
      .map(keeper => ({
        ...keeper.player!,
        is_keeper: true,
        is_drafted: true,
        drafted_by_team_id: keeper.team_id
      }));

    return [...transformedDrafted, ...keeperPlayers];
  } catch (error) {
    console.error('Error combining players for team:', error);
    // Fallback to just drafted players if there's an error
    return transformDraftedPlayerData(draftedPlayers);
  }
}

/**
 * Validates keeper data structure
 */
export function validateKeeperData(keeper: any): keeper is KeeperPlayer {
  return (
    keeper &&
    typeof keeper === 'object' &&
    keeper.player &&
    typeof keeper.player === 'object' &&
    keeper.team_id &&
    keeper.season
  );
}

/**
 * Logs keeper data for debugging
 */
export function debugKeeperData(keepers: any[], context: string) {
  console.group(`Keeper Data Debug - ${context}`);
  console.log('Total keepers:', keepers.length);
  console.log('First keeper structure:', keepers[0]);
  console.log('Valid keepers:', keepers.filter(validateKeeperData).length);
  console.log('Invalid keepers:', keepers.filter(k => !validateKeeperData(k)).length);
  console.groupEnd();
}