-- Keeper finalize hardening + full revert.
--
-- finalize_keepers() dropped every non-keeper roster row globally with no way
-- back. If any team's intended keepers weren't tagged yet (or the Node sync
-- script had overwritten their tags), those players were silently lost.
--
--   1. finalize now snapshots dropped rows into rosters_dropped, refuses to
--      run twice, and refuses while any team in the draft order has zero
--      tagged keepers (names the offending teams).
--   2. revert_finalize_keepers() restores the snapshot, clears the generated
--      pick grid (re-finalize regenerates it deterministically) and reopens
--      keeper editing. Refuses once any pick has been made.

create table if not exists public.rosters_dropped (
  season_id uuid not null references public.seasons (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  acquisition public.acquisition_type not null,
  draft_pick_id uuid,
  dropped_at timestamptz not null default now(),
  unique (season_id, player_id)
);

alter table public.rosters_dropped enable row level security;

-- Admin-only via RPC; no direct client access.
create policy "rosters_dropped_admin" on public.rosters_dropped
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.finalize_keepers(p_season_id uuid)
returns int
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings record;
  v_rounds int;
  v_dropped int;
  v_unkept_teams text;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_settings from public.draft_settings where season_id = p_season_id;
  if v_settings.id is null then
    raise exception 'Season not found';
  end if;
  if v_settings.status <> 'pre_draft' then
    raise exception 'Already finalized';
  end if;
  if v_settings.keepers_finalized_at is not null then
    raise exception 'Keepers already finalized - revert the finalize to run again';
  end if;
  if array_length(v_settings.draft_order, 1) is null then
    raise exception 'Set draft order first';
  end if;

  -- Safety gate: a team with no tagged keepers means its whole roster would be
  -- dropped. Almost always a tagging mistake, not intent.
  select string_agg(t.name, ', ' order by t.name) into v_unkept_teams
  from public.teams t
  where t.id = any (v_settings.draft_order)
    and not exists (
      select 1 from public.rosters r
      where r.season_id = p_season_id
        and r.team_id = t.id
        and r.acquisition = 'keeper'
    );
  if v_unkept_teams is not null then
    raise exception 'Cannot finalize: no keepers tagged for: % - tag keepers (or revert the finalize) first', v_unkept_teams;
  end if;

  -- Snapshot before dropping so revert_finalize_keepers can restore exactly.
  insert into public.rosters_dropped (season_id, team_id, player_id, acquisition, draft_pick_id)
  select r.season_id, r.team_id, r.player_id, r.acquisition, r.draft_pick_id
  from public.rosters r
  where r.season_id = p_season_id and r.acquisition <> 'keeper'
  on conflict (season_id, player_id) do update
    set team_id = excluded.team_id,
        acquisition = excluded.acquisition,
        draft_pick_id = excluded.draft_pick_id,
        dropped_at = now();

  delete from public.rosters
  where season_id = p_season_id and acquisition <> 'keeper';
  get diagnostics v_dropped = row_count;

  v_rounds := v_settings.roster_size - coalesce(v_settings.keeper_limit, 0);

  insert into public.draft_picks (season_id, round, pick_number, original_team_id, team_id)
  select p_season_id,
         r,
         (r - 1) * v_settings.league_size + slot,
         t.team_id,
         case when r % 2 = 1
              then t.team_id
              else (v_settings.draft_order)[v_settings.league_size + 1 - slot]
         end
  from generate_series(1, v_rounds) r
  cross join generate_series(1, v_settings.league_size) slot
  cross join lateral (
    select (v_settings.draft_order)[slot] as team_id
  ) t
  on conflict (season_id, pick_number) do nothing;

  update public.draft_settings
  set keepers_finalized_at = now(), updated_at = now()
  where season_id = p_season_id;

  return v_dropped;
end;
$$;

-- Full undo of finalize_keepers: restore dropped roster rows with their
-- original acquisition tags, clear the generated pick grid and reopen keeper
-- editing. Refuses once any pick has been made. Idempotent.
create or replace function public.revert_finalize_keepers(p_season_id uuid)
returns int
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings record;
  v_restored int;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_settings from public.draft_settings where season_id = p_season_id;
  if v_settings.id is null then
    raise exception 'Season not found';
  end if;
  if v_settings.keepers_finalized_at is null then
    raise exception 'Keepers are not finalized';
  end if;
  if v_settings.status <> 'pre_draft' then
    raise exception 'Cannot revert once the draft has started - reset the draft first';
  end if;
  if exists (
    select 1 from public.draft_picks
    where season_id = p_season_id and player_id is not null
  ) then
    raise exception 'Cannot revert once picks have been made - reset the draft first';
  end if;

  -- Never clobber current rows (keeper tags made since finalize win).
  insert into public.rosters (season_id, team_id, player_id, acquisition, draft_pick_id)
  select d.season_id, d.team_id, d.player_id, d.acquisition, d.draft_pick_id
  from public.rosters_dropped d
  where d.season_id = p_season_id
  on conflict (season_id, player_id) do nothing;
  get diagnostics v_restored = row_count;

  delete from public.rosters_dropped where season_id = p_season_id;

  -- The pick grid is regenerated deterministically by the next finalize;
  -- clear it so the board can't run on a stale grid.
  delete from public.draft_picks
  where season_id = p_season_id and player_id is null;

  update public.draft_settings
  set keepers_finalized_at = null, updated_at = now()
  where season_id = p_season_id;

  return v_restored;
end;
$$;

revoke execute on function public.finalize_keepers(uuid) from public, anon;
grant execute on function public.finalize_keepers(uuid) to authenticated;
revoke execute on function public.revert_finalize_keepers(uuid) from public, anon;
grant execute on function public.revert_finalize_keepers(uuid) to authenticated;

-- unfinalize_keepers() without the restore is a footgun now that a full
-- revert exists; keep the name for compatibility but route it through the
-- revert so dropped rosters always come back.
create or replace function public.unfinalize_keepers(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
begin
  perform public.revert_finalize_keepers(p_season_id);
end;
$$;
