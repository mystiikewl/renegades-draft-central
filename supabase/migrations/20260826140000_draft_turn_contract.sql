-- Draft-day journey hardening.
--
-- Every member action is bound to the exact draft slot the client displayed.
-- This prevents double taps, stale dialogs, two-device races and offline replay
-- from accidentally applying to a later pick (especially at snake turnarounds).
--
-- The draft clock is server-authored state. Expiry is informational: the
-- commissioner/member must still pick or skip explicitly.

alter table public.draft_settings
  add column if not exists turn_deadline_at timestamptz,
  add column if not exists paused_remaining_seconds int;

update public.draft_settings
set turn_deadline_at = now() + make_interval(secs => pick_time_limit_seconds)
where status = 'running' and turn_deadline_at is null;

update public.draft_settings
set paused_remaining_seconds = pick_time_limit_seconds
where status = 'paused' and paused_remaining_seconds is null;

create or replace function public.set_draft_status(p_season_id uuid, p_status public.draft_status)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings public.draft_settings;
  v_remaining int;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select * into v_settings
  from public.draft_settings
  where season_id = p_season_id
  for update;

  if v_settings.id is null then raise exception 'Draft settings not found'; end if;
  if v_settings.status = 'complete' and p_status <> 'complete' then
    raise exception 'Draft is complete; undo the last action or reset the draft to reopen it';
  end if;

  if p_status = 'running' then
    if not exists (select 1 from public.draft_picks where season_id = p_season_id limit 1) then
      raise exception 'Generate the draft order before starting';
    end if;

    if v_settings.status = 'paused' then
      v_remaining := greatest(coalesce(v_settings.paused_remaining_seconds, v_settings.pick_time_limit_seconds), 0);
      update public.draft_settings
      set status = 'running',
          turn_deadline_at = now() + make_interval(secs => v_remaining),
          paused_remaining_seconds = null,
          updated_at = now()
      where season_id = p_season_id;
    elsif v_settings.status <> 'running' then
      update public.draft_settings
      set status = 'running',
          turn_deadline_at = now() + make_interval(secs => v_settings.pick_time_limit_seconds),
          paused_remaining_seconds = null,
          updated_at = now()
      where season_id = p_season_id;
    end if;

    update public.seasons set status = 'live'
    where id = p_season_id and status <> 'complete';

  elsif p_status = 'paused' then
    if v_settings.status = 'running' then
      v_remaining := greatest(
        0,
        ceil(extract(epoch from (coalesce(v_settings.turn_deadline_at, now() + make_interval(secs => v_settings.pick_time_limit_seconds)) - now())))::int
      );
      update public.draft_settings
      set status = 'paused',
          turn_deadline_at = null,
          paused_remaining_seconds = v_remaining,
          updated_at = now()
      where season_id = p_season_id;
    elsif v_settings.status <> 'paused' then
      update public.draft_settings
      set status = 'paused',
          turn_deadline_at = null,
          paused_remaining_seconds = v_settings.pick_time_limit_seconds,
          updated_at = now()
      where season_id = p_season_id;
    end if;

  elsif p_status = 'pre_draft' then
    update public.draft_settings
    set status = 'pre_draft',
        turn_deadline_at = null,
        paused_remaining_seconds = null,
        updated_at = now()
    where season_id = p_season_id;
    update public.seasons set status = 'pre_draft'
    where id = p_season_id and status <> 'archived';

  elsif p_status = 'complete' then
    update public.draft_settings
    set status = 'complete',
        turn_deadline_at = null,
        paused_remaining_seconds = null,
        updated_at = now()
    where season_id = p_season_id;
    update public.seasons set status = 'complete' where id = p_season_id;
    update public.trades set status = 'cancelled', resolved_at = now()
    where season_id = p_season_id and status = 'proposed';
  end if;
end;
$$;

create or replace function public.make_pick_for_slot(
  p_season_id uuid,
  p_pick_id uuid,
  p_player_id uuid
)
returns public.draft_picks
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings public.draft_settings;
  v_next_pick public.draft_picks;
  v_my_team uuid;
  v_season_status public.season_status;
  v_roster_count int;
