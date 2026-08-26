-- Safe season start: keepers in, everyone else back to the player pool.
--
-- Three guarantees:
--   1. finalize_keepers is commissioner-only, records when it ran
--      (draft_settings.keepers_finalized_at), drops every non-keeper roster
--      row back to the pool and generates the pick grid.
--   2. The keeper set freezes once finalized: assign/remove keeper refuse to
--      mutate it, and unfinalize_keepers() is the explicit way to reopen.
--   3. set_draft_status('running') refuses a fresh start while any roster row
--      with acquisition <> 'keeper' exists, so a stale ESPN sync can never
--      poison pick #1. Resume-from-pause is untouched.

alter table public.draft_settings
  add column if not exists keepers_finalized_at timestamptz;

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

  -- already on the active season's roster (ESPN mirror or previous pick)?
  select team_id into v_current from public.rosters
    where season_id = p_season_id and player_id = p_player_id;
  if v_current is not null then
    if v_current <> p_team_id and not public.is_admin() then
      raise exception 'Player is on another team''s roster';
    end if;
  else
    -- dynasty eligibility: must have been on this team's roster last season
    select s.id into v_prior
    from public.seasons s
    where s.is_active = false
    order by s.created_at desc
    limit 1;

    if v_prior is null or not exists (
      select 1 from public.rosters
      where season_id = v_prior
        and team_id = p_team_id
        and player_id = p_player_id
    ) then
      raise exception 'Player was not on this team''s roster last season - cannot keep';
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

create or replace function public.remove_keeper(p_season_id uuid, p_team_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings record;
  v_my_team uuid;
begin
  select keepers_finalized_at into v_settings
  from public.draft_settings where season_id = p_season_id;
  if v_settings.keepers_finalized_at is not null then
    raise exception 'Keepers are finalized; unfinalize to make changes';
  end if;

  select team_id into v_my_team from public.profiles where id = auth.uid();
  if p_team_id <> v_my_team and not public.is_admin() then
    raise exception 'You can only manage keepers for your own team';
  end if;

  update public.rosters
  set acquisition = 'trade'
  where season_id = p_season_id
    and team_id = p_team_id
    and player_id = p_player_id
    and acquisition = 'keeper';
end;
$$;

-- Commissioner action: drop every non-keeper from the season's rosters, then
-- create the empty pick slots for the snake draft. Idempotent (re-run repairs
-- picks) and records the moment the keeper set locked.
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
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

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

  insert into public.draft_picks (season_id, round, pick_number, original_team_id, current_team_id)
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

  update public.draft_settings
  set keepers_finalized_at = now(), updated_at = now()
  where season_id = p_season_id;

  return v_dropped;
end;
$$;

-- Reopen the keeper set: clears the lock so assign/remove/sync work again.
-- Does NOT restore dropped rosters; sync mirrors ESPN state and finalize
-- re-runs when the set is settled.
create or replace function public.unfinalize_keepers(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select status into v_status from public.draft_settings where season_id = p_season_id;
  if v_status is null then
    raise exception 'Season not found';
  end if;
  if v_status <> 'pre_draft' then
    raise exception 'Cannot unfinalize once the draft has started';
  end if;

  update public.draft_settings
  set keepers_finalized_at = null, updated_at = now()
  where season_id = p_season_id;
end;
$$;

revoke execute on function public.unfinalize_keepers(uuid) from public, anon;
grant execute on function public.unfinalize_keepers(uuid) to authenticated;

-- Fresh start invariant: pre_draft -> running requires a keeper-clean board.
create or replace function public.set_draft_status(p_season_id uuid, p_status public.draft_status)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings public.draft_settings;
  v_remaining int;
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

    if v_settings.status = 'paused' then
      v_remaining := greatest(coalesce(v_settings.paused_remaining_seconds, v_settings.pick_time_limit_seconds), 0);
      update public.draft_settings
      set status = 'running',
          turn_deadline_at = now() + make_interval(secs => v_remaining),
          paused_remaining_seconds = null,
          updated_at = now()
      where season_id = p_season_id;
    elsif v_settings.status <> 'running' then
      update public.draft_settings
      set status = 'running',
          turn_deadline_at = now() + make_interval(secs => v_settings.pick_time_limit_seconds),
          paused_remaining_seconds = null,
          updated_at = now()
      where season_id = p_season_id;
    end if;

    update public.seasons set status = 'live'
    where id = p_season_id and status <> 'complete';

  elsif p_status = 'paused' then
    if v_settings.status = 'running' then
      v_remaining := greatest(
        0,
        ceil(extract(epoch from (coalesce(v_settings.turn_deadline_at, now() + make_interval(secs => v_settings.pick_time_limit_seconds)) - now())))::int
      );
      update public.draft_settings
      set status = 'paused',
          turn_deadline_at = null,
          paused_remaining_seconds = v_remaining,
          updated_at = now()
      where season_id = p_season_id;
    elsif v_settings.status <> 'paused' then
      update public.draft_settings
      set status = 'paused',
          turn_deadline_at = null,
          paused_remaining_seconds = v_settings.pick_time_limit_seconds,
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
end;
$$;
