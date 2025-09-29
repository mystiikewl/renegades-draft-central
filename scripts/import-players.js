#!/usr/bin/env node

/**
 * NBA Player Data Import Script
 * 
 * This script reads the NBA player CSV data and imports it into the Supabase players table.
 * It handles data validation, field mapping, and error handling for the import process.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const SUPABASE_URL = "https://xruqdjonzxkzwsslzpdl.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhydXFkam9uenhrendzc2x6cGRsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTMwMDk5MiwiZXhwIjoyMDcwODc2OTkyfQ.QK-J3x5kLFmcAOIAPq5b22FmPp2rVs0-8Qspi5nG_Dw";

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/**
 * Parse CSV data into JavaScript objects
 * @param {string} csvContent - Raw CSV content
 * @returns {Array} Array of player objects
 */
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');
  const players = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const player = {};
      headers.forEach((header, index) => {
        player[header.trim()] = values[index].trim();
      });
      players.push(player);
    }
  }

  return players;
}

/**
 * Parse a single CSV line, handling commas within quoted values
 * @param {string} line - CSV line to parse
 * @returns {Array} Array of values
 */
function parseCSVLine(line) {
  const values = [];
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
 * @param {Object} csvPlayer - Player data from CSV
 * @returns {Object} Player data formatted for Supabase
 */
function mapPlayerToSupabaseSchema(csvPlayer) {
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
 * @param {string} value - String value to parse
 * @returns {number|null} Parsed integer or null
 */
function parseIntOrNull(value) {
  if (!value || value.trim() === '') return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse float value or return null
 * @param {string} value - String value to parse
 * @returns {number|null} Parsed float or null
 */
function parseFloatOrNull(value) {
  if (!value || value.trim() === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Validate player data before insertion
 * @param {Object} player - Player data to validate
 * @returns {Object} Validation result with isValid and errors
 */
function validatePlayer(player) {
  const errors = [];

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
  if (player.age !== null && (player.age < 18 || player.age > 50)) {
    errors.push('Player age must be between 18 and 50');
  }

  if (player.field_goal_percentage !== null && (player.field_goal_percentage < 0 || player.field_goal_percentage > 1)) {
    errors.push('Field goal percentage must be between 0 and 1');
  }

  if (player.free_throw_percentage !== null && (player.free_throw_percentage < 0 || player.free_throw_percentage > 1)) {
    errors.push('Free throw percentage must be between 0 and 1');
  }

  if (player.three_point_percentage !== null && (player.three_point_percentage < 0 || player.three_point_percentage > 1)) {
    errors.push('Three point percentage must be between 0 and 1');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Import players to Supabase in batches
 * @param {Array} players - Array of player objects
 * @param {number} batchSize - Number of players to insert per batch
 */
async function importPlayersInBatches(players, batchSize = 50) {
  console.log(`Starting import of ${players.length} players in batches of ${batchSize}...`);
  
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(players.length / batchSize)} (${batch.length} players)...`);

    try {
      const { data, error } = await supabase
        .from('players')
        .insert(batch)
        .select();

      if (error) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
        errors.push({
          batch: Math.floor(i / batchSize) + 1,
          error: error.message,
          players: batch.map(p => p.name)
        });
        errorCount += batch.length;
      } else {
        console.log(`Batch ${Math.floor(i / batchSize) + 1} completed successfully (${data.length} players inserted)`);
        successCount += data.length;
      }
    } catch (err) {
      console.error(`Unexpected error in batch ${Math.floor(i / batchSize) + 1}:`, err);
      errors.push({
        batch: Math.floor(i / batchSize) + 1,
        error: err.message,
        players: batch.map(p => p.name)
      });
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
async function clearExistingPlayers() {
  console.log('Clearing existing player data...');
  
  try {
    const { error } = await supabase
      .from('players')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('Error clearing existing players:', error);
      return false;
    }

    console.log('Existing player data cleared successfully');
    return true;
  } catch (err) {
    console.error('Unexpected error clearing players:', err);
    return false;
  }
}

/**
 * Main import function
 */
async function main() {
  try {
    console.log('NBA Player Data Import Script');
    console.log('============================');

    // No authentication needed with service role key
    console.log('Using Supabase Service Role Key for direct access.');

    // Find the CSV file
    const csvPath = path.join(__dirname, '../../nba_player_stats.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV file not found at: ${csvPath}`);
      console.error('Please ensure the nba_player_stats.csv file exists in the project root');
      process.exit(1);
    }

    console.log(`Reading CSV file: ${csvPath}`);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV data
    console.log('Parsing CSV data...');
    const csvPlayers = parseCSV(csvContent);
    console.log(`Parsed ${csvPlayers.length} players from CSV`);

    // Convert to Supabase format and validate
    console.log('Converting and validating player data...');
    const validPlayers = [];
    const invalidPlayers = [];

    for (const csvPlayer of csvPlayers) {
      const player = mapPlayerToSupabaseSchema(csvPlayer);
      const validation = validatePlayer(player);

      if (validation.isValid) {
        validPlayers.push(player);
      } else {
        invalidPlayers.push({
          player: csvPlayer.Player || 'Unknown',
          errors: validation.errors
        });
      }
    }

    console.log(`Valid players: ${validPlayers.length}`);
    console.log(`Invalid players: ${invalidPlayers.length}`);

    if (invalidPlayers.length > 0) {
      console.log('\nInvalid players found:');
      invalidPlayers.forEach(({ player, errors }) => {
        console.log(`- ${player}: ${errors.join(', ')}`);
      });
    }

    if (validPlayers.length === 0) {
      console.error('No valid players to import');
      process.exit(1);
    }

    // Clear existing data
    const clearSuccess = await clearExistingPlayers();
    if (!clearSuccess) {
      console.error('Failed to clear existing player data');
      process.exit(1);
    }

    // Import players
    const result = await importPlayersInBatches(validPlayers);

    // Report results
    console.log('\nImport Results:');
    console.log('==============');
    console.log(`Successfully imported: ${result.successCount} players`);
    console.log(`Failed to import: ${result.errorCount} players`);

    if (result.errors.length > 0) {
      console.log('\nErrors encountered:');
      result.errors.forEach(({ batch, error, players }) => {
        console.log(`Batch ${batch}: ${error}`);
        console.log(`  Players: ${players.join(', ')}`);
      });
    }

    if (result.successCount > 0) {
      console.log('\n✅ Player data import completed successfully!');
    } else {
      console.log('\n❌ Player data import failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('Fatal error during import:', error);
    process.exit(1);
  }
}

// Run the import if this script is executed directly
if (process.argv[1] && process.argv[1].endsWith('import-players.js')) {
  main();
}

export { main as importPlayers };
