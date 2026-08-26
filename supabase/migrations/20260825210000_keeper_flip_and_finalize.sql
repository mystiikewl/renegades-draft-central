-- Keeper flow for ESPN-mirrored rosters: rosters are pre-populated from the
-- live ESPN league, so "assign keeper" flips the existing row's acquisition
-- instead of inserting a new one. Adds finalize_keepers to drop non-keepers
-- and generate empty snake-draft pick slots.

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
begin
  select * into v_settings from public.draft_settings where season_id = p_season_id;
  if v_settings.id is null then
    raise exception 'Season not found';
  end if;
  if v_settings.status <> 'pre_draft' then
    raise exception 'Keepers locked once the draft starts';
  end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if p_team_id <> v_my_team and not public.is_admin() then
    raise exception 'You can only set keepers for your own team';
  end if;

  -- must be on this team's mirrored roster
  select team_id into v_current from public.rosters
    where season_id = p_season_id and player_id = p_player_id;
  if v_current is null then
    raise exception 'Player is not on any roster this season — cannot keep';
  end if;
  if v_current <> p_team_id and not public.is_admin() then
    raise exception 'Player is on another team''s roster';
  end if;

  select count(*) into v_count from public.rosters
    where season_id = p_season_id and team_id = p_team_id and acquisition = 'keeper';
  if v_count >= v_settings.keeper_limit then
    raise exception 'Keeper limit (%) reached', v_settings.keeper_limit;
  end if;

  -- flip the existing row (idempotent)
  update public.rosters
  set acquisition = 'keeper'
  where season_id = p_season_id and player_id = p_player_id;
end;
$$;

create or replace function public.remove_keeper(p_season_id uuid, p_team_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_my_team uuid;
begin
  select team_id into v_my_team from public.profiles where id = auth.uid();
  if p_team_id <> v_my_team and not public.is_admin() then
    raise exception 'You can only manage keepers for your own team';
  end if;

  update public.rosters
  set acquisition = 'trade' -- back to ordinary rostered status; dropped at finalize
  where season_id = p_season_id
    and team_id = p_team_id
    and player_id = p_player_id
    and acquisition = 'keeper';
end;
$$;

-- Finalize: drop every non-keeper from the season's rosters, then create the
-- empty pick slots for the snake draft. Idempotent (re-run repairs picks).
create or replace function public.finalize_keepers(p_season_id uuid)
returns int
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings record;
  v_rounds int;
  v_total int;
  v_dropped int;
begin
  select * into v_settings from public.draft_settings where season_id = p_season_id;
  if v_settings.id is null then
    raise exception 'Season not found';
  end if;
  if v_settings.status <> 'pre_draft' then
    raise exception 'Already finalized';
  end if;
  if array_length(v_settings.draft_order, 1) is null then
    raise exception 'Set draft order first';
  end if;

  delete from public.rosters
  where season_id = p_season_id and acquisition <> 'keeper';
  get diagnostics v_dropped = row_count;

  v_rounds := v_settings.roster_size - coalesce(v_settings.keeper_limit, 0);
  v_total := v_rounds * v_settings.league_size;

  insert into public.draft_picks (season_id, round, pick_number, original_team_id, team_id)
  select p_season_id,
         r,
         (r - 1) * v_settings.league_size + slot,
         t.team_id,
         case when r % 2 = 1
              then t.team_id
              else (v_settings.draft_order)[v_settings.league_size + 1 - slot]
         end
  from generate_series(1, v_rounds) r
  cross join generate_series(1, v_settings.league_size) slot
  cross join lateral (
    select (v_settings.draft_order)[slot] as team_id
  ) t
  on conflict (season_id, pick_number) do nothing;

  return v_dropped;
end;
$$;

grant execute on function public.assign_keeper(uuid, uuid, uuid) to authenticated;
grant execute on function public.remove_keeper(uuid, uuid, uuid) to authenticated;
grant execute on function public.finalize_keepers(uuid) to authenticated;
