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
  nicholas: 'nic', nicolas: 'nic', dominik: 'dom',
  joshua: 'josh', matthew: 'matt', matthews: 'matt',
  zachary: 'zach', zacharie: 'zach',
  christopher: 'chris', cristopher: 'chris',
  james: 'james', jimmy: 'jimmy',
  michael: 'mike', mike: 'mike', daniel: 'danny',
  william: 'will', williams: 'will', cameron: 'cam',
  // CSV-archive vs ESPN display-name variants seen in our data
  carlton: 'bub', ron: 'ronald',
};

// Normalized name: lowercase, accents stripped, non-alphanumerics removed.
function plainNorm(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// All normalized forms a name can match under: the plain form plus the
// first-token alias substitution. Matching = any shared form.
function nameKeys(name) {
  const s = plainNorm(name);
  const keys = new Set([s]);
  for (const [from, to] of Object.entries(FIRST_NAME_ALIASES)) {
    if (s.startsWith(from) && s.slice(from.length) !== '') {
      keys.add(to + s.slice(from.length));
    }
  }
  return keys;
}

function namesMatch(a, b) {
  const kb = nameKeys(b);
  for (const k of nameKeys(a)) if (kb.has(k)) return true;
  return false;
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

  // index canonicals by every normalized form they can match under
  const byKey = new Map();
  for (const p of canonical) {
    for (const k of nameKeys(p.name)) {
      if (!byKey.has(k)) byKey.set(k, p);
    }
  }

  const merges = [];
  for (const orphan of orphans) {
    // alias-aware normalized match only. Deliberately NO last-name fallback:
    // brothers/relatives (Kevin vs Caleb Love, Isaiah vs Evan Mobley) share
    // last names and would be merged as false positives.
    let match = null;
    for (const k of nameKeys(orphan.name)) {
      const hit = byKey.get(k);
      if (hit) { match = hit; break; }
    }
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

/**
 * Claim espn_ids for legacy (espn_id null) players that still appear on a
 * roster: link them to their ESPN fantasy-pool entry by unique
 * first-initial + last-name match. Links instead of merging — the row keeps
 * its name and stats history, it just becomes ESPN-visible/draft-eligible.
 * Players with no unique ESPN match (e.g. out of the league) are left as history.
 *
 * Usage: node scripts/fix-players.mjs --claim [--dry-run]
 * Env: SUPABASE_ACCESS_TOKEN, ESPN_S2, ESPN_SWID
 */
export async function claimEspnIds({ season = 2027, dryRun = false, log = console.log } = {}) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('Missing SUPABASE_ACCESS_TOKEN');
  const espnS2 = process.env.ESPN_S2;
  const espnSwid = process.env.ESPN_SWID;
  if (!espnS2 || !espnSwid) throw new Error('Missing ESPN_S2 / ESPN_SWID env vars.');
  const q = async (query) => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r.json();
  };

  const rostered = await q(
    `select distinct p.id, p.name from public.rosters r join public.players p on p.id = r.player_id
     where p.espn_id is null order by p.name`,
  );
  if (!rostered.length) {
    log('No legacy players on rosters; nothing to claim.');
    return { claimed: 0 };
  }

  // page the full ESPN fantasy pool (same approach as import-projections)
  const PAGE = 50;
  const pool = [];
  for (let offset = 0; ; offset += PAGE) {
    const filter = JSON.stringify({
      players: { limit: PAGE, offset, sortStatId: { sortPriority: 1, sortAsc: true, value: 0 } },
    });
    const res = await fetch(
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${season}/segments/0/leagues/201?view=kona_player_info`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0', 'X-Fantasy-Filter': filter, Cookie: `espn_s2=${espnS2}; SWID=${espnSwid};` },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!res.ok) throw new Error(`ESPN API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    const players = page.players ?? [];
    pool.push(...players.map((w) => ({ id: String(w.player.id), name: w.player.fullName })));
    if (players.length < PAGE) break;
  }
  log(`ESPN pool: ${pool.length} players; legacy rostered: ${rostered.length}`);

  const suffixes = new Set(['jr', 'ii', 'iii', 'iv', 'sr']);
  const nameTokens = (n) =>
    String(n).trim().replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter((t) => !suffixes.has(t.toLowerCase()));
  const lastName = (n) => {
    const parts = nameTokens(n);
    return parts.length >= 2 ? parts.at(-1).toLowerCase() : null;
  };
  const firstToken = (n) => nameTokens(n)[0]?.toLowerCase() ?? null;

  let claimed = 0;
  for (const p of rostered) {
    const ln = lastName(p.name);
    const ft = firstToken(p.name);
    if (!ln || !ft) continue;
    // First-name agreement: alias-equivalent full tokens (Ronald/Ron), or one
    // side is an initials-style token (GG) matching the other's initial.
    // Initial-only matches between two full first names (Jimmy/Jared Butler)
    // are rejected — too risky.
    const firstAgrees = (a, b) => {
      if (!a || !b) return false;
      const ka = nameKeys(a);
      for (const k of nameKeys(b)) if (ka.has(k)) return true;
      if (a.length <= 2) return b.startsWith(a);
      if (b.length <= 2) return a.startsWith(b);
      return false;
    };
    const hits = pool.filter((c) => lastName(c.name) === ln && firstAgrees(ft, firstToken(c.name)));
    if (hits.length === 1) {
      const esc = (s) => String(s).replace(/'/g, "''");
      log(`  claim: "${p.name}" -> espn:${hits[0].id} ("${hits[0].name}")`);
      if (!dryRun) {
        try {
          await q(`update public.players set espn_id = '${esc(hits[0].id)}' where id = '${p.id}' and espn_id is null`);
        } catch (err) {
          if (!String(err.message).includes('players_espn_id_key')) throw err;
          // espn_id already claimed by another row: these are twins under
          // different names (GG Jackson II vs GG Jackson). Re-point this
          // row's references onto the holder and delete it, like fixPlayers.
          const holders = await q(`select id, name from public.players where espn_id = '${esc(hits[0].id)}'`);
          const holder = holders[0];
          log(`    espn:${hits[0].id} already held by "${holder.name}" — merging twin rows`);
          await q(`
            do $$
            begin
              insert into public.player_seasons (player_id, season_id, stats)
              select '${holder.id}', s.season_id, s.stats
              from public.player_seasons s where s.player_id = '${p.id}'
              on conflict (player_id, season_id) do nothing;
              delete from public.player_seasons where player_id = '${p.id}';

              delete from public.rosters r
              using public.rosters r2
              where r.player_id = '${p.id}' and r2.player_id = '${holder.id}' and r2.season_id = r.season_id;
              update public.rosters set player_id = '${holder.id}' where player_id = '${p.id}';
              update public.user_favourites set player_id = '${holder.id}' where player_id = '${p.id}';
              update public.draft_picks set player_id = '${holder.id}' where player_id = '${p.id}';
              delete from public.players where id = '${p.id}';
            end $$;
          `);
        }
      }
      claimed++;
    } else {
      log(`  skip: "${p.name}" — ${hits.length} ESPN candidates by "${ft}. ${ln}", leaving as history`);
    }
  }
  log(`Claimed ${claimed} espn_id(s).`);
  return { claimed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const result = args.includes('--claim')
      ? await claimEspnIds({ dryRun })
      : await fixPlayers({ dryRun });
    console.log('Done:', result);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