begin
  select * into v_settings from public.draft_settings where season_id = p_season_id for update;
  if v_settings.id is null then raise exception 'Season not found'; end if;
  if v_settings.status <> 'running' then raise exception 'Draft is not running'; end if;

  select status into v_season_status from public.seasons where id = p_season_id;
  if v_season_status <> 'live' then raise exception 'Season is not live'; end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_my_team is null and not public.is_admin() then raise exception 'You are not assigned to a team'; end if;

  select * into v_next_pick
  from public.draft_picks
  where season_id = p_season_id and not is_used
  order by pick_number
  limit 1
  for update;

  if v_next_pick.id is null then raise exception 'No picks remaining'; end if;
  if v_next_pick.id is distinct from p_pick_id then
    raise exception 'Draft moved to another pick. Refresh before submitting.';
  end if;
  if v_next_pick.team_id <> v_my_team and not public.is_admin() then
    raise exception 'Not your pick — it is pick %', v_next_pick.pick_number;
  end if;

  select count(*) into v_roster_count
  from public.rosters
  where season_id = p_season_id and team_id = v_next_pick.team_id;
  if v_roster_count >= v_settings.roster_size then
    raise exception 'Roster is full — trade/drop a player or skip this pick';
  end if;
  if not exists (select 1 from public.players where id = p_player_id) then raise exception 'Player not found'; end if;
  if exists (select 1 from public.rosters where season_id = p_season_id and player_id = p_player_id) then
    raise exception 'Player already on a roster this season';
  end if;

  update public.draft_picks
  set player_id = p_player_id,
      is_used = true,
      is_skipped = false,
      picked_at = now(),
      skipped_at = null
  where id = v_next_pick.id
  returning * into v_next_pick;

  insert into public.rosters (season_id, team_id, player_id, acquisition, draft_pick_id)
  values (p_season_id, v_next_pick.team_id, p_player_id, 'draft', v_next_pick.id);

  if not exists (select 1 from public.draft_picks where season_id = p_season_id and not is_used) then
    update public.draft_settings
    set status = 'complete', turn_deadline_at = null, paused_remaining_seconds = null, updated_at = now()
    where season_id = p_season_id;
    update public.seasons set status = 'complete' where id = p_season_id;
    update public.trades set status = 'cancelled', resolved_at = now()
    where season_id = p_season_id and status = 'proposed';
  else
    update public.draft_settings
    set turn_deadline_at = now() + make_interval(secs => v_settings.pick_time_limit_seconds),
        paused_remaining_seconds = null,
        updated_at = now()
    where season_id = p_season_id;
  end if;

  return v_next_pick;
end;
$$;

create or replace function public.skip_pick_for_slot(p_season_id uuid, p_pick_id uuid)
returns public.draft_picks
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings public.draft_settings;
  v_next_pick public.draft_picks;
  v_my_team uuid;
  v_season_status public.season_status;
begin
  select * into v_settings from public.draft_settings where season_id = p_season_id for update;
  if v_settings.id is null then raise exception 'Season not found'; end if;
  if v_settings.status <> 'running' then raise exception 'Draft is not running'; end if;

  select status into v_season_status from public.seasons where id = p_season_id;
  if v_season_status <> 'live' then raise exception 'Season is not live'; end if;
  select team_id into v_my_team from public.profiles where id = auth.uid();

  select * into v_next_pick
  from public.draft_picks
  where season_id = p_season_id and not is_used
  order by pick_number
  limit 1
  for update;

  if v_next_pick.id is null then raise exception 'No picks remaining'; end if;
  if v_next_pick.id is distinct from p_pick_id then
    raise exception 'Draft moved to another pick. Refresh before skipping.';
  end if;
  if v_next_pick.team_id <> v_my_team and not public.is_admin() then
    raise exception 'Not your pick — it is pick %', v_next_pick.pick_number;
  end if;

  update public.draft_picks
  set is_used = true,
      is_skipped = true,
      player_id = null,
      picked_at = now(),
      skipped_at = now()
  where id = v_next_pick.id
  returning * into v_next_pick;

  if not exists (select 1 from public.draft_picks where season_id = p_season_id and not is_used) then
    update public.draft_settings
    set status = 'complete', turn_deadline_at = null, paused_remaining_seconds = null, updated_at = now()
    where season_id = p_season_id;
    update public.seasons set status = 'complete' where id = p_season_id;
    update public.trades set status = 'cancelled', resolved_at = now()
    where season_id = p_season_id and status = 'proposed';
  else
    update public.draft_settings
    set turn_deadline_at = now() + make_interval(secs => v_settings.pick_time_limit_seconds),
        paused_remaining_seconds = null,
        updated_at = now()
    where season_id = p_season_id;
  end if;

  return v_next_pick;
