-- Trade + draft integrity hardening.
--
-- Invariants:
--   * trades may temporarily create roster surpluses; drafting may not
--   * accepted pick ownership survives a draft reset
--   * a reset/undo never silently tears apart an accepted player trade
--   * commissioner overrides are recorded in the same per-season trade ledger
--   * accepted trades can be reversed by a commissioner until draft completion
--   * skipped picks are first-class, undoable draft outcomes

alter table public.draft_picks
  add column if not exists is_skipped boolean not null default false,
  add column if not exists skipped_at timestamptz;

alter table public.trades
  add column if not exists is_admin_override boolean not null default false,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reversal_reason text;

create index if not exists trades_season_accepted_idx
  on public.trades (season_id, resolved_at desc)
  where status = 'accepted';

create or replace function public.propose_trade(
  p_season_id uuid,
  p_to_team_id uuid,
  p_offered_roster_ids uuid[] default '{}',
  p_offered_pick_ids uuid[] default '{}',
  p_requested_roster_ids uuid[] default '{}',
  p_requested_pick_ids uuid[] default '{}',
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_my_team uuid;
  v_trade_id uuid;
  v_id uuid;
  v_player_name text;
  v_pick public.draft_picks;
  v_roster public.rosters;
  v_status public.draft_status;
begin
  select status into v_status from public.draft_settings where season_id = p_season_id for update;
  if v_status is null then raise exception 'Draft settings not found'; end if;
  if v_status = 'complete' then raise exception 'Trades are locked after draft completion'; end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_my_team is null then raise exception 'You must belong to a team'; end if;
  if p_to_team_id = v_my_team then raise exception 'Choose another team'; end if;
  if not exists (select 1 from public.teams where id = p_to_team_id and not is_shadow) then raise exception 'Trade partner not found'; end if;
  if coalesce(array_length(p_offered_roster_ids, 1), 0) + coalesce(array_length(p_offered_pick_ids, 1), 0) = 0 then raise exception 'Offer at least one asset'; end if;
  if coalesce(array_length(p_requested_roster_ids, 1), 0) + coalesce(array_length(p_requested_pick_ids, 1), 0) = 0 then raise exception 'Request at least one asset'; end if;

  insert into public.trades (season_id, from_team_id, to_team_id, proposed_by, note)
  values (p_season_id, v_my_team, p_to_team_id, auth.uid(), nullif(trim(p_note), '')) returning id into v_trade_id;

  foreach v_id in array p_offered_roster_ids loop
    select r, p.name into v_roster, v_player_name from public.rosters r join public.players p on p.id = r.player_id where r.id = v_id and r.season_id = p_season_id for update of r;
    if v_roster.id is null or v_roster.team_id <> v_my_team then raise exception 'Offered player is no longer on your roster'; end if;
    if exists (select 1 from public.trade_assets a join public.trades t on t.id = a.trade_id where a.roster_id = v_id and t.status = 'proposed') then raise exception '% is already in a pending trade', v_player_name; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, roster_id, asset_label) values (v_trade_id, v_my_team, p_to_team_id, 'player', v_id, v_player_name);
  end loop;

  foreach v_id in array p_offered_pick_ids loop
    select * into v_pick from public.draft_picks where id = v_id and season_id = p_season_id for update;
    if v_pick.id is null or v_pick.team_id <> v_my_team then raise exception 'Offered pick is no longer yours'; end if;
    if v_pick.is_used then raise exception 'Used picks cannot be traded'; end if;
    if exists (select 1 from public.trade_assets a join public.trades t on t.id = a.trade_id where a.draft_pick_id = v_id and t.status = 'proposed') then raise exception 'That pick is already in a pending trade'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, draft_pick_id, asset_label) values (v_trade_id, v_my_team, p_to_team_id, 'pick', v_id, format('R%s · Pick #%s', v_pick.round, v_pick.pick_number));
  end loop;

  foreach v_id in array p_requested_roster_ids loop
    select r, p.name into v_roster, v_player_name from public.rosters r join public.players p on p.id = r.player_id where r.id = v_id and r.season_id = p_season_id for update of r;
    if v_roster.id is null or v_roster.team_id <> p_to_team_id then raise exception 'Requested player is no longer on that roster'; end if;
    if exists (select 1 from public.trade_assets a join public.trades t on t.id = a.trade_id where a.roster_id = v_id and t.status = 'proposed') then raise exception '% is already in a pending trade', v_player_name; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, roster_id, asset_label) values (v_trade_id, p_to_team_id, v_my_team, 'player', v_id, v_player_name);
  end loop;

  foreach v_id in array p_requested_pick_ids loop
    select * into v_pick from public.draft_picks where id = v_id and season_id = p_season_id for update;
    if v_pick.id is null or v_pick.team_id <> p_to_team_id then raise exception 'Requested pick is no longer owned by that team'; end if;
    if v_pick.is_used then raise exception 'Used picks cannot be traded'; end if;
    if exists (select 1 from public.trade_assets a join public.trades t on t.id = a.trade_id where a.draft_pick_id = v_id and t.status = 'proposed') then raise exception 'That pick is already in a pending trade'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, draft_pick_id, asset_label) values (v_trade_id, p_to_team_id, v_my_team, 'pick', v_id, format('R%s · Pick #%s', v_pick.round, v_pick.pick_number));
  end loop;
  return v_trade_id;
