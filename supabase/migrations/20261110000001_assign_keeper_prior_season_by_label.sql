-- assign_keeper: resolve the prior season by label (year-1) instead of
-- "most recent inactive season". Prevents eligibility checks pointing at the
-- wrong (empty) season if two rollovers happen without keeper selection.
-- Also keeps the keepers_finalized_at lock from safe_season_start.

create or replace function public.assign_keeper(p_season_id uuid, p_team_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings record;
  v_my_team uuid;
  v_count int;
  v_current uuid;
  v_prior uuid;
begin
  select * into v_settings from public.draft_settings where season_id = p_season_id;
  if v_settings.id is null then
    raise exception 'Season not found';
  end if;
  if v_settings.status <> 'pre_draft' then
    raise exception 'Keepers locked once the draft starts';
  end if;
  if v_settings.keepers_finalized_at is not null then
    raise exception 'Keepers are finalized; unfinalize to make changes';
  end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if p_team_id <> v_my_team and not public.is_admin() then
    raise exception 'You can only set keepers for your own team';
  end if;

  select team_id into v_current from public.rosters
    where season_id = p_season_id and player_id = p_player_id;
  if v_current is not null then
    if v_current <> p_team_id and not public.is_admin() then
      raise exception 'Player is on another team''s roster';
    end if;
  else
    -- dynasty eligibility: must have finished the immediately preceding
    -- season on p_team_id's roster (resolved by season label, not by
    -- "most recent inactive", so a stale/empty prior season can't be picked).
    select prior.id into v_prior
    from public.seasons cur
    join public.seasons prior
      on left(prior.label, 4)::int = left(cur.label, 4)::int - 1
    where cur.id = p_season_id
    limit 1;

    if v_prior is null or not exists (
      select 1 from public.rosters
      where season_id = v_prior
        and team_id = p_team_id
        and player_id = p_player_id
    ) then
      raise exception 'Player was not on this team''s roster last season — cannot keep';
    end if;
  end if;

  select count(*) into v_count from public.rosters
    where season_id = p_season_id and team_id = p_team_id and acquisition = 'keeper';
  if v_count >= v_settings.keeper_limit then
    raise exception 'Keeper limit (%) reached', v_settings.keeper_limit;
  end if;

  if v_current is not null then
    update public.rosters
    set acquisition = 'keeper'
    where season_id = p_season_id and player_id = p_player_id;
  else
    insert into public.rosters (season_id, team_id, player_id, acquisition)
    values (p_season_id, p_team_id, p_player_id, 'keeper');
  end if;
end;
$$;