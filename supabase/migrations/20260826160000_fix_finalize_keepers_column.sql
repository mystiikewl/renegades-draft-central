-- Fix: finalize_keepers() inserted into draft_picks.current_team_id, a column
-- that does not exist (the table uses team_id + original_team_id). PL/pgSQL
-- doesn't validate column names at CREATE time, so the bad body shipped and
-- blew up at runtime. Re-create the function with the correct column.

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

  update public.draft_settings
  set keepers_finalized_at = now(), updated_at = now()
  where season_id = p_season_id;

  return v_dropped;
end;
$$;