end;
$$;

create or replace function public.accept_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_trade public.trades;
  v_my_team uuid;
  v_asset public.trade_assets;
  v_roster public.rosters;
  v_pick public.draft_picks;
  v_status public.draft_status;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if v_trade.id is null then raise exception 'Trade not found'; end if;
  if v_trade.status <> 'proposed' then raise exception 'Trade is no longer pending'; end if;
  select status into v_status from public.draft_settings where season_id = v_trade.season_id for update;
  if v_status = 'complete' then raise exception 'Trades are locked after draft completion'; end if;
  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_my_team <> v_trade.to_team_id and not public.is_admin() then raise exception 'Only the receiving team can accept this trade'; end if;

  for v_asset in select * from public.trade_assets where trade_id = p_trade_id order by id loop
    if v_asset.asset_type = 'player' then
      select * into v_roster from public.rosters where id = v_asset.roster_id for update;
      if v_roster.id is null or v_roster.team_id <> v_asset.from_team_id then raise exception '% is no longer owned by the offering team', v_asset.asset_label; end if;
    else
      select * into v_pick from public.draft_picks where id = v_asset.draft_pick_id for update;
      if v_pick.id is null or v_pick.team_id <> v_asset.from_team_id or v_pick.is_used then raise exception '% is no longer tradeable', v_asset.asset_label; end if;
    end if;
  end loop;

  for v_asset in select * from public.trade_assets where trade_id = p_trade_id order by id loop
    if v_asset.asset_type = 'player' then
      update public.rosters set team_id = v_asset.to_team_id, acquired_at = now() where id = v_asset.roster_id;
    else
      update public.draft_picks set team_id = v_asset.to_team_id where id = v_asset.draft_pick_id;
    end if;
  end loop;
  update public.trades set status = 'accepted', resolved_by = auth.uid(), resolved_at = now() where id = p_trade_id;
end;
$$;

create or replace function public.admin_override_trade(
  p_season_id uuid,
  p_from_team_id uuid,
  p_to_team_id uuid,
  p_from_roster_ids uuid[] default '{}',
  p_from_pick_ids uuid[] default '{}',
  p_to_roster_ids uuid[] default '{}',
  p_to_pick_ids uuid[] default '{}',
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_trade_id uuid;
  v_id uuid;
  v_player_name text;
  v_pick public.draft_picks;
  v_roster public.rosters;
  v_status public.draft_status;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if p_from_team_id = p_to_team_id then raise exception 'Choose two different teams'; end if;
  select status into v_status from public.draft_settings where season_id = p_season_id for update;
  if v_status is null then raise exception 'Draft settings not found'; end if;
  if v_status = 'complete' then raise exception 'Trade overrides are locked after draft completion'; end if;
  if coalesce(array_length(p_from_roster_ids, 1), 0) + coalesce(array_length(p_from_pick_ids, 1), 0) + coalesce(array_length(p_to_roster_ids, 1), 0) + coalesce(array_length(p_to_pick_ids, 1), 0) = 0 then raise exception 'Select at least one asset'; end if;

  insert into public.trades (season_id, from_team_id, to_team_id, proposed_by, resolved_by, status, note, resolved_at, is_admin_override)
  values (p_season_id, p_from_team_id, p_to_team_id, auth.uid(), auth.uid(), 'accepted', nullif(trim(p_note), ''), now(), true) returning id into v_trade_id;

  foreach v_id in array p_from_roster_ids loop
    select r, p.name into v_roster, v_player_name from public.rosters r join public.players p on p.id = r.player_id where r.id = v_id and r.season_id = p_season_id for update of r;
    if v_roster.id is null or v_roster.team_id <> p_from_team_id then raise exception 'A selected player is no longer on the source roster'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, roster_id, asset_label) values (v_trade_id, p_from_team_id, p_to_team_id, 'player', v_id, v_player_name);
    update public.rosters set team_id = p_to_team_id, acquired_at = now() where id = v_id;
  end loop;

  foreach v_id in array p_from_pick_ids loop
    select * into v_pick from public.draft_picks where id = v_id and season_id = p_season_id for update;
    if v_pick.id is null or v_pick.team_id <> p_from_team_id or v_pick.is_used then raise exception 'A selected source pick is no longer tradeable'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, draft_pick_id, asset_label) values (v_trade_id, p_from_team_id, p_to_team_id, 'pick', v_id, format('R%s · Pick #%s', v_pick.round, v_pick.pick_number));
    update public.draft_picks set team_id = p_to_team_id where id = v_id;
  end loop;

  foreach v_id in array p_to_roster_ids loop
    select r, p.name into v_roster, v_player_name from public.rosters r join public.players p on p.id = r.player_id where r.id = v_id and r.season_id = p_season_id for update of r;
    if v_roster.id is null or v_roster.team_id <> p_to_team_id then raise exception 'A selected player is no longer on the counterparty roster'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, roster_id, asset_label) values (v_trade_id, p_to_team_id, p_from_team_id, 'player', v_id, v_player_name);
    update public.rosters set team_id = p_from_team_id, acquired_at = now() where id = v_id;
  end loop;

  foreach v_id in array p_to_pick_ids loop
    select * into v_pick from public.draft_picks where id = v_id and season_id = p_season_id for update;
    if v_pick.id is null or v_pick.team_id <> p_to_team_id or v_pick.is_used then raise exception 'A selected counterparty pick is no longer tradeable'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, draft_pick_id, asset_label) values (v_trade_id, p_to_team_id, p_from_team_id, 'pick', v_id, format('R%s · Pick #%s', v_pick.round, v_pick.pick_number));
    update public.draft_picks set team_id = p_from_team_id where id = v_id;
  end loop;

  update public.trades t set status = 'cancelled', resolved_by = auth.uid(), resolved_at = now()
  where t.season_id = p_season_id and t.status = 'proposed' and exists (
    select 1 from public.trade_assets pending join public.trade_assets moved on moved.trade_id = v_trade_id
    where pending.trade_id = t.id and ((pending.roster_id is not null and pending.roster_id = moved.roster_id) or (pending.draft_pick_id is not null and pending.draft_pick_id = moved.draft_pick_id))
  );
  return v_trade_id;
