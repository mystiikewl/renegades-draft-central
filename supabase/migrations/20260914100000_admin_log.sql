-- Admin action audit log (backlog P2 #5).
--
-- reset_draft, undo and the keeper finalize cycle are destructive one-click
-- ops among 10 users. The commissioner/destructive RPCs — create_season,
-- set_draft_order, set_draft_status, reset_draft, undo_draft_action_for_slot,
-- finalize_keepers, revert_finalize_keepers — append an admin_log row on
-- success, giving post-hoc "who did what, when". Routine league traffic
-- (picks, keeper tagging, trade acceptance) is deliberately NOT logged: it is
-- already visible on the board.
--
--   action  — stable RPC/script name ('reset_draft', 'finalize_keepers', …)
--   actor   — auth.uid() at call time (the admin or acting owner)
--   payload — jsonb context (season_id, counts, order, …)
--
-- Writes happen only inside SECURITY DEFINER functions (owner role); RLS
-- exposes SELECT to admins and nothing else.

create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  payload jsonb not null default '{}'::jsonb
);

alter table public.admin_log enable row level security;

drop policy if exists "admin_log_admin_read" on public.admin_log;
create policy "admin_log_admin_read" on public.admin_log
  for select using (public.is_admin());

revoke all on public.admin_log from public, anon, authenticated;
grant select on public.admin_log to authenticated;

-- Append helper. Not granted to any client role: only SECURITY DEFINER
-- bodies (running as the owner) can call it, so the log is append-only in
-- practice and cannot be spoofed or silenced from the client.
create or replace function public.append_admin_log(p_action text, p_payload jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
begin
  insert into public.admin_log (action, actor, payload)
  values (p_action, auth.uid(), coalesce(p_payload, '{}'::jsonb));
end;
$$;

revoke all on function public.append_admin_log(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Wire logging into the destructive RPCs (latest definitions, unchanged
-- behaviour apart from the appended row).
-- ---------------------------------------------------------------------

create or replace function public.set_draft_order(p_season_id uuid, p_order uuid[])
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings public.draft_settings;
  v_round int;
  v_slot int;
  v_pick int := 0;
  v_team uuid;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  select * into v_settings from public.draft_settings where season_id = p_season_id for update;
  if v_settings.id is null then raise exception 'Season has no draft settings'; end if;
  if exists (select 1 from public.draft_picks where season_id = p_season_id and is_used) then raise exception 'Cannot change order after the draft has started'; end if;
  if exists (select 1 from public.draft_picks where season_id = p_season_id and team_id <> original_team_id) then raise exception 'Cannot regenerate draft order while traded picks have changed ownership'; end if;
  if exists (select 1 from public.trades t join public.trade_assets a on a.trade_id = t.id where t.season_id = p_season_id and t.status = 'proposed' and a.asset_type = 'pick') then raise exception 'Resolve or cancel pending pick trades before changing draft order'; end if;
  if array_length(p_order, 1) is null or array_length(p_order, 1) <> v_settings.league_size then raise exception 'Order must contain exactly % team ids', v_settings.league_size; end if;
  update public.draft_settings set draft_order = p_order, updated_at = now() where season_id = p_season_id;
  delete from public.draft_picks where season_id = p_season_id;
  for v_round in 1..v_settings.roster_size loop
    for v_slot in 1..v_settings.league_size loop
      v_pick := v_pick + 1;
      if v_settings.draft_type = 'snake' and v_round % 2 = 0 then v_team := p_order[v_settings.league_size - v_slot + 1]; else v_team := p_order[v_slot]; end if;
      insert into public.draft_picks (season_id, round, pick_number, team_id, original_team_id) values (p_season_id, v_round, v_pick, v_team, v_team);
    end loop;
  end loop;
  perform public.append_admin_log('set_draft_order', jsonb_build_object(
    'season_id', p_season_id, 'rounds', v_settings.roster_size,
    'draft_type', v_settings.draft_type, 'order', to_jsonb(p_order)));
end;
$$;

create or replace function public.set_draft_status(p_season_id uuid, p_status public.draft_status)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings public.draft_settings;
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

    if v_settings.status = 'pre_draft' then
      if exists (
        select 1 from public.rosters
        where season_id = p_season_id and acquisition <> 'keeper'
      ) then
        raise exception 'Non-keeper players still hold roster spots - run Finalize Keepers before starting the draft';
      end if;
    end if;

    if v_settings.status <> 'running' then
      update public.draft_settings
      set status = 'running',
          turn_deadline_at = null,
          paused_remaining_seconds = null,
          updated_at = now()
      where season_id = p_season_id;
    end if;

    update public.seasons set status = 'live'
    where id = p_season_id and status <> 'complete';

  elsif p_status = 'paused' then
    if v_settings.status <> 'paused' then
      update public.draft_settings
      set status = 'paused',
          turn_deadline_at = null,
          paused_remaining_seconds = null,
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

  perform public.append_admin_log('set_draft_status', jsonb_build_object(
    'season_id', p_season_id, 'from', v_settings.status, 'to', p_status));
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
    set status = 'running', updated_at = now()
    where season_id = p_season_id;
    update public.seasons set status = 'live' where id = p_season_id;
  end if;

  perform public.append_admin_log('undo_draft_action', jsonb_build_object(
    'season_id', p_season_id,
    'pick_number', v_last.pick_number,
    'team_id', v_last.team_id,
    'player_id', v_last.player_id,
    'was_skipped', v_last.is_skipped));
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
  v_picks_cleared int;
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
  select count(*) into v_picks_cleared from public.draft_picks
  where season_id = p_season_id and is_used;
  update public.draft_picks
  set player_id = null, is_used = false, picked_at = null, is_skipped = false, skipped_at = null
  where season_id = p_season_id;
  update public.draft_settings
  set status = 'pre_draft', turn_deadline_at = null, paused_remaining_seconds = null, updated_at = now()
  where season_id = p_season_id;
  update public.seasons set status = 'pre_draft' where id = p_season_id;
  perform public.append_admin_log('reset_draft', jsonb_build_object(
    'season_id', p_season_id, 'picks_cleared', v_picks_cleared));
end;
$$;
