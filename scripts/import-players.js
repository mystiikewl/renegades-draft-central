#!/usr/bin/env node

/**
 * Legacy CSV player importer.
 *
 * Requires a Supabase service-role key from the local environment. Never put a
 * service-role key in source control; it bypasses row-level security.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing Supabase credentials. Set VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
}

function parseCSV(content) {
  const lines = content.replace(/\r\n/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).flatMap((line) => {
    const values = parseCSVLine(line);
    if (values.length !== headers.length) return [];
    return [Object.fromEntries(headers.map((header, index) => [header, values[index].trim()]))];
  });
}

function integerOrNull(value) {
  if (!value || value.trim() === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrNull(value) {
  if (!value || value.trim() === '') return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapPlayer(row) {
  return {
    rank: integerOrNull(row.Rank),
    name: row.Player || '',
    position: row.Position || '',
    age: numberOrNull(row.Age),
    nba_team: row.Team || '',
    games_played: integerOrNull(row.GP),
    minutes_per_game: numberOrNull(row.MPG),
    field_goals_made: numberOrNull(row.FGM),
    field_goal_percentage: numberOrNull(row['FG%']),
    free_throw_percentage: numberOrNull(row['FT%']),
    three_pointers_made: numberOrNull(row['3PM']),
    three_point_percentage: numberOrNull(row['3P%']),
    points: numberOrNull(row.PTS),
    total_rebounds: numberOrNull(row.TREB),
    assists: numberOrNull(row.AST),
    steals: numberOrNull(row.STL),
    blocks: numberOrNull(row.BLK),
    turnovers: numberOrNull(row.TO),
    is_rookie: integerOrNull(row.Rookie) === 1,
    is_drafted: false,
    is_keeper: false,
  };
}

function validatePlayer(player) {
  const errors = [];
  if (!player.name.trim()) errors.push('player name is required');
  if (!player.position.trim()) errors.push('position is required');
  if (!player.nba_team.trim()) errors.push('NBA team is required');
  if (player.age !== null && (player.age < 18 || player.age > 50)) errors.push('age must be between 18 and 50');

  for (const [label, value] of [
    ['FG%', player.field_goal_percentage],
    ['FT%', player.free_throw_percentage],
    ['3P%', player.three_point_percentage],
  ]) {
    if (value !== null && (value < 0 || value > 1)) errors.push(`${label} must be between 0 and 1`);
  }
  return errors;
}

async function clearExistingPlayers() {
  const { error } = await supabase
    .from('players')
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

async function importBatches(players, batchSize = 50) {
  let imported = 0;
  for (let index = 0; index < players.length; index += batchSize) {
    const batch = players.slice(index, index + batchSize);
    const { data, error } = await supabase.from('players').insert(batch).select();
    if (error) throw new Error(`Batch ${Math.floor(index / batchSize) + 1}: ${error.message}`);
    imported += data?.length ?? batch.length;
  }
  return imported;
}

async function main() {
  const csvPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, '../nba_player_stats.csv');

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  const validPlayers = [];
  const invalidPlayers = [];

  for (const row of rows) {
    const mapped = mapPlayer(row);
    const errors = validatePlayer(mapped);
    if (errors.length) invalidPlayers.push({ name: mapped.name || 'Unknown', errors });
    else validPlayers.push(mapped);
  }

  if (invalidPlayers.length) {
    console.warn(`Skipping ${invalidPlayers.length} invalid rows:`);
    for (const invalid of invalidPlayers) console.warn(`- ${invalid.name}: ${invalid.errors.join(', ')}`);
  }
  if (!validPlayers.length) throw new Error('No valid players to import.');

  console.log(`Replacing players with ${validPlayers.length} validated CSV rows...`);
  await clearExistingPlayers();
  const imported = await importBatches(validPlayers);
  console.log(`Imported ${imported} players.`);
}

if (process.argv[1] && process.argv[1].endsWith('import-players.js')) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export { main as importPlayers };
