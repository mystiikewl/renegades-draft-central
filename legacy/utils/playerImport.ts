/**
 * Player Import Utilities
 * 
 * This module provides utilities for importing NBA player data from CSV files
 * into the Supabase database with proper validation and error handling.
 */

import { supabase } from '@/integrations/supabase/client';

export interface PlayerData {
  id?: string; // Add id property for existing players from Supabase
  rank?: number | null;
  name: string;
  position: string;
  age?: number | null;
  nba_team: string;
  games_played?: number | null;
  minutes_per_game?: number | null;
  field_goals_made?: number | null;
  field_goal_percentage?: number | null;
  free_throw_percentage?: number | null;
  three_pointers_made?: number | null;
  three_point_percentage?: number | null;
  points?: number | null;
  total_rebounds?: number | null;
  assists?: number | null;
  steals?: number | null;
  blocks?: number | null;
  turnovers?: number | null;
  is_rookie?: boolean;
  is_drafted?: boolean;
  is_keeper?: boolean;
}

export interface ImportResult {
  success: boolean;
  totalPlayers: number;
  validPlayers: number;
  invalidPlayers: number;
  importedPlayers: number;
  errors: string[];
  invalidPlayerDetails: Array<{
    player: string;
    errors: string[];
  }>;
}

/**
 * Parse CSV data into JavaScript objects with proper handling of quoted values
 */
export function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const players: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const player: Record<string, string> = {};
      headers.forEach((header, index) => {
        player[header] = values[index].trim().replace(/^"|"$/g, ''); // Remove surrounding quotes
      });
      players.push(player);
    }
  }

  return players;
}

/**
 * Parse a single CSV line, handling commas within quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values;
}

/**
 * Convert CSV player data to Supabase schema format
 */
export function mapPlayerToSupabaseSchema(csvPlayer: Record<string, string>): PlayerData {
  return {
    rank: parseIntOrNull(csvPlayer.Rank),
    name: csvPlayer.Player || '',
    position: csvPlayer.Position || '',
    age: parseFloatOrNull(csvPlayer.Age),
    nba_team: csvPlayer.Team || '',
    games_played: parseIntOrNull(csvPlayer.GP),
    minutes_per_game: parseFloatOrNull(csvPlayer.MPG),
    field_goals_made: parseFloatOrNull(csvPlayer.FGM),
    field_goal_percentage: parseFloatOrNull(csvPlayer['FG%']),
    free_throw_percentage: parseFloatOrNull(csvPlayer['FT%']),
    three_pointers_made: parseFloatOrNull(csvPlayer['3PM']),
    three_point_percentage: parseFloatOrNull(csvPlayer['3P%']),
    points: parseFloatOrNull(csvPlayer.PTS),
    total_rebounds: parseFloatOrNull(csvPlayer.TREB),
    assists: parseFloatOrNull(csvPlayer.AST),
    steals: parseFloatOrNull(csvPlayer.STL),
    blocks: parseFloatOrNull(csvPlayer.BLK),
    turnovers: parseFloatOrNull(csvPlayer.TO),
    is_rookie: parseIntOrNull(csvPlayer.Rookie) === 1,
    is_drafted: false,
    is_keeper: false
  };
}

/**
 * Parse integer value or return null
 */
function parseIntOrNull(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse float value or return null
 */
function parseFloatOrNull(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Validate player data before insertion
 */
export function validatePlayer(player: PlayerData): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields validation
  if (!player.name || player.name.trim() === '') {
    errors.push('Player name is required');
  }

  if (!player.position || player.position.trim() === '') {
    errors.push('Player position is required');
  }

  if (!player.nba_team || player.nba_team.trim() === '') {
    errors.push('NBA team is required');
  }

  // Data type validation
  if (player.age !== null && player.age !== undefined && (player.age < 18 || player.age > 50)) {
    errors.push('Player age must be between 18 and 50');
  }

  if (player.field_goal_percentage !== null && player.field_goal_percentage !== undefined && 
      (player.field_goal_percentage < 0 || player.field_goal_percentage > 1)) {
    errors.push('Field goal percentage must be between 0 and 1');
  }

  if (player.free_throw_percentage !== null && player.free_throw_percentage !== undefined && 
      (player.free_throw_percentage < 0 || player.free_throw_percentage > 1)) {
    errors.push('Free throw percentage must be between 0 and 1');
  }

  if (player.three_point_percentage !== null && player.three_point_percentage !== undefined && 
      (player.three_point_percentage < 0 || player.three_point_percentage > 1)) {
    errors.push('Three point percentage must be between 0 and 1');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Import players to Supabase in batches
 */
async function importPlayersInBatches(players: PlayerData[], batchSize = 50): Promise<{
  successCount: number;
  errorCount: number;
  errors: string[];
}> {
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize);

    try {
      const { data, error } = await supabase
        .from('players')
        .insert(batch)
        .select();

      if (error) {
        errors.push(`Batch ${Math.floor(i / batchSize) + 1} failed: ${error.message}`);
        errorCount += batch.length;
      } else {
        successCount += data.length;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Batch ${Math.floor(i / batchSize) + 1} failed: ${errorMessage}`);
      errorCount += batch.length;
    }

    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < players.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return {
    successCount,
    errorCount,
    errors
  };
}

/**
 * Clear existing player data from the database
 */
async function clearExistingPlayers(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('players')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('Error clearing existing players:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected error clearing players:', err);
    return false;
  }
}

/**
 * Main import function for CSV data
 */
export async function importPlayersFromCSV(csvContent: string): Promise<ImportResult> {
  try {
    // Parse CSV data
    const csvPlayers = parseCSV(csvContent);
    
    // Convert to Supabase format and validate
    const validPlayers: PlayerData[] = [];
    const invalidPlayerDetails: Array<{ player: string; errors: string[] }> = [];

    for (const csvPlayer of csvPlayers) {
      const player = mapPlayerToSupabaseSchema(csvPlayer);
      const validation = validatePlayer(player);

      if (validation.isValid) {
        validPlayers.push(player);
      } else {
        invalidPlayerDetails.push({
          player: csvPlayer.Player || 'Unknown',
          errors: validation.errors
        });
      }
    }

    if (validPlayers.length === 0) {
      return {
        success: false,
        totalPlayers: csvPlayers.length,
        validPlayers: 0,
        invalidPlayers: invalidPlayerDetails.length,
        importedPlayers: 0,
        errors: ['No valid players to import'],
        invalidPlayerDetails
      };
    }

    // Clear existing data
    const clearSuccess = await clearExistingPlayers();
    if (!clearSuccess) {
      return {
        success: false,
        totalPlayers: csvPlayers.length,
        validPlayers: validPlayers.length,
        invalidPlayers: invalidPlayerDetails.length,
        importedPlayers: 0,
        errors: ['Failed to clear existing player data'],
        invalidPlayerDetails
      };
    }

    // Import players
    const result = await importPlayersInBatches(validPlayers);

    return {
      success: result.successCount > 0,
      totalPlayers: csvPlayers.length,
      validPlayers: validPlayers.length,
      invalidPlayers: invalidPlayerDetails.length,
      importedPlayers: result.successCount,
      errors: result.errors,
      invalidPlayerDetails
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      totalPlayers: 0,
      validPlayers: 0,
      invalidPlayers: 0,
      importedPlayers: 0,
      errors: [errorMessage],
      invalidPlayerDetails: []
    };
  }
}

/**
 * Get current player count from database
 */
export async function getPlayerCount(): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error fetching player count:', error);
      return null;
    }

    return count;
  } catch (err) {
    console.error('Unexpected error fetching player count:', err);
    return null;
  }
}
