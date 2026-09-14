-- finalize_keepers honors draft_settings.draft_type (backlog P2 #7).
--
-- The RPC hardcoded a snake grid; 2026-27 is configured 'linear' and its grid
-- was built linearly. A revert + re-finalize from the app would have silently
-- flipped the board to snake on draft night. The grid now matches
-- set_draft_order's semantics: snake reverses even rounds, linear never
-- reverses. Also appends admin_log rows for the finalize/revert cycle
-- (backlog P2 #5).

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
         case
           when v_settings.draft_type = 'linear' or r % 2 = 1
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

  perform public.append_admin_log('finalize_keepers', jsonb_build_object(
    'season_id', p_season_id,
    'dropped', v_dropped,
    'rounds', v_rounds,
    'draft_type', v_settings.draft_type));

  return v_dropped;
end;
$$;

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

  perform public.append_admin_log('revert_finalize_keepers', jsonb_build_object(
    'season_id', p_season_id, 'restored', v_restored));

  return v_restored;
end;
$$;
