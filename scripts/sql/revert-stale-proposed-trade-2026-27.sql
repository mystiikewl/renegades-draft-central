-- 2026-09-14: revert a stale never-accepted trade proposal that leaked onto
-- the 2026-27 draft board.
--
-- Trace: trade 01952b98-3628-4f07-9678-94170c443c29 ("Solid", proposed
-- 2026-08-27 during trade-center dev testing) was never accepted, so it
-- should own no picks. remove-duplicate-26-27-season.sql step 3 applied
-- ownership from every asset referencing the real grid without filtering by
-- trade status, so its picks #6/#16/#26 showed F Dem Kids as trade owner.
-- This reverts those three picks to the saved draft-order owner (Mamba
-- Mentality) and cancels the proposal so it can never be accepted.

do $$
begin
  if not exists (
    select 1 from public.trades
    where id = '01952b98-3628-4f07-9678-94170c443c29' and status = 'proposed'
  ) then
    raise exception 'precondition failed: stale proposal not found in proposed state — aborting';
  end if;
  if exists (
    select 1 from public.draft_picks p
    where p.season_id = (select id from public.seasons where label = '2026-27')
      and p.pick_number in (6, 16, 26)
      and (p.player_id is not null or p.is_used)
  ) then
    raise exception 'precondition failed: picks 6/16/26 are not clean — aborting';
  end if;
end $$;

-- 1. Restore draft-order ownership on the three polluted picks.
update public.draft_picks p
set team_id = s.draft_order[((p.pick_number - 1) % s.league_size) + 1]
from public.draft_settings s
where s.season_id = (select id from public.seasons where label = '2026-27')
  and p.season_id = s.season_id
  and p.pick_number in (6, 16, 26);

-- 2. Cancel the stale proposal (dead player/pick refs make it unacceptable
--    in the app anyway; cancelling keeps it as inert history).
update public.trades
set status = 'cancelled', resolved_at = now()
where id = '01952b98-3628-4f07-9678-94170c443c29';

-- Verify: exactly the four rescued accepted trades deviate from draft order.
with s as (
  select ds.draft_order as ord, ds.league_size as n
  from public.draft_settings ds
  where ds.season_id = (select id from public.seasons where label = '2026-27')
)
select p.round, p.pick_number, t_owner.name as owner
from public.draft_picks p
join s on true
join public.teams t_owner on t_owner.id = p.team_id
where p.season_id = (select id from public.seasons where label = '2026-27')
  and p.team_id <> s.ord[((p.pick_number - 1) % s.n) + 1]
order by p.pick_number;
