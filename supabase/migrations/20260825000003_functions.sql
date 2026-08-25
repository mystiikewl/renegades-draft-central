-- =====================================================================
-- Server-authoritative draft logic — 2026 rebuild
-- All mutations flow through these SECURITY DEFINER functions.
-- No client code ever writes draft_picks or rosters directly.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Season management (admin)
-- ---------------------------------------------------------------------

-- Create a new season; deactivates the previous active one.
create function public.create_season(p_label text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public.seasons set is_active = false where is_active;

  insert into public.seasons (label, is_active) values (p_label, true)
    returning id into v_season_id;

  insert into public.draft_settings (season_id) values (v_season_id);
  return v_season_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Team claiming (self-service onboarding)
-- ---------------------------------------------------------------------

create function public.claim_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select owner_profile_id into v_owner from public.teams where id = p_team_id for update;
  if v_owner is not null then
    raise exception 'Team already claimed';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and team_id is not null) then
    raise exception 'You already have a team';
  end if;

  update public.teams set owner_profile_id = auth.uid() where id = p_team_id;
  update public.profiles set team_id = p_team_id where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- Draft board generation (admin)
-- ---------------------------------------------------------------------

-- Set draft order (array of team ids in slot order) and (re)generate the
-- pick slots. Only allowed while no picks have been used.
create function public.set_draft_order(p_season_id uuid, p_order uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings record;
  v_round int;
  v_slot int;
  v_pick int := 0;
  v_team uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_settings from public.draft_settings where season_id = p_season_id;
  if v_settings.id is null then
    raise exception 'Season has no draft settings';
  end if;
  if exists (select 1 from public.draft_picks where season_id = p_season_id and is_used) then
    raise exception 'Cannot change order after the draft has started';
  end if;

  if array_length(p_order, 1) is null or array_length(p_order, 1) <> v_settings.league_size then
    raise exception 'Order must contain exactly % team ids', v_settings.league_size;
  end if;

  update public.draft_settings
    set draft_order = p_order, updated_at = now()
    where season_id = p_season_id;

  delete from public.draft_picks where season_id = p_season_id;

  for v_round in 1..v_settings.roster_size loop
    for v_slot in 1..v_settings.league_size loop
      v_pick := v_pick + 1;
      -- snake: even rounds reverse the order
      if v_settings.draft_type = 'snake' and v_round % 2 = 0 then
        v_team := p_order[v_settings.league_size - v_slot + 1];
      else
        v_team := p_order[v_slot];
      end if;
      insert into public.draft_picks (season_id, round, pick_number, team_id, original_team_id)
      values (p_season_id, v_round, v_pick, v_team, v_team);
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Draft status transitions (admin)
-- ---------------------------------------------------------------------

create function public.set_draft_status(p_season_id uuid, p_status draft_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_status = 'running' and not exists (
    select 1 from public.draft_picks where season_id = p_season_id limit 1
  ) then
    raise exception 'Generate the draft order before starting';
  end if;
  update public.draft_settings
    set status = p_status, updated_at = now()
    where season_id = p_season_id;
end;
$$;

-- ---------------------------------------------------------------------
-- THE pick function. Validates turn, slot and availability, then writes
-- draft_picks + rosters atomically.
-- ---------------------------------------------------------------------

create function public.make_pick(p_season_id uuid, p_player_id uuid)
returns public.draft_picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings record;
  v_next_pick public.draft_picks;
  v_my_team uuid;
  v_season_status season_status;
begin
  -- Lock settings for the duration so two simultaneous picks can't race
  select * into v_settings from public.draft_settings
    where season_id = p_season_id for update;

  if v_settings.id is null then
    raise exception 'Season not found';
  end if;
  if v_settings.status <> 'running' then
    raise exception 'Draft is not running';
  end if;

  select status into v_season_status from public.seasons where id = p_season_id;
  if v_season_status <> 'live' then
    raise exception 'Season is not live';
  end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_my_team is null and not public.is_admin() then
    raise exception 'You are not assigned to a team';
  end if;

  select * into v_next_pick from public.draft_picks
    where season_id = p_season_id and not is_used
    order by pick_number
    limit 1
    for update;

  if v_next_pick.id is null then
    raise exception 'No picks remaining';
  end if;

  -- Turn check (the thing 2025 never enforced): caller must own the
  -- picking team, or be admin.
  if v_next_pick.team_id <> v_my_team and not public.is_admin() then
    raise exception 'Not your pick — it is pick %', v_next_pick.pick_number;
  end if;

  if not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Player not found';
  end if;

  if exists (
    select 1 from public.rosters
    where season_id = p_season_id and player_id = p_player_id
  ) then
    raise exception 'Player already on a roster this season';
  end if;

  update public.draft_picks
    set player_id = p_player_id, is_used = true, picked_at = now()
    where id = v_next_pick.id;

  insert into public.rosters (season_id, team_id, player_id, acquisition, draft_pick_id)
  values (p_season_id, v_next_pick.team_id, p_player_id, 'draft', v_next_pick.id);

  -- Auto-complete when the board is full
  if not exists (
    select 1 from public.draft_picks where season_id = p_season_id and not is_used
  ) then
    update public.draft_settings set status = 'complete', updated_at = now()
      where season_id = p_season_id;
    update public.seasons set status = 'complete' where id = p_season_id;
  end if;

  return v_next_pick;
end;
$$;

-- ---------------------------------------------------------------------
-- Undo. Admin always; the team that made the pick while the draft is
-- still running.
-- ---------------------------------------------------------------------

create function public.undo_last_pick(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last public.draft_picks;
  v_my_team uuid;
  v_was_complete boolean;
begin
  select * into v_last from public.draft_picks
    where season_id = p_season_id and is_used
    order by pick_number desc
    limit 1
    for update;

  if v_last.id is null then
    raise exception 'No picks to undo';
  end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_last.team_id <> v_my_team and not public.is_admin() then
    raise exception 'Only the picking team or an admin can undo';
  end if;

  select (status = 'complete') into v_was_complete from public.draft_settings
    where season_id = p_season_id;

  delete from public.rosters where draft_pick_id = v_last.id;
  update public.draft_picks
    set player_id = null, is_used = false, picked_at = null
    where id = v_last.id;

  if v_was_complete then
    update public.draft_settings set status = 'running', updated_at = now()
      where season_id = p_season_id;
    update public.seasons set status = 'live' where id = p_season_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Pick trading: current holder of a pick (or admin) can trade it.
-- original_team_id is preserved for board display.
-- ---------------------------------------------------------------------

create function public.trade_pick(p_pick_id uuid, p_to_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pick public.draft_picks;
  v_my_team uuid;
begin
  select * into v_pick from public.draft_picks where id = p_pick_id for update;
  if v_pick.id is null then
    raise exception 'Pick not found';
  end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_pick.team_id <> v_my_team and not public.is_admin() then
    raise exception 'Only the current holder or an admin can trade this pick';
  end if;

  update public.draft_picks set team_id = p_to_team_id where id = p_pick_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Keepers: admin or team owner; enforced against keeper_limit.
-- ---------------------------------------------------------------------

create function public.assign_keeper(p_season_id uuid, p_team_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings record;
  v_my_team uuid;
  v_count int;
begin
  select * into v_settings from public.draft_settings where season_id = p_season_id;
  if v_settings.id is null then
    raise exception 'Season not found';
  end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if p_team_id <> v_my_team and not public.is_admin() then
    raise exception 'You can only set keepers for your own team';
  end if;

  if exists (
    select 1 from public.rosters
    where season_id = p_season_id and player_id = p_player_id
  ) then
    raise exception 'Player already on a roster this season';
  end if;

  select count(*) into v_count from public.rosters
    where season_id = p_season_id and team_id = p_team_id and acquisition = 'keeper';
  if v_count >= v_settings.keeper_limit then
    raise exception 'Keeper limit (%) reached', v_settings.keeper_limit;
  end if;

  insert into public.rosters (season_id, team_id, player_id, acquisition)
  values (p_season_id, p_team_id, p_player_id, 'keeper');
end;
$$;

create function public.remove_keeper(p_season_id uuid, p_team_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_my_team uuid;
begin
  select team_id into v_my_team from public.profiles where id = auth.uid();
  if p_team_id <> v_my_team and not public.is_admin() then
    raise exception 'You can only manage keepers for your own team';
  end if;

  delete from public.rosters
  where season_id = p_season_id
    and team_id = p_team_id
    and player_id = p_player_id
    and acquisition = 'keeper';
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: full draft reset for a season (picks + rosters, keepers stay)
-- ---------------------------------------------------------------------

create function public.reset_draft(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  delete from public.rosters
  where season_id = p_season_id and acquisition = 'draft';

  update public.draft_picks
    set player_id = null, is_used = false, picked_at = null, team_id = original_team_id
    where season_id = p_season_id;

  update public.draft_settings
    set status = 'pre_draft', updated_at = now()
    where season_id = p_season_id;
end;
$$;

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger draft_settings_touch before update on public.draft_settings
  for each row execute function public.touch_updated_at();
create trigger player_seasons_touch before update on public.player_seasons
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Grants: RPCs are executable by authenticated users; authorization
-- happens inside each function.
-- ---------------------------------------------------------------------
grant execute on function public.create_season(text) to authenticated;
grant execute on function public.claim_team(uuid) to authenticated;
grant execute on function public.set_draft_order(uuid, uuid[]) to authenticated;
grant execute on function public.set_draft_status(uuid, draft_status) to authenticated;
grant execute on function public.make_pick(uuid, uuid) to authenticated;
grant execute on function public.undo_last_pick(uuid) to authenticated;
grant execute on function public.trade_pick(uuid, uuid) to authenticated;
grant execute on function public.assign_keeper(uuid, uuid, uuid) to authenticated;
grant execute on function public.remove_keeper(uuid, uuid, uuid) to authenticated;
grant execute on function public.reset_draft(uuid) to authenticated;
