-- Trade notifications + competing offers.
--
-- 1. Every trade lifecycle event now produces a notification row for the
--    affected team(s); the client renders an unread-count bell (see
--    docs/SPEC-trade-notifications.md).
-- 2. Assets may sit in multiple pending proposals at once ("competing
--    offers"): the per-asset exclusivity checks in propose_trade are gone.
--    First accepted trade wins — accept_trade cancels every other pending
--    trade that shares a moved asset (same semantics admin_override_trade
--    already applied inline, extracted into cancel_conflicting_trades).
--
-- Human decisions (propose/accept/reject/cancel/admin) insert their
-- notifications explicitly. System sweeps — draft completion cancelling all
-- pending trades in make_pick / skip_pick / *_for_slot / set_draft_status,
-- and conflict cancellation — are covered by the trades_auto_cancelled_notify
-- trigger, which fires on proposed -> cancelled when resolved_by is null or
-- auto_cancelled is set. Future sweep sites are covered automatically.
--
-- reset_draft keeps resolved_by = admin, so its sweep stays unnotified
-- (deliberate: rare, commissioner-driven, and the admin UI announces it).

alter table public.trades
  add column if not exists auto_cancelled boolean not null default false;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  type text not null check (type in (
    'trade_proposed', 'trade_accepted', 'trade_rejected',
    'trade_cancelled', 'trade_auto_cancelled', 'trade_reversed'
  )),
  trade_id uuid references public.trades (id) on delete cascade,
  actor_team_id uuid references public.teams (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_team_created_idx on public.notifications (team_id, created_at desc);
create index notifications_team_unread_idx on public.notifications (team_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "teams can read own notifications"
on public.notifications for select to authenticated
using (team_id = (select team_id from public.profiles where id = auth.uid()));

-- Reads only from clients; rows are written inside SECURITY DEFINER trade RPCs.
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;

alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------
-- System-cancel notifier. Covers every proposed -> cancelled transition
-- made outside a human RPC: draft-completion sweeps (resolved_by null)
-- and conflict cancellation (auto_cancelled true).
-- ---------------------------------------------------------------------
create or replace function public.notify_trade_auto_cancelled()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_body text;
begin
  if exists (
    select 1 from public.draft_settings
    where season_id = new.season_id and status = 'complete'
  ) then
    v_body := 'Draft completed — pending trades were cancelled';
  else
    v_body := 'Trade cancelled — an asset in this offer was traded elsewhere';
  end if;

  insert into public.notifications (season_id, team_id, type, trade_id, body)
  values (new.season_id, new.from_team_id, 'trade_auto_cancelled', new.id, v_body),
         (new.season_id, new.to_team_id, 'trade_auto_cancelled', new.id, v_body);
  return null;
end;
$$;

create trigger trades_auto_cancelled_notify
after update on public.trades
for each row
when (old.status = 'proposed' and new.status = 'cancelled'
      and (new.auto_cancelled or new.resolved_by is null))
execute function public.notify_trade_auto_cancelled();

-- ---------------------------------------------------------------------
-- Shared conflict canceller: first accepted trade wins. Any other pending
-- trade in the season sharing a moved roster spot or pick is cancelled;
-- the trigger above notifies both parties.
-- ---------------------------------------------------------------------
create or replace function public.cancel_conflicting_trades(p_accepted_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
begin
  update public.trades t
  set status = 'cancelled', resolved_at = now(), auto_cancelled = true
  where t.status = 'proposed'
    and t.id <> p_accepted_trade_id
    and t.season_id = (select season_id from public.trades where id = p_accepted_trade_id)
    and exists (
      select 1
      from public.trade_assets pending
      join public.trade_assets moved on moved.trade_id = p_accepted_trade_id
      where pending.trade_id = t.id
        and (
          (pending.roster_id is not null and pending.roster_id = moved.roster_id)
          or (pending.draft_pick_id is not null and pending.draft_pick_id = moved.draft_pick_id)
        )
    );
end;
$$;

-- ---------------------------------------------------------------------
-- Trade RPCs (latest bodies from 20260826130000 / 20260826131000, with
-- exclusivity checks removed and notifications added).
-- ---------------------------------------------------------------------

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
    select r.* into v_roster from public.rosters r where r.id = v_id and r.season_id = p_season_id for update;
    select p.name into v_player_name from public.players p where p.id = v_roster.player_id;
    if v_roster.id is null or v_roster.team_id <> v_my_team then raise exception 'Offered player is no longer on your roster'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, roster_id, asset_label) values (v_trade_id, v_my_team, p_to_team_id, 'player', v_id, v_player_name);
  end loop;

  foreach v_id in array p_offered_pick_ids loop
    select * into v_pick from public.draft_picks where id = v_id and season_id = p_season_id for update;
    if v_pick.id is null or v_pick.team_id <> v_my_team then raise exception 'Offered pick is no longer yours'; end if;
    if v_pick.is_used then raise exception 'Used picks cannot be traded'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, draft_pick_id, asset_label) values (v_trade_id, v_my_team, p_to_team_id, 'pick', v_id, format('R%s · Pick #%s', v_pick.round, v_pick.pick_number));
  end loop;

  foreach v_id in array p_requested_roster_ids loop
    select r.* into v_roster from public.rosters r where r.id = v_id and r.season_id = p_season_id for update;
    select p.name into v_player_name from public.players p where p.id = v_roster.player_id;
    if v_roster.id is null or v_roster.team_id <> p_to_team_id then raise exception 'Requested player is no longer on that roster'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, roster_id, asset_label) values (v_trade_id, p_to_team_id, v_my_team, 'player', v_id, v_player_name);
  end loop;

  foreach v_id in array p_requested_pick_ids loop
    select * into v_pick from public.draft_picks where id = v_id and season_id = p_season_id for update;
    if v_pick.id is null or v_pick.team_id <> p_to_team_id then raise exception 'Requested pick is no longer owned by that team'; end if;
    if v_pick.is_used then raise exception 'Used picks cannot be traded'; end if;
    insert into public.trade_assets (trade_id, from_team_id, to_team_id, asset_type, draft_pick_id, asset_label) values (v_trade_id, p_to_team_id, v_my_team, 'pick', v_id, format('R%s · Pick #%s', v_pick.round, v_pick.pick_number));
  end loop;

  insert into public.notifications (season_id, team_id, type, trade_id, actor_team_id, body)
  values (p_season_id, p_to_team_id, 'trade_proposed', v_trade_id, v_my_team,
          (select name from public.teams where id = v_my_team) || ' sent you a trade offer');

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

  update public.trades set status = 'accepted', resolved_by = auth.uid(), resolved_at = now()
  where id = p_trade_id;

  perform public.cancel_conflicting_trades(p_trade_id);

  insert into public.notifications (season_id, team_id, type, trade_id, actor_team_id, body)
  values (v_trade.season_id, v_trade.from_team_id, 'trade_accepted', p_trade_id, v_trade.to_team_id,
          (select name from public.teams where id = v_trade.to_team_id) || ' accepted your trade');
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
  v_status public.draft_status;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if v_trade.id is null then raise exception 'Trade not found'; end if;
  if v_trade.status <> 'proposed' then raise exception 'Trade is no longer pending'; end if;

  select status into v_status
  from public.draft_settings
  where season_id = v_trade.season_id
  for update;
  if v_status = 'complete' then raise exception 'Trade decisions are locked after draft completion'; end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_my_team <> v_trade.to_team_id and not public.is_admin() then
    raise exception 'Only the receiving team can reject this trade';
  end if;

  update public.trades
  set status = 'rejected', resolved_by = auth.uid(), resolved_at = now()
  where id = p_trade_id;

  insert into public.notifications (season_id, team_id, type, trade_id, actor_team_id, body)
  values (v_trade.season_id, v_trade.from_team_id, 'trade_rejected', p_trade_id, v_trade.to_team_id,
          (select name from public.teams where id = v_trade.to_team_id) || ' rejected your trade');
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
  v_status public.draft_status;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if v_trade.id is null then raise exception 'Trade not found'; end if;
  if v_trade.status <> 'proposed' then raise exception 'Trade is no longer pending'; end if;

  select status into v_status
  from public.draft_settings
  where season_id = v_trade.season_id
  for update;
  if v_status = 'complete' then raise exception 'Trade decisions are locked after draft completion'; end if;

  if v_trade.proposed_by <> auth.uid() and not public.is_admin() then
    raise exception 'Only the proposer can cancel this trade';
  end if;

  update public.trades
  set status = 'cancelled', resolved_by = auth.uid(), resolved_at = now()
  where id = p_trade_id;

  insert into public.notifications (season_id, team_id, type, trade_id, actor_team_id, body)
  values (v_trade.season_id, v_trade.to_team_id, 'trade_cancelled', p_trade_id, v_trade.from_team_id,
          (select name from public.teams where id = v_trade.from_team_id) || ' cancelled their trade offer');
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
    select r.* into v_roster from public.rosters r where r.id = v_id and r.season_id = p_season_id for update;
    select p.name into v_player_name from public.players p where p.id = v_roster.player_id;
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
    select r.* into v_roster from public.rosters r where r.id = v_id and r.season_id = p_season_id for update;
    select p.name into v_player_name from public.players p where p.id = v_roster.player_id;
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

  perform public.cancel_conflicting_trades(v_trade_id);

  insert into public.notifications (season_id, team_id, type, trade_id, body)
  values (p_season_id, p_from_team_id, 'trade_accepted', v_trade_id, 'Commissioner recorded a trade involving your team'),
         (p_season_id, p_to_team_id, 'trade_accepted', v_trade_id, 'Commissioner recorded a trade involving your team');

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

  insert into public.notifications (season_id, team_id, type, trade_id, body)
  values (v_trade.season_id, v_trade.from_team_id, 'trade_reversed', p_trade_id, 'Commissioner reversed a trade involving your team'),
         (v_trade.season_id, v_trade.to_team_id, 'trade_reversed', p_trade_id, 'Commissioner reversed a trade involving your team');
end;
$$;

-- ---------------------------------------------------------------------
-- Mark-read. NULL p_ids marks everything unread for the caller's team.
-- ---------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_my_team uuid;
begin
  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_my_team is null then raise exception 'You must belong to a team'; end if;
  update public.notifications
  set read_at = now()
  where team_id = v_my_team
    and read_at is null
    and (p_ids is null or id = any (p_ids));
end;
$$;

grant execute on function public.propose_trade(uuid, uuid, uuid[], uuid[], uuid[], uuid[], text) to authenticated;
grant execute on function public.accept_trade(uuid) to authenticated;
grant execute on function public.reject_trade(uuid) to authenticated;
grant execute on function public.cancel_trade(uuid) to authenticated;
grant execute on function public.admin_override_trade(uuid, uuid, uuid, uuid[], uuid[], uuid[], uuid[], text) to authenticated;
grant execute on function public.admin_reverse_trade(uuid, text) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
