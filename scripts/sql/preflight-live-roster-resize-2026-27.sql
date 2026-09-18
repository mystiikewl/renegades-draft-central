-- Read-only preflight for shrinking the live 2026-27 board from 18 roster
-- spots (9 post-keeper rounds) to 17 spots (8 post-keeper rounds).
with season as (
  select id, label, status, is_active
  from public.seasons
  where label = '2026-27'
), settings as (
  select status, league_size, roster_size, keeper_limit, draft_type
  from public.draft_settings
  where season_id = (select id from season)
), picks as (
  select
    count(*)::int as picks,
    count(*) filter (where is_used)::int as used,
    min(pick_number) filter (where not is_used)::int as next_pick,
    max(round)::int as max_round,
    count(*) filter (where round > 8)::int as tail_picks,
    count(*) filter (where round > 8 and is_used)::int as used_tail
  from public.draft_picks
  where season_id = (select id from season)
), trade_refs as (
  select
    count(*)::int as tail_trade_refs,
    coalesce(jsonb_agg(jsonb_build_object(
      'trade_id', trade.id,
      'status', trade.status,
      'pick_number', pick.pick_number,
      'round', pick.round,
      'asset_label', asset.asset_label,
      'from_team', from_team.name,
      'to_team', to_team.name
    ) order by trade.created_at), '[]'::jsonb) as tail_trade_details
  from public.trade_assets asset
  join public.draft_picks pick on pick.id = asset.draft_pick_id
  join public.trades trade on trade.id = asset.trade_id
  join public.teams from_team on from_team.id = asset.from_team_id
  join public.teams to_team on to_team.id = asset.to_team_id
  where pick.season_id = (select id from season)
    and pick.round > 8
), deployed_constraints as (
  select exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trade_assets'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%draft_pick_id%'
  ) as draft_pick_fk_exists
)
select
  season.label,
  season.status as season_status,
  season.is_active,
  settings.status as draft_status,
  settings.league_size,
  settings.roster_size,
  settings.keeper_limit,
  settings.draft_type,
  picks.*,
  trade_refs.tail_trade_refs,
  trade_refs.tail_trade_details,
  deployed_constraints.draft_pick_fk_exists
from season
cross join settings
cross join picks
cross join trade_refs
cross join deployed_constraints;
