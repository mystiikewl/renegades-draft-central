-- Tighten Trade Center integrity after the base trade schema.
-- Each asset can belong to only one pending proposal, and accepted player
-- movement may not push either team beyond the configured roster size.

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
begin
  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_my_team is null then raise exception 'You must belong to a team'; end if;
  if p_to_team_id = v_my_team then raise exception 'Choose another team'; end if;
  if not exists (select 1 from public.teams where id = p_to_team_id and not is_shadow) then
    raise exception 'Trade partner not found';
  end if;
  if not exists (select 1 from public.seasons where id = p_season_id) then
    raise exception 'Season not found';
  end if;
  if coalesce(array_length(p_offered_roster_ids, 1), 0) + coalesce(array_length(p_offered_pick_ids, 1), 0) = 0 then
    raise exception 'Offer at least one asset';
  end if;
  if coalesce(array_length(p_requested_roster_ids, 1), 0) + coalesce(array_length(p_requested_pick_ids, 1), 0) = 0 then
    raise exception 'Request at least one asset';
  end if;

  insert into public.trades (season_id, from_team_id, to_team_id, proposed_by, note)
  values (p_season_id, v_my_team, p_to_team_id, auth.uid(), nullif(trim(p_note), ''))
  returning id into v_trade_id;

  foreach v_id in array p_offered_roster_ids loop
    select r, p.name into v_roster, v_player_name
    from public.rosters r join public.players p on p.id = r.player_id
    where r.id = v_id and r.season_id = p_season_id for update of r;
    if v_roster.id is null or v_roster.team_id <> v_my_team then raise exception 'Offered player is no longer on your roster'; end if;
    if exists (
      select 1 from public.trade_assets a
      join public.trades t on t.id = a.trade_id
      where a.roster_id = v_id and t.status = 'proposed'
    ) then raise exception '% is already in a pending trade', v_player_name; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, roster_id, asset_label)
    values (v_trade_id, v_my_team, p_to_team_id, 'player', v_id, v_player_name);
  end loop;

  foreach v_id in array p_offered_pick_ids loop
    select * into v_pick from public.draft_picks where id = v_id and season_id = p_season_id for update;
    if v_pick.id is null or v_pick.team_id <> v_my_team then raise exception 'Offered pick is no longer yours'; end if;
    if v_pick.is_used then raise exception 'Used picks cannot be traded'; end if;
    if exists (
      select 1 from public.trade_assets a
      join public.trades t on t.id = a.trade_id
      where a.draft_pick_id = v_id and t.status = 'proposed'
    ) then raise exception 'That pick is already in a pending trade'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, draft_pick_id, asset_label)
    values (v_trade_id, v_my_team, p_to_team_id, 'pick', v_id, format('R%s · Pick #%s', v_pick.round, v_pick.pick_number));
  end loop;

  foreach v_id in array p_requested_roster_ids loop
    select r, p.name into v_roster, v_player_name
    from public.rosters r join public.players p on p.id = r.player_id
    where r.id = v_id and r.season_id = p_season_id for update of r;
    if v_roster.id is null or v_roster.team_id <> p_to_team_id then raise exception 'Requested player is no longer on that roster'; end if;
    if exists (
      select 1 from public.trade_assets a
      join public.trades t on t.id = a.trade_id
      where a.roster_id = v_id and t.status = 'proposed'
    ) then raise exception '% is already in a pending trade', v_player_name; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, roster_id, asset_label)
    values (v_trade_id, p_to_team_id, v_my_team, 'player', v_id, v_player_name);
  end loop;

  foreach v_id in array p_requested_pick_ids loop
    select * into v_pick from public.draft_picks where id = v_id and season_id = p_season_id for update;
    if v_pick.id is null or v_pick.team_id <> p_to_team_id then raise exception 'Requested pick is no longer owned by that team'; end if;
    if v_pick.is_used then raise exception 'Used picks cannot be traded'; end if;
    if exists (
      select 1 from public.trade_assets a
      join public.trades t on t.id = a.trade_id
      where a.draft_pick_id = v_id and t.status = 'proposed'
    ) then raise exception 'That pick is already in a pending trade'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, draft_pick_id, asset_label)
    values (v_trade_id, p_to_team_id, v_my_team, 'pick', v_id, format('R%s · Pick #%s', v_pick.round, v_pick.pick_number));
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
  v_roster_size int;
  v_from_count int;
  v_to_count int;
  v_from_sends int;
  v_to_sends int;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if v_trade.id is null then raise exception 'Trade not found'; end if;
  if v_trade.status <> 'proposed' then raise exception 'Trade is no longer pending'; end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_my_team <> v_trade.to_team_id and not public.is_admin() then
    raise exception 'Only the receiving team can accept this trade';
  end if;

  for v_asset in select * from public.trade_assets where trade_id = p_trade_id order by id loop
    if v_asset.asset_type = 'player' then
      select * into v_roster from public.rosters where id = v_asset.roster_id for update;
      if v_roster.id is null or v_roster.team_id <> v_asset.from_team_id then
        raise exception '% is no longer owned by the offering team', v_asset.asset_label;
      end if;
    else
      select * into v_pick from public.draft_picks where id = v_asset.draft_pick_id for update;
      if v_pick.id is null or v_pick.team_id <> v_asset.from_team_id or v_pick.is_used then
        raise exception '% is no longer tradeable', v_asset.asset_label;
      end if;
    end if;
  end loop;

  select roster_size into v_roster_size from public.draft_settings where season_id = v_trade.season_id;
  if v_roster_size is null then raise exception 'Draft settings not found'; end if;

  select count(*) into v_from_count from public.rosters where season_id = v_trade.season_id and team_id = v_trade.from_team_id;
  select count(*) into v_to_count from public.rosters where season_id = v_trade.season_id and team_id = v_trade.to_team_id;
  select count(*) into v_from_sends from public.trade_assets where trade_id = p_trade_id and asset_type = 'player' and from_team_id = v_trade.from_team_id;
  select count(*) into v_to_sends from public.trade_assets where trade_id = p_trade_id and asset_type = 'player' and from_team_id = v_trade.to_team_id;

  if v_from_count - v_from_sends + v_to_sends > v_roster_size then
    raise exception '% would exceed the roster limit', (select name from public.teams where id = v_trade.from_team_id);
  end if;
  if v_to_count - v_to_sends + v_from_sends > v_roster_size then
    raise exception '% would exceed the roster limit', (select name from public.teams where id = v_trade.to_team_id);
  end if;

  for v_asset in select * from public.trade_assets where trade_id = p_trade_id order by id loop
    if v_asset.asset_type = 'player' then
      update public.rosters
      set team_id = v_asset.to_team_id, acquisition = 'trade', acquired_at = now()
      where id = v_asset.roster_id;
    else
      update public.draft_picks set team_id = v_asset.to_team_id where id = v_asset.draft_pick_id;
    end if;
  end loop;

  update public.trades
  set status = 'accepted', resolved_by = auth.uid(), resolved_at = now()
  where id = p_trade_id;
end;
$$;
