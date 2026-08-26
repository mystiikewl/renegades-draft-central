-- First-class trade workflow.
-- Trades are proposed by one team, accepted/rejected by the counterparty, and
-- executed atomically. Assets can be rostered players and/or unused draft picks.

create type public.trade_status as enum ('proposed', 'accepted', 'rejected', 'cancelled');
create type public.trade_asset_type as enum ('player', 'pick');

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  from_team_id uuid not null references public.teams (id) on delete cascade,
  to_team_id uuid not null references public.teams (id) on delete cascade,
  proposed_by uuid not null references public.profiles (id) on delete restrict,
  resolved_by uuid references public.profiles (id) on delete set null,
  status public.trade_status not null default 'proposed',
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (from_team_id <> to_team_id)
);

create index trades_season_created_idx on public.trades (season_id, created_at desc);
create index trades_status_idx on public.trades (season_id, status);

create table public.trade_assets (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades (id) on delete cascade,
  from_team_id uuid not null references public.teams (id) on delete restrict,
  to_team_id uuid not null references public.teams (id) on delete restrict,
  asset_type public.trade_asset_type not null,
  roster_id uuid references public.rosters (id) on delete restrict,
  draft_pick_id uuid references public.draft_picks (id) on delete restrict,
  asset_label text not null,
  created_at timestamptz not null default now(),
  check (
    (asset_type = 'player' and roster_id is not null and draft_pick_id is null)
    or
    (asset_type = 'pick' and draft_pick_id is not null and roster_id is null)
  )
);

create index trade_assets_trade_idx on public.trade_assets (trade_id);

alter table public.trades enable row level security;
alter table public.trade_assets enable row level security;

create policy "authenticated users can read trades"
on public.trades for select to authenticated using (true);

create policy "authenticated users can read trade assets"
on public.trade_assets for select to authenticated using (true);

alter publication supabase_realtime add table public.trades, public.trade_assets;

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
    select r.* into v_roster
    from public.rosters r
    where r.id = v_id and r.season_id = p_season_id for update;
    select p.name into v_player_name from public.players p where p.id = v_roster.player_id;
    if v_roster.id is null or v_roster.team_id <> v_my_team then raise exception 'Offered player is no longer on your roster'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, roster_id, asset_label)
    values (v_trade_id, v_my_team, p_to_team_id, 'player', v_id, v_player_name);
  end loop;

  foreach v_id in array p_offered_pick_ids loop
    select * into v_pick from public.draft_picks where id = v_id and season_id = p_season_id for update;
    if v_pick.id is null or v_pick.team_id <> v_my_team then raise exception 'Offered pick is no longer yours'; end if;
    if v_pick.is_used then raise exception 'Used picks cannot be traded'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, draft_pick_id, asset_label)
    values (v_trade_id, v_my_team, p_to_team_id, 'pick', v_id, format('R%s · Pick #%s', v_pick.round, v_pick.pick_number));
  end loop;

  foreach v_id in array p_requested_roster_ids loop
    select r.* into v_roster
    from public.rosters r
    where r.id = v_id and r.season_id = p_season_id for update;
    select p.name into v_player_name from public.players p where p.id = v_roster.player_id;
    if v_roster.id is null or v_roster.team_id <> p_to_team_id then raise exception 'Requested player is no longer on that roster'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, roster_id, asset_label)
    values (v_trade_id, p_to_team_id, v_my_team, 'player', v_id, v_player_name);
  end loop;

  foreach v_id in array p_requested_pick_ids loop
    select * into v_pick from public.draft_picks where id = v_id and season_id = p_season_id for update;
    if v_pick.id is null or v_pick.team_id <> p_to_team_id then raise exception 'Requested pick is no longer owned by that team'; end if;
    if v_pick.is_used then raise exception 'Used picks cannot be traded'; end if;
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

create or replace function public.reject_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_trade public.trades;
  v_my_team uuid;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if v_trade.id is null then raise exception 'Trade not found'; end if;
  if v_trade.status <> 'proposed' then raise exception 'Trade is no longer pending'; end if;
  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_my_team <> v_trade.to_team_id and not public.is_admin() then raise exception 'Only the receiving team can reject this trade'; end if;
  update public.trades set status = 'rejected', resolved_by = auth.uid(), resolved_at = now() where id = p_trade_id;
end;
$$;

create or replace function public.cancel_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_trade public.trades;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if v_trade.id is null then raise exception 'Trade not found'; end if;
  if v_trade.status <> 'proposed' then raise exception 'Trade is no longer pending'; end if;
  if v_trade.proposed_by <> auth.uid() and not public.is_admin() then raise exception 'Only the proposer can cancel this trade'; end if;
  update public.trades set status = 'cancelled', resolved_by = auth.uid(), resolved_at = now() where id = p_trade_id;
end;
$$;

grant execute on function public.propose_trade(uuid, uuid, uuid[], uuid[], uuid[], uuid[], text) to authenticated;
grant execute on function public.accept_trade(uuid) to authenticated;
grant execute on function public.reject_trade(uuid) to authenticated;
grant execute on function public.cancel_trade(uuid) to authenticated;
