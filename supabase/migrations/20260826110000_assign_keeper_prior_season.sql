-- assign_keeper: dynasty eligibility from the PRIOR season's roster.
--
-- The keeper UI offers candidates from the previous season's rosters, but the
-- check required the player to already sit on the active season's ESPN mirror
-- (a smaller set — offseason moves drop players from it), so legitimate
-- dynasty keepers failed with 'Player is not on any roster this season'.
-- New rules:
--   * on the active roster for this team -> flip acquisition to 'keeper' (as before)
--   * on the active roster for another team -> still an error (unless admin)
--   * otherwise: must have finished last season on p_team_id's roster
--     (admin may keep for any team); inserts a fresh 'keeper' row.
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
      raise exception 'Player was not on this team''s roster last season — cannot keep';
    end if;
  end if;

  select count(*) into v_count from public.rosters
    where season_id = p_season_id and team_id = p_team_id and acquisition = 'keeper';
  if v_count >= v_settings.keeper_limit then
    raise exception 'Keeper limit (%) reached', v_settings.keeper_limit;
  end if;

  if v_current is not null then
    -- flip the existing row (idempotent)
    update public.rosters
    set acquisition = 'keeper'
    where season_id = p_season_id and player_id = p_player_id;
  else
    insert into public.rosters (season_id, team_id, player_id, acquisition)
    values (p_season_id, p_team_id, p_player_id, 'keeper');
  end if;
end;
$$;
