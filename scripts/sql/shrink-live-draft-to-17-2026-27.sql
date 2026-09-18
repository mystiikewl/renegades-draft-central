-- 2026-09-19: ESPN uses 17-player rosters, but the live 2026-27 draft was
-- started with roster_size = 18. Remove only the unused ninth post-keeper
-- round while preserving every completed pick and roster row.
--
-- Rejected/cancelled round-9 trade assets intentionally remain as historical
-- snapshots. The trade ledger dropped its draft-pick FK for this lifecycle
-- case in 20260826102000_trade_ledger_history.sql.

begin;

do $$
declare
  v_season_id uuid;
  v_settings public.draft_settings;
  v_removed int;
begin
  if (select count(*) from public.seasons where label = '2026-27') <> 1 then
    raise exception 'precondition failed: expected exactly one 2026-27 season';
  end if;

  select id into v_season_id
  from public.seasons
  where label = '2026-27';

  if not exists (
    select 1
    from public.seasons
    where id = v_season_id
      and is_active
      and status = 'live'
  ) then
    raise exception 'precondition failed: 2026-27 is not the active live season';
  end if;

  select * into v_settings
  from public.draft_settings
  where season_id = v_season_id
  for update;

  if v_settings.id is null
     or v_settings.status <> 'running'
     or v_settings.league_size <> 10
     or v_settings.roster_size <> 18
     or v_settings.keeper_limit <> 9 then
    raise exception 'precondition failed: expected running 10-team settings with roster 18 / keepers 9';
  end if;

  if (select count(*) from public.draft_picks where season_id = v_season_id) <> 90
     or (select count(*) from public.draft_picks where season_id = v_season_id and round <= 8 and pick_number <= 80) <> 80
     or (select count(*) from public.draft_picks where season_id = v_season_id and round = 9 and pick_number between 81 and 90) <> 10 then
    raise exception 'precondition failed: expected an intact 90-pick, 9-round grid';
  end if;

  if exists (
    select 1
    from public.draft_picks
    where season_id = v_season_id
      and (round > 8 or pick_number > 80)
      and (is_used or player_id is not null)
  ) then
    raise exception 'precondition failed: a pick in the round being removed has been used';
  end if;

  if exists (
    select 1
    from public.rosters
    where season_id = v_season_id
    group by team_id
    having count(*) > 17
  ) then
    raise exception 'precondition failed: at least one team already has more than 17 players';
  end if;

  if exists (
    select 1
    from public.trade_assets asset
    join public.trades trade on trade.id = asset.trade_id
    join public.draft_picks pick on pick.id = asset.draft_pick_id
    where pick.season_id = v_season_id
      and (pick.round > 8 or pick.pick_number > 80)
      and trade.status in ('proposed', 'accepted')
  ) then
    raise exception 'precondition failed: an active trade references a pick in the round being removed';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trade_assets'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%draft_pick_id%'
  ) then
    raise exception 'precondition failed: trade_assets still has a draft-pick FK';
  end if;

  delete from public.draft_picks
  where season_id = v_season_id
    and (round > 8 or pick_number > 80);
  get diagnostics v_removed = row_count;

  if v_removed <> 10 then
    raise exception 'precondition failed: expected to remove 10 picks, removed %', v_removed;
  end if;

  update public.draft_settings
  set roster_size = 17,
      updated_at = now()
  where season_id = v_season_id;

  perform public.append_admin_log('shrink_live_draft', jsonb_build_object(
    'season_id', v_season_id,
    'previous_roster_size', 18,
    'roster_size', 17,
    'removed_round', 9,
    'removed_picks', v_removed
  ));
end;
$$;

commit;

select
  season.label,
  season.status as season_status,
  settings.status as draft_status,
  settings.roster_size,
  settings.keeper_limit,
  count(pick.id)::int as picks,
  count(pick.id) filter (where pick.is_used)::int as used,
  min(pick.pick_number) filter (where not pick.is_used)::int as next_pick,
  max(pick.round)::int as max_round
from public.seasons season
join public.draft_settings settings on settings.season_id = season.id
join public.draft_picks pick on pick.season_id = season.id
where season.label = '2026-27'
group by season.label, season.status, settings.status,
  settings.roster_size, settings.keeper_limit;
