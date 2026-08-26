-- Keep every trade decision editable only until draft completion.
-- Accepted trades are already guarded in the integrity migration; close the
-- same lifecycle gap for reject/cancel decisions as well.

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
end;
$$;