end;
$$;

create or replace function public.admin_reverse_trade(p_trade_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_trade public.trades;
  v_asset public.trade_assets;
  v_roster public.rosters;
  v_pick public.draft_picks;
  v_status public.draft_status;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  select * into v_trade from public.trades where id = p_trade_id for update;
  if v_trade.id is null then raise exception 'Trade not found'; end if;
  if v_trade.status <> 'accepted' then raise exception 'Only an accepted trade can be reversed'; end if;
  select status into v_status from public.draft_settings where season_id = v_trade.season_id for update;
  if v_status = 'complete' then raise exception 'Trade history is locked after draft completion'; end if;

  for v_asset in select * from public.trade_assets where trade_id = p_trade_id order by id loop
    if v_asset.asset_type = 'player' then
      select * into v_roster from public.rosters where id = v_asset.roster_id for update;
      if v_roster.id is null or v_roster.team_id <> v_asset.to_team_id then raise exception '% has moved since this trade; reverse newer moves first', v_asset.asset_label; end if;
    else
      select * into v_pick from public.draft_picks where id = v_asset.draft_pick_id for update;
      if v_pick.id is null or v_pick.team_id <> v_asset.to_team_id or v_pick.is_used then raise exception '% can no longer be reversed', v_asset.asset_label; end if;
    end if;
  end loop;

  for v_asset in select * from public.trade_assets where trade_id = p_trade_id order by id loop
    if v_asset.asset_type = 'player' then update public.rosters set team_id = v_asset.from_team_id, acquired_at = now() where id = v_asset.roster_id;
    else update public.draft_picks set team_id = v_asset.from_team_id where id = v_asset.draft_pick_id; end if;
  end loop;

  update public.trades set status = 'cancelled', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = nullif(trim(p_reason), ''), resolved_by = auth.uid(), resolved_at = now() where id = p_trade_id;
end;
$$;

create or replace function public.skip_pick(p_season_id uuid)
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
  select * into v_next_pick from public.draft_picks where season_id = p_season_id and not is_used order by pick_number limit 1 for update;
  if v_next_pick.id is null then raise exception 'No picks remaining'; end if;
  if v_next_pick.team_id <> v_my_team and not public.is_admin() then raise exception 'Not your pick — it is pick %', v_next_pick.pick_number; end if;
  update public.draft_picks set is_used = true, is_skipped = true, player_id = null, picked_at = now(), skipped_at = now() where id = v_next_pick.id returning * into v_next_pick;
  if not exists (select 1 from public.draft_picks where season_id = p_season_id and not is_used) then
    update public.draft_settings set status = 'complete', updated_at = now() where season_id = p_season_id;
    update public.seasons set status = 'complete' where id = p_season_id;
    update public.trades set status = 'cancelled', resolved_at = now() where season_id = p_season_id and status = 'proposed';
  end if;
  return v_next_pick;
end;
$$;

create or replace function public.make_pick(p_season_id uuid, p_player_id uuid)
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
  select * into v_next_pick from public.draft_picks where season_id = p_season_id and not is_used order by pick_number limit 1 for update;
  if v_next_pick.id is null then raise exception 'No picks remaining'; end if;
  if v_next_pick.team_id <> v_my_team and not public.is_admin() then raise exception 'Not your pick — it is pick %', v_next_pick.pick_number; end if;
  select count(*) into v_roster_count from public.rosters where season_id = p_season_id and team_id = v_next_pick.team_id;
  if v_roster_count >= v_settings.roster_size then raise exception 'Roster is full — trade/drop a player or skip this pick'; end if;
  if not exists (select 1 from public.players where id = p_player_id) then raise exception 'Player not found'; end if;
  if exists (select 1 from public.rosters where season_id = p_season_id and player_id = p_player_id) then raise exception 'Player already on a roster this season'; end if;
  update public.draft_picks set player_id = p_player_id, is_used = true, is_skipped = false, picked_at = now(), skipped_at = null where id = v_next_pick.id;
  insert into public.rosters (season_id, team_id, player_id, acquisition, draft_pick_id) values (p_season_id, v_next_pick.team_id, p_player_id, 'draft', v_next_pick.id);
  if not exists (select 1 from public.draft_picks where season_id = p_season_id and not is_used) then
    update public.draft_settings set status = 'complete', updated_at = now() where season_id = p_season_id;
    update public.seasons set status = 'complete' where id = p_season_id;
    update public.trades set status = 'cancelled', resolved_at = now() where season_id = p_season_id and status = 'proposed';
  end if;
  select * into v_next_pick from public.draft_picks where id = v_next_pick.id;
  return v_next_pick;
end;
$$;

create or replace function public.undo_last_pick(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_last public.draft_picks;
  v_my_team uuid;
  v_was_complete boolean;
  v_roster_id uuid;
begin
  select * into v_last from public.draft_picks where season_id = p_season_id and is_used order by pick_number desc limit 1 for update;
  if v_last.id is null then raise exception 'No picks to undo'; end if;
  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_last.team_id <> v_my_team and not public.is_admin() then raise exception 'Only the picking team or an admin can undo'; end if;
  select id into v_roster_id from public.rosters where draft_pick_id = v_last.id for update;
  if v_roster_id is not null and exists (select 1 from public.trade_assets a join public.trades t on t.id = a.trade_id where a.roster_id = v_roster_id and t.status = 'accepted') then raise exception 'This drafted player has been traded — reverse/correct that trade before undoing the pick'; end if;
  select (status = 'complete') into v_was_complete from public.draft_settings where season_id = p_season_id;
  delete from public.rosters where draft_pick_id = v_last.id;
  update public.draft_picks set player_id = null, is_used = false, picked_at = null, is_skipped = false, skipped_at = null where id = v_last.id;
  if v_was_complete then
    update public.draft_settings set status = 'running', updated_at = now() where season_id = p_season_id;
    update public.seasons set status = 'live' where id = p_season_id;
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
  if exists (select 1 from public.trades t join public.trade_assets a on a.trade_id = t.id and a.asset_type = 'player' join public.rosters r on r.id = a.roster_id where t.season_id = p_season_id and t.status = 'accepted' and r.draft_pick_id is not null) then raise exception 'Reset blocked: a drafted player is part of an accepted trade. Reverse/correct that trade first.'; end if;
  update public.trades set status = 'cancelled', resolved_by = auth.uid(), resolved_at = now() where season_id = p_season_id and status = 'proposed';
  delete from public.rosters where season_id = p_season_id and draft_pick_id is not null;
  update public.draft_picks set player_id = null, is_used = false, picked_at = null, is_skipped = false, skipped_at = null where season_id = p_season_id;
  update public.draft_settings set status = 'pre_draft', updated_at = now() where season_id = p_season_id;
  update public.seasons set status = 'pre_draft' where id = p_season_id;
end;
$$;

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
end;
$$;

revoke execute on function public.trade_pick(uuid, uuid) from authenticated;
revoke execute on function public.swap_picks(uuid, uuid) from authenticated;
grant execute on function public.skip_pick(uuid) to authenticated;
grant execute on function public.admin_override_trade(uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], text) to authenticated;
grant execute on function public.admin_reverse_trade(uuid, text) to authenticated;
