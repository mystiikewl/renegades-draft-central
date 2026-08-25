-- Reactivate 2026-27 (found inactive during Phase 5 precondition check;
-- app queries the single is_active season and found none).
update public.seasons set is_active = (label = '2026-27');
select label, status, is_active from seasons order by label;
