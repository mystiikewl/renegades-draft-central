-- Hard-delete the throwaway E2E-SIM season (FK order: picks/rosters ->
-- draft_settings -> seasons) and restore 2026-27 as the active season.
-- Run standalone: set -a && source .env && set +a &&
--   node scripts/db-query.mjs scripts/sql/e2e-sim-cleanup.sql
delete from public.draft_picks where season_id in (select id from public.seasons where label = 'E2E-SIM');
delete from public.rosters where season_id in (select id from public.seasons where label = 'E2E-SIM');
delete from public.draft_settings where season_id in (select id from public.seasons where label = 'E2E-SIM');
delete from public.seasons where label = 'E2E-SIM';
update public.seasons set is_active = (label = '2026-27');
select label, status, is_active from public.seasons order by label;