end;
$$;

create or replace function public.undo_draft_action_for_slot(p_season_id uuid, p_pick_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings public.draft_settings;
  v_last public.draft_picks;
  v_my_team uuid;
  v_roster_id uuid;
begin
  select * into v_settings from public.draft_settings where season_id = p_season_id for update;
  if v_settings.id is null then raise exception 'Draft settings not found'; end if;

  select * into v_last
  from public.draft_picks
  where season_id = p_season_id and is_used
  order by pick_number desc
  limit 1
  for update;

  if v_last.id is null then raise exception 'No picks to undo'; end if;
  if v_last.id is distinct from p_pick_id then
    raise exception 'Draft moved. Refresh before undoing the latest action.';
  end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_last.team_id <> v_my_team and not public.is_admin() then
    raise exception 'Only the picking team or an admin can undo';
  end if;

  select id into v_roster_id from public.rosters where draft_pick_id = v_last.id for update;
  if v_roster_id is not null and exists (
    select 1
    from public.trade_assets a
    join public.trades t on t.id = a.trade_id
    where a.roster_id = v_roster_id and t.status = 'accepted'
  ) then
    raise exception 'This drafted player has been traded — reverse/correct that trade before undoing the pick';
  end if;

  delete from public.rosters where draft_pick_id = v_last.id;
  update public.draft_picks
  set player_id = null,
      is_used = false,
      picked_at = null,
      is_skipped = false,
      skipped_at = null
  where id = v_last.id;

  if v_settings.status = 'complete' then
    update public.draft_settings
    set status = 'running',
        turn_deadline_at = now() + make_interval(secs => v_settings.pick_time_limit_seconds),
        paused_remaining_seconds = null,
        updated_at = now()
    where season_id = p_season_id;
    update public.seasons set status = 'live' where id = p_season_id;
  elsif v_settings.status = 'running' then
    update public.draft_settings
    set turn_deadline_at = now() + make_interval(secs => v_settings.pick_time_limit_seconds),
        paused_remaining_seconds = null,
        updated_at = now()
    where season_id = p_season_id;
  elsif v_settings.status = 'paused' then
    update public.draft_settings
    set turn_deadline_at = null,
        paused_remaining_seconds = v_settings.pick_time_limit_seconds,
        updated_at = now()
    where season_id = p_season_id;
  end if;
end;
$$;

create or replace function public.reset_draft(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings public.draft_settings;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  select * into v_settings from public.draft_settings where season_id = p_season_id for update;
  if v_settings.id is null then raise exception 'Draft settings not found'; end if;
  if exists (
    select 1
    from public.trades t
    join public.trade_assets a on a.trade_id = t.id and a.asset_type = 'player'
    join public.rosters r on r.id = a.roster_id
    where t.season_id = p_season_id and t.status = 'accepted' and r.draft_pick_id is not null
  ) then
    raise exception 'Reset blocked: a drafted player is part of an accepted trade. Reverse/correct that trade first.';
  end if;
  update public.trades set status = 'cancelled', resolved_by = auth.uid(), resolved_at = now()
  where season_id = p_season_id and status = 'proposed';
  delete from public.rosters where season_id = p_season_id and draft_pick_id is not null;
  update public.draft_picks
  set player_id = null, is_used = false, picked_at = null, is_skipped = false, skipped_at = null
  where season_id = p_season_id;
  update public.draft_settings
  set status = 'pre_draft', turn_deadline_at = null, paused_remaining_seconds = null, updated_at = now()
  where season_id = p_season_id;
  update public.seasons set status = 'pre_draft' where id = p_season_id;
end;
$$;

revoke execute on function public.make_pick(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.skip_pick(uuid) from public, anon, authenticated;
revoke execute on function public.undo_last_pick(uuid) from public, anon, authenticated;

revoke execute on function public.make_pick_for_slot(uuid, uuid, uuid) from public, anon;
revoke execute on function public.skip_pick_for_slot(uuid, uuid) from public, anon;
revoke execute on function public.undo_draft_action_for_slot(uuid, uuid) from public, anon;

grant execute on function public.make_pick_for_slot(uuid, uuid, uuid) to authenticated;
grant execute on function public.skip_pick_for_slot(uuid, uuid) to authenticated;
grant execute on function public.undo_draft_action_for_slot(uuid, uuid) to authenticated;
