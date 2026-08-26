#!/usr/bin/env node

/**
 * Alias-aware player dedupe: link 2025-archive players (espn_id null) to their
 * ESPN-imported twins even when the names differ (Alexandre Sarr -> Alex Sarr),
 * re-point child rows onto the ESPN row, delete the orphan.
 *
 * Superset of dedupe-players.mjs (which only merges exact normalized names).
 * Re-running is a no-op. --dry-run prints the merge plan without writing.
 *
 * Usage:  node scripts/fix-players.mjs [--dry-run]
 * Env:    SUPABASE_ACCESS_TOKEN, optional SUPABASE_PROJECT_REF
 */

import { pathToFileURL } from 'url';

const REF = process.env.SUPABASE_PROJECT_REF ?? 'xruqdjonzxkzwsslzpdl';

// First-name variants ESPN collapses or expands vs. the archive data.
const FIRST_NAME_ALIASES = {
  alexandre: 'alex', alexander: 'alex', alexei: 'alex',
  nicholas: 'nick', nicolas: 'nick', dominik: 'dom',
  joshua: 'josh', matthew: 'matt', matthews: 'matt',
  zachary: 'zach', zacharie: 'zach',
  christopher: 'chris', cristopher: 'chris',
  james: 'james', jimmy: 'jimmy',
  michael: 'mike', mike: 'mike', daniel: 'danny',
  william: 'will', williams: 'will', cameron: 'cam',
};

// normalized-name matcher: lowercase, strip accents/diacritics + non-alphanumerics,
// with the first token alias-substituted.
function norm(name, aliasFirstToken = true) {
  const s = String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!aliasFirstToken) return s;
  for (const [from, to] of Object.entries(FIRST_NAME_ALIASES)) {
    if (s.startsWith(from) && s.slice(from.length) !== '') {
      return to + s.slice(from.length);
    }
  }
  return s;
}

export async function fixPlayers({ dryRun = false, log = console.log } = {}) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('Missing SUPABASE_ACCESS_TOKEN');
  const q = async (query) => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r.json();
  };

  const players = await q('select id, espn_id, name, position, nba_team from public.players');
  const canonical = players.filter((p) => p.espn_id); // espn-imported, keep these
  const orphans = players.filter((p) => !p.espn_id); // archive twins, delete these

  const byPlain = new Map(canonical.map((p) => [norm(p.name, false), p]));
  const byAlias = new Map(canonical.map((p) => [norm(p.name, true), p]));

  const merges = [];
  for (const orphan of orphans) {
    // alias-aware normalized match only. Deliberately NO last-name fallback:
    // brothers/relatives (Kevin vs Caleb Love, Isaiah vs Evan Mobley) share
    // last names and would be merged as false positives.
    const match = byAlias.get(norm(orphan.name, true)) ?? byPlain.get(norm(orphan.name, false));
    if (match) merges.push({ orphan, keep: match });
  }
  if (!merges.length) log('No orphan/canonical merge candidates found.');
  for (const { orphan, keep } of merges) {
    log(`  merge: "${orphan.name}" [${orphan.id.slice(0, 8)}] -> "${keep.name}" espn:${keep.espn_id} [${keep.id.slice(0, 8)}]`);
  }

  if (dryRun) {
    log('--dry-run: no writes.');
    return { candidates: merges.length };
  }

  const esc = (s) => String(s).replace(/'/g, "''");
  let merged = 0;
  for (const { orphan, keep } of merges) {
    // One atomic DO block per pair: stats/favourites/picks re-point directly;
    // rosters must respect unique(season_id, player_id) — if the keep row
    // already holds the season slot, drop the orphan's duplicate row instead.
    await q(`
      do $$
      declare n bigint;
      begin
        insert into public.player_seasons (player_id, season_id, stats)
        select '${keep.id}', s.season_id, s.stats
        from public.player_seasons s where s.player_id = '${orphan.id}'
        on conflict (player_id, season_id) do nothing;
        delete from public.player_seasons where player_id = '${orphan.id}';

        delete from public.rosters r
        using public.rosters r2
        where r.player_id = '${orphan.id}'
          and r2.player_id = '${keep.id}'
          and r2.season_id = r.season_id;
        get diagnostics n = row_count; raise notice 'roster dupes dropped: %', n;

        update public.rosters set player_id = '${keep.id}' where player_id = '${orphan.id}';
        update public.user_favourites set player_id = '${keep.id}' where player_id = '${orphan.id}';
        update public.draft_picks set player_id = '${keep.id}' where player_id = '${orphan.id}';

        -- fill gaps in the keeper's bio from the orphan before deleting it
        update public.players k set
          position = coalesce(k.position, '${esc(orphan.position ?? '')}'::text),
          nba_team = coalesce(k.nba_team, '${esc(orphan.nba_team ?? '')}'::text)
        where k.id = '${keep.id}';

        delete from public.players p where p.id = '${orphan.id}';
      end $$;
    `);
    merged++;
    log(`  merged ${orphan.name} -> ${keep.name}`);
  }

  const remaining = await q(
    'select count(*) total, count(*) filter (where espn_id is null) no_espn from public.players',
  );
  log('players:', JSON.stringify(remaining[0]));
  return { merged };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await fixPlayers({ dryRun: process.argv.includes('--dry-run') });
    console.log('Done:', result);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
