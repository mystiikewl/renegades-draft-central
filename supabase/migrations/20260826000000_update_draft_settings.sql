-- Admin-editable draft configuration. RLS on draft_settings is select-only,
-- so edits go through this SECURITY DEFINER RPC like every other write.
create function public.update_draft_settings(
  p_season_id uuid,
  p_league_size int,
  p_roster_size int,
  p_keeper_limit int,
  p_draft_type public.draft_type,
  p_pick_time_limit_seconds int
)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if exists (
    select 1 from public.draft_settings
    where season_id = p_season_id and status <> 'pre_draft'
  ) then
    raise exception 'Settings are locked once the draft has started';
  end if;
  if p_league_size < 8 or p_league_size > 20 then
    raise exception 'League size must be between 8 and 20';
  end if;
  if p_roster_size < 8 or p_roster_size > 20 then
    raise exception 'Roster size must be between 8 and 20';
  end if;
  if p_keeper_limit > p_roster_size then
    raise exception 'Keeper limit cannot exceed roster size';
  end if;
  if p_pick_time_limit_seconds < 15 or p_pick_time_limit_seconds > 600 then
    raise exception 'Pick time limit must be between 15 and 600 seconds';
  end if;

  insert into public.draft_settings
    (season_id, league_size, roster_size, keeper_limit, draft_type, pick_time_limit_seconds)
  values
    (p_season_id, p_league_size, p_roster_size, p_keeper_limit, p_draft_type, p_pick_time_limit_seconds)
  on conflict (season_id) do update set
    league_size = excluded.league_size,
    roster_size = excluded.roster_size,
    keeper_limit = excluded.keeper_limit,
    draft_type = excluded.draft_type,
    pick_time_limit_seconds = excluded.pick_time_limit_seconds,
    updated_at = now();
end;
$$;
