-- Cleanup: remove ESPN import-test residue from the 2026-27 season.
--
-- During roster-import testing, 57 players were inserted into the ACTIVE
-- 2026-27 season with acquisition='trade' across all 10 teams (e.g. F Dem
-- Kids: Clowney, KPJ, Watson, GG Jackson). These are not real keepers or
-- trades — they blocked ~57 players from the draft pool.
--
-- Guarded: only deletes when the target season exists, is labelled 2026-27,
-- AND is still active — otherwise this is a no-op. The archived 2025-26
-- season (170 rows) is never touched.
--
-- Run: node scripts/db-query.mjs scripts/sql/clear-trade-rosters-2026-27.sql
-- (as of 2026-08-25: deletes 57 rows)

delete from public.rosters
where acquisition = 'trade'
  and season_id = 'b98a48b3-45ef-4b19-91fe-00c689e74950'
  and (
    select count(*)
    from public.seasons
    where id = 'b98a48b3-45ef-4b19-91fe-00c689e74950'
      and label = '2026-27'
      and is_active
  ) = 1;
