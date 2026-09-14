-- Live 2026-27 board: every accepted pick trade must sit on the pick its
-- declared seller holds in that round, and nothing else may carry an override.
--
-- Run after saving a new draft order (Admin -> Draft order):
--   node --env-file=.env scripts/db-query.mjs scripts/sql/verify-2026-27-pick-overrides.sql --show
--
-- Healthy board: accepted_pick_trades = picks_carrying_overrides,
-- and both trades_on_wrong_slot / trades_not_applied are 0.

with season as (
  select id from public.seasons where label = '2026-27'
),
traded as (
  select a.from_team_id, a.to_team_id, p.round, p.pick_number, p.team_id, p.original_team_id
  from public.trade_assets a
  join public.trades t on t.id = a.trade_id
  join public.draft_picks p on p.id = a.draft_pick_id
  where t.season_id = (select id from season)
    and t.status = 'accepted'
    and a.asset_type = 'pick'
)
select
  (select count(*) from traded) as accepted_pick_trades,
  (select count(*) from public.draft_picks
    where season_id = (select id from season) and team_id <> original_team_id) as picks_carrying_overrides,
  (select count(*) from traded where original_team_id <> from_team_id) as trades_on_wrong_slot,
  (select count(*) from traded where team_id <> to_team_id) as trades_not_applied;
