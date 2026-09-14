-- 2026-09-14: remove the accidental duplicate season "Season 26-27" and
-- re-point the app at the real 2026-27 season.
--
-- Background: the twin row was created via the admin UI at 2026-09-14 05:17Z
-- with a hand-typed label and stole seasons.is_active (create_season
-- deactivates the previous active row). The ESPN keeper sync and finalize
-- address seasons by label '2026-27', so they landed on the real row — but
-- the app reads is_active and showed an empty keeper/pool universe.
-- The twin carries 4 backfilled offseason trades whose pick assets point at
-- the twin's throwaway 170-pick grid; the ownership changes they record were
-- never applied to the real 90-pick grid. This script rescues the trades,
-- applies the pick ownership, and deletes the twin.

do $$
declare
  v_twin uuid;
  v_real uuid;
begin
  select id into v_twin from public.seasons where label = 'Season 26-27';
  select id into v_real from public.seasons where label = '2026-27';
  if v_twin is null or v_real is null then
    raise exception 'precondition failed: both season rows must exist (twin=%, real=%)', v_twin, v_real;
  end if;

  -- The twin must be empty of everything except the trades being rescued.
  if exists (select 1 from public.rosters where season_id = v_twin)
     or exists (select 1 from public.rosters_dropped where season_id = v_twin)
     or exists (select 1 from public.player_seasons where season_id = v_twin)
     or exists (select 1 from public.projections where season_id = v_twin)
     or exists (select 1 from public.user_favourites where season_id = v_twin) then
    raise exception 'twin season is not empty — aborting';
  end if;
  if exists (select 1 from public.draft_picks where season_id = v_twin and (player_id is not null or is_used)) then
    raise exception 'twin grid has used picks — aborting';
  end if;
  if exists (select 1 from public.draft_picks where season_id = v_real and (player_id is not null or is_used)) then
    raise exception 'real grid has used picks — aborting';
  end if;
  if (select keepers_finalized_at from public.draft_settings where season_id = v_real) is null then
    raise exception 'real season is not finalized — aborting';
  end if;
  if (select count(*) from public.trades where season_id = v_twin) <> 4 then
    raise exception 'expected exactly 4 trades on the twin — aborting';
  end if;
end $$;

-- 1. Re-point each rescued pick asset at the same-numbered pick on the real
--    grid (pick_number is unique per season; all four land inside rounds 1-9).
update public.trade_assets a
set draft_pick_id = mapped.real_pick_id
from (
  select a2.id as asset_id, real_pick.id as real_pick_id
  from public.trade_assets a2
  join public.trades t on t.id = a2.trade_id
  join public.draft_picks twin_pick on twin_pick.id = a2.draft_pick_id
  join public.draft_picks real_pick
    on real_pick.season_id = (select id from public.seasons where label = '2026-27')
   and real_pick.pick_number = twin_pick.pick_number
  where t.season_id = (select id from public.seasons where label = 'Season 26-27')
) mapped
where a.id = mapped.asset_id;

-- 2. Move the trades to the real season.
update public.trades
set season_id = (select id from public.seasons where label = '2026-27')
where season_id = (select id from public.seasons where label = 'Season 26-27');

-- 3. Apply the recorded pick ownership to the real grid (accept_trade
--    semantics: team_id carries the trade, original_team_id keeps the
--    draft-order owner).
update public.draft_picks p
set team_id = a.to_team_id
from public.trade_assets a
where a.draft_pick_id = p.id
  and p.season_id = (select id from public.seasons where label = '2026-27');

-- 4. Activate the real season (app reads is_active).
update public.seasons
set is_active = (label = '2026-27');

-- 5. Delete the twin: its grid and settings go with it; the trades have
--    already moved and no asset references the twin's picks anymore.
delete from public.draft_picks where season_id = (select id from public.seasons where label = 'Season 26-27');
delete from public.draft_settings where season_id = (select id from public.seasons where label = 'Season 26-27');
delete from public.seasons where label = 'Season 26-27';

-- Verify.
select s.label, s.is_active, ds.draft_type, ds.keepers_finalized_at,
       (select count(*) from public.rosters r where r.season_id = s.id and r.acquisition = 'keeper') as keepers,
       (select count(*) from public.draft_picks p where p.season_id = s.id) as picks,
       (select count(*) from public.draft_picks p where p.season_id = s.id and p.team_id <> p.original_team_id) as traded_picks,
       (select count(*) from public.trades t where t.season_id = s.id) as trades
from public.seasons s
left join public.draft_settings ds on ds.season_id = s.id
order by s.label;
