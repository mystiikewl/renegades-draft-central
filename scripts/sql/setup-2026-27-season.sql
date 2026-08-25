-- Set up the real 2026-27 season: it existed but had no draft_settings row
-- (settings_total was 1, belonging to 2025-26). Defaults: 10 teams, 8 rounds,
-- snake, keepers per app config.
insert into public.draft_settings (season_id, league_size, roster_size, keeper_limit, draft_type, pick_time_limit_seconds)
select s.id, 10, 8, 9, 'snake', 120
from public.seasons s
where s.label = '2026-27'
on conflict (season_id) do nothing;

-- Shadow team for E2E/guest testing (never drafted by real users).
insert into public.teams (name)
values ('E2E Shadow Squad')
on conflict (name) do nothing;

select s.label, s.status, s.is_active, ds.league_size, ds.roster_size, ds.status as draft_status
from public.seasons s left join public.draft_settings ds on ds.season_id = s.id
order by s.label;
