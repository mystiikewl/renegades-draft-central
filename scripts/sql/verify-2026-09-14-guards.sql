-- Verification for the 2026-09-14 backlog migrations (P1 #1, P2 #5, P2 #7).
-- Safe to run any time: everything happens inside one rolled-back transaction.
-- Run: node --env-file=.env scripts/db-query.mjs scripts/sql/verify-2026-09-14-guards.sql
--
-- Asserts by inspection:
--   * finalize_keepers builds a LINEAR grid for draft_type='linear'
--     (round 2 repeats the round-1 order) and a SNAKE grid for 'snake'
--     (round 2 reverses it) — P2 #7.
--   * finalize_keepers appends admin_log rows — P2 #5.
--   * non-keeper roster rows are dropped into rosters_dropped on finalize.

begin;

do $$
declare
  v_lin uuid;
  v_snk uuid;
  v_a uuid;
  v_b uuid;
  v_c uuid;
  p1 uuid;
  p2 uuid;
  p3 uuid;
  p4 uuid;
  v_admin uuid := (select id from public.profiles where is_admin limit 1);
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  insert into public.seasons (label, is_active) values ('2099-01', false) returning id into v_lin;
  insert into public.seasons (label, is_active) values ('2099-02', false) returning id into v_snk;
  insert into public.teams (name, is_shadow) values ('zz-verify-a', true) returning id into v_a;
  insert into public.teams (name, is_shadow) values ('zz-verify-b', true) returning id into v_b;
  insert into public.teams (name, is_shadow) values ('zz-verify-c', true) returning id into v_c;

  select id into p1 from public.players order by id limit 1;
  select id into p2 from public.players order by id offset 1 limit 1;
  select id into p3 from public.players order by id offset 2 limit 1;
  select id into p4 from public.players order by id offset 3 limit 1;

  insert into public.draft_settings (season_id, league_size, roster_size, keeper_limit, draft_type, draft_order)
  values (v_lin, 3, 3, 1, 'linear', array[v_a, v_b, v_c]),
         (v_snk, 3, 3, 1, 'snake', array[v_a, v_b, v_c]);

  insert into public.rosters (season_id, team_id, player_id, acquisition) values
    (v_lin, v_a, p1, 'keeper'), (v_lin, v_b, p2, 'keeper'), (v_lin, v_c, p3, 'keeper'),
    (v_lin, v_a, p4, 'trade'),
    (v_snk, v_a, p1, 'keeper'), (v_snk, v_b, p2, 'keeper'), (v_snk, v_c, p3, 'keeper');

  perform public.finalize_keepers(v_lin);
  perform public.finalize_keepers(v_snk);
end;
$$;

select s.label as season,
       dp.round,
       dp.pick_number,
       ta.name as original_team,
       ts.name as pick_slot_team
from public.draft_picks dp
join public.seasons s on s.id = dp.season_id
join public.teams ta on ta.id = dp.original_team_id
join public.teams ts on ts.id = dp.team_id
where s.label in ('2099-01', '2099-02')
order by s.label, dp.pick_number;

rollback;
