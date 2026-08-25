#!/usr/bin/env node

/**
 * One-time player dedupe: link 2025-archive players (espn_id null) to their
 * fresh ESPN-imported twins by normalized name, re-point children to the
 * ESPN row, then delete the orphan. One SQL call — runs in seconds.
 *
 * Run once. Re-running is a no-op (nothing left unmatched).
 */

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error('Missing SUPABASE_ACCESS_TOKEN'); process.exit(1); }
const REF = process.env.SUPABASE_PROJECT_REF ?? 'xruqdjonzxkzwsslzpdl';
const q = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
};

// Single DO block: temp tables live for the whole session inside it.
const result = await q(`
do $$
declare n bigint;
begin
  create temp table _groups as
    select lower(regexp_replace(unaccent(name), '[^a-zA-Z0-9]', '', 'g')) as norm,
           max(espn_id) as espn_id
    from players group by 1 having count(*) > 1 and max(espn_id) is not null;

  create temp table _orphans as
    select p.id, k.keep_id
    from players p
    join (select g.norm, p2.id as keep_id from _groups g join players p2 on p2.espn_id = g.espn_id) k
      on k.norm = lower(regexp_replace(unaccent(p.name), '[^a-zA-Z0-9]', '', 'g'))
    where p.espn_id is null and p.id <> k.keep_id;

  -- stats: copy orphan stat rows onto the keeper, skipping seasons he already
  -- has, then drop all orphan rows
  insert into player_seasons (player_id, season_id, stats)
  select o.keep_id, s.season_id, s.stats
  from player_seasons s join _orphans o on o.id = s.player_id
  on conflict (player_id, season_id) do nothing;
  get diagnostics n = row_count; raise notice 'stats merged: %', n;
  delete from player_seasons where player_id in (select id from _orphans);

  update rosters set player_id = o.keep_id from _orphans o where rosters.player_id = o.id;
  get diagnostics n = row_count; raise notice 'rosters merged: %', n;

  update user_favourites set player_id = o.keep_id from _orphans o where user_favourites.player_id = o.id;
  get diagnostics n = row_count; raise notice 'favourites merged: %', n;

  update draft_picks set player_id = o.keep_id from _orphans o where draft_picks.player_id = o.id;
  get diagnostics n = row_count; raise notice 'picks merged: %', n;

  delete from players p using _orphans o where p.id = o.id;
  get diagnostics n = row_count; raise notice 'orphans deleted: %', n;
end $$;
`);
console.log(result);

console.log('remaining:', await q(
  `select count(*) total, count(*) filter (where espn_id is null) no_espn from players`));
