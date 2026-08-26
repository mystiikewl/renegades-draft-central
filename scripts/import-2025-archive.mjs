#!/usr/bin/env node

/**
 * Phase 3: Import the archived 2025 season into the new schema as a
 * read-only archived season. Source: archive/*.json (see archive/manifest.json).
 *
 * Idempotent: original UUIDs are preserved and all inserts are upserts,
 * so re-running is safe.
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-2025-archive.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVE = path.join(__dirname, '..', 'archive');
const read = (name) => JSON.parse(fs.readFileSync(path.join(ARCHIVE, name), 'utf8'));

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://xruqdjonzxkzwsslzpdl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const SEASON_LABEL = '2025-26';

// Stats columns from the old players table -> player_seasons.stats JSONB
const STAT_FIELDS = [
  'rank', 'age', 'games_played', 'minutes_per_game', 'field_goals_made',
  'field_goal_percentage', 'free_throw_percentage', 'three_pointers_made',
  'three_point_percentage', 'points', 'total_rebounds', 'assists', 'steals',
  'blocks', 'turnovers', 'double_doubles', 'triple_doubles', 'is_rookie',
];

async function upsert(table, rows, onConflict) {
  if (!rows.length) return 0;
  const { error } = await supabase.from(table).upsert(rows, { onConflict, ignoreDuplicates: false });
  if (error) throw new Error(`${table}: ${error.message}`);
  return rows.length;
}

async function main() {
  const teamsAll = read('teams.json');
  const profiles = read('profiles.json');
  const players = read('players.json');
  const picks = read('draft_picks.json');
  const keepers = read('keepers.json');
  const favourites = read('user_favourites.json');
  const settings = read('draft_settings.json')[0];

  // ---- Only the 10 real league teams (referenced by profiles/picks/keepers)
  const usedTeamIds = new Set();
  profiles.forEach((p) => p.team_id && usedTeamIds.add(p.team_id));
  picks.forEach((p) => { usedTeamIds.add(p.current_team_id); usedTeamIds.add(p.original_team_id); });
  keepers.forEach((k) => usedTeamIds.add(k.team_id));
  const teams = teamsAll.filter((t) => usedTeamIds.has(t.id));
  console.log(`teams: ${teams.length} of ${teamsAll.length} (referenced only)`);

  // ---- Season
  const { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .upsert(
      { label: SEASON_LABEL, status: 'archived', is_active: false },
      { onConflict: 'label', ignoreDuplicates: false }
    )
    .select('id')
    .single();
  if (seasonErr) throw new Error(`seasons: ${seasonErr.message}`);
  const seasonId = season.id;
  console.log(`season: ${SEASON_LABEL} -> ${seasonId} (archived)`);

  // ---- Teams (preserve ids; ownership set after profiles insert)
  console.log(`teams: ${await upsert('teams', teams.map((t) => ({ id: t.id, name: t.name })), 'id')} upserted`);

  // ---- Profiles (id = old user_id = auth.users.id)
  console.log(`profiles: ${await upsert('profiles', profiles.map((p) => ({
    id: p.user_id,
    email: p.email,
    display_name: p.email.split('@')[0],
    team_id: p.team_id,
    is_admin: !!p.is_admin,
  })), 'id')} upserted`);

  // ---- Team ownership from old owner_email -> profile
  const profileByEmail = new Map(profiles.map((p) => [p.email, p]));
  for (const t of teams) {
    const ownerId = profileByEmail.get(t.owner_email)?.user_id;
    if (!ownerId) continue;
    const { error: ownerErr } = await supabase
      .from('teams')
      .update({ owner_profile_id: ownerId })
      .eq('id', t.id);
    if (ownerErr) throw new Error(`team owner ${t.name}: ${ownerErr.message}`);
  }
  console.log(`team ownership: linked to owners`);

  // ---- Players (bio only, ids preserved)
  console.log(`players: ${await upsert('players', players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    nba_team: p.nba_team,
  })), 'id')} upserted`);

  // ---- Player seasons (old inline stats -> JSONB)
  console.log(`player_seasons: ${await upsert('player_seasons', players.map((p) => ({
    player_id: p.id,
    season_id: seasonId,
    stats: Object.fromEntries(STAT_FIELDS.map((f) => [f, p[f] ?? null])),
  })), 'player_id,season_id')} upserted`);

  // ---- Draft settings (2025 was linear, completed)
  console.log(`draft_settings: ${await upsert('draft_settings', [{
    season_id: seasonId,
    league_size: settings.league_size,
    roster_size: settings.roster_size,
    draft_type: settings.draft_type === 'linear' ? 'linear' : 'snake',
    pick_time_limit_seconds: settings.pick_time_limit_seconds,
    status: 'complete',
    draft_order: settings.draft_order ?? [],
  }], 'season_id')} upserted`);

  // ---- Draft picks (board slots, ids preserved). Old pick_number was the
  // within-round slot (1..10); convert to overall 1..80 for the new schema.
  const leagueSize = settings.league_size ?? 10;
  console.log(`draft_picks: ${await upsert('draft_picks', picks.map((p) => ({
    id: p.id,
    season_id: seasonId,
    round: p.round,
    pick_number: (p.round - 1) * leagueSize + p.pick_number,
    team_id: p.current_team_id,
    original_team_id: p.original_team_id,
    player_id: p.player_id,
    is_used: p.is_used,
    picked_at: p.created_at,
  })), 'id')} upserted`);

  // ---- Rosters: keepers first, then drafted picks (unique per season+player)
  const rosterRows = new Map(); // key: player_id
  for (const k of keepers) {
    if (!rosterRows.has(k.player_id)) {
      rosterRows.set(k.player_id, {
        season_id: seasonId, team_id: k.team_id, player_id: k.player_id, acquisition: 'keeper',
        acquired_at: k.created_at,
      });
    }
  }
  for (const p of picks) {
    if (p.is_used && p.player_id && !rosterRows.has(p.player_id)) {
      rosterRows.set(p.player_id, {
        season_id: seasonId, team_id: p.current_team_id, player_id: p.player_id,
        acquisition: 'draft', draft_pick_id: p.id, acquired_at: p.created_at,
      });
    }
  }
  const keeperCount = [...rosterRows.values()].filter((r) => r.acquisition === 'keeper').length;
  console.log(`rosters: ${await upsert('rosters', [...rosterRows.values()], 'season_id,player_id')} upserted (${keeperCount} keepers, ${rosterRows.size - keeperCount} drafted)`);

  // ---- Favourites (old user_id -> new profile_id)
  const validPlayers = new Set(players.map((p) => p.id));
  const favRows = favourites
    .filter((f) => validPlayers.has(f.player_id))
    .map((f) => ({ profile_id: f.user_id, player_id: f.player_id, season_id: seasonId }));
  console.log(`user_favourites: ${await upsert('user_favourites', favRows, 'profile_id,player_id,season_id')} upserted`);

  console.log('\n2025 season imported as archived. Users can log in with existing credentials.');
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
