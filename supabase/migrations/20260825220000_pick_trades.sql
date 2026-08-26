-- Pick trading: users trade unused picks. A "swap" is two trades (or a single
-- mutual swap RPC). Trades only move current_team_id — original_team_id stays
-- fixed for history. Both sides of a mutual trade are verified atomically.

-- One-sided: give my pick to another team (gift or one leg of a deal done
-- out-of-band). Caller must own the pick's current team.
create or replace function public.trade_pick(p_pick_id uuid, p_to_team_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_pick public.draft_picks;
  v_my_team uuid;
  v_status text;
begin
  select * into v_pick from public.draft_picks where id = p_pick_id for update;
  if v_pick.id is null then
    raise exception 'Pick not found';
  end if;
  if v_pick.is_used then
    raise exception 'Cannot trade a used pick';
  end if;

  select status into v_status from public.draft_settings where season_id = v_pick.season_id;
  if v_status = 'complete' then
    raise exception 'Draft is complete';
  end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_pick.team_id <> v_my_team and not public.is_admin() then
    raise exception 'You do not own this pick';
  end if;
  if p_to_team_id = v_pick.team_id then
    raise exception 'Pick already belongs to that team';
  end if;
  if exists (select 1 from public.teams where id = p_to_team_id and is_shadow) then
    raise exception 'Cannot trade with a shadow team';
  end if;

  update public.draft_picks set team_id = p_to_team_id where id = p_pick_id;
end;
$$;

-- Mutual atomic swap: I give pick A, I receive pick B. Both legs checked in
-- one transaction — no half-trades.
create or replace function public.swap_picks(p_mine uuid, p_theirs uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_a public.draft_picks;
  v_b public.draft_picks;
  v_my_team uuid;
begin
  select * into v_a from public.draft_picks where id = p_mine for update;
  select * into v_b from public.draft_picks where id = p_theirs for update;
  if v_a.id is null or v_b.id is null then
    raise exception 'Pick not found';
  end if;
  if v_a.season_id <> v_b.season_id then
    raise exception 'Picks are from different seasons';
  end if;
  if v_a.is_used or v_b.is_used then
    raise exception 'Cannot trade used picks';
  end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if v_a.team_id <> v_my_team and not public.is_admin() then
    raise exception 'You do not own the first pick';
  end if;
  if v_b.team_id = v_my_team and not public.is_admin() then
    raise exception 'Both picks belong to you';
  end if;

  update public.draft_picks set team_id = v_b.team_id where id = v_a.id;
  update public.draft_picks set team_id = v_a.team_id where id = v_b.id;
end;
$$;

grant execute on function public.trade_pick(uuid, uuid) to authenticated;
grant execute on function public.swap_picks(uuid, uuid) to authenticated;
