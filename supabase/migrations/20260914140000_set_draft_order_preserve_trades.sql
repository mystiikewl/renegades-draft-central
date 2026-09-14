-- Draft-order changes preserve accepted pick trades (draft-night fix).
--
-- set_draft_order used to wipe the grid and refuse to run at all once a traded
-- pick had changed hands ('Cannot regenerate draft order while traded picks
-- have changed ownership'). Two problems with that:
--
--   1. The draft order became immutable the moment the commissioner logged an
--      official pick trade, even though a trade is really "<seller>'s round-R
--      pick goes to <buyer>" and should follow the seller's slot when the
--      order changes.
--   2. It generated roster_size rounds, not roster_size - keeper_limit (the
--      rule finalize_keepers and src/lib/practiceDraft.ts both use), so with
--      keepers finalized a regeneration would have handed the board 18 rounds
--      instead of 9.
--
-- Now the grid is upserted by (season_id, pick_number) - not deleted and
-- regenerated - because trade_assets.draft_pick_id is ON DELETE RESTRICT and
-- NOT NULL for pick assets: stable pick ids are what keep trade history valid
-- across a reorder. Row ids therefore survive, and each accepted pick trade is
-- re-applied against the new order: the seller's round-R slot pick becomes the
-- buyer's, and the asset is re-pointed at it.
--
-- Side effect worth knowing: this re-derives ownership from each trade's
-- declared seller, so pick links that drifted (assets rescued by hand onto the
-- wrong numbered pick) land back on the seller's pick in that round.
--
-- ponytail: trades that chain the same pick (A->B, then B->C) re-apply in
-- asset order and resolve against the grid as it stands, so the second hop
-- lands on the second seller's own slot pick rather than the pick the first
-- hop moved. Single-hop trades are the only ones this league has ever logged.

create or replace function public.apply_pick_trade_overrides(p_season_id uuid)
returns int
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_intent record;
  v_pick uuid;
  v_applied int := 0;
begin
  for v_intent in
    select a.id as asset_id, a.from_team_id, a.to_team_id, p.round, p.id as pick_id
    from public.trade_assets a
    join public.trades t on t.id = a.trade_id
    join public.draft_picks p on p.id = a.draft_pick_id
    where t.season_id = p_season_id
      and t.status = 'accepted'
      and a.asset_type = 'pick'
    order by a.id
  loop
    -- The pick the selling team makes in that round, on the grid as it now
    -- stands (linear and snake both assign the seller its own slot's pick).
    select p.id into v_pick
    from public.draft_picks p
    where p.season_id = p_season_id
      and p.round = v_intent.round
      and p.team_id = v_intent.from_team_id
    limit 1;

    if v_pick is null then
      raise exception 'Cannot re-apply pick trade %: no round % pick for the sending team',
        v_intent.asset_id, v_intent.round;
    end if;

    update public.draft_picks set team_id = v_intent.to_team_id where id = v_pick;

    -- Keep the asset pointing at the pick the trade actually moved.
    if v_pick <> v_intent.pick_id then
      update public.trade_assets set draft_pick_id = v_pick where id = v_intent.asset_id;
    end if;

    v_applied := v_applied + 1;
  end loop;

  return v_applied;
end;
$$;

revoke all on function public.apply_pick_trade_overrides(uuid) from public, anon, authenticated;

create or replace function public.set_draft_order(p_season_id uuid, p_order uuid[])
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings public.draft_settings;
  v_rounds int;
  v_round int;
  v_slot int;
  v_pick int;
  v_team uuid;
  v_applied int;
  v_blocked int;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;

  select * into v_settings from public.draft_settings where season_id = p_season_id for update;
  if v_settings.id is null then raise exception 'Season has no draft settings'; end if;
  if exists (select 1 from public.draft_picks where season_id = p_season_id and is_used) then
    raise exception 'Cannot change order after the draft has started';
  end if;
  if exists (
    select 1
    from public.trades t
    join public.trade_assets a on a.trade_id = t.id
    where t.season_id = p_season_id and t.status = 'proposed' and a.asset_type = 'pick'
  ) then
    raise exception 'Resolve or cancel pending pick trades before changing draft order';
  end if;
  if array_length(p_order, 1) is null or array_length(p_order, 1) <> v_settings.league_size then
    raise exception 'Order must contain exactly % team ids', v_settings.league_size;
  end if;
  if (select count(distinct x.id) from unnest(p_order) as x(id)) <> v_settings.league_size then
    raise exception 'Draft order must contain each team exactly once';
  end if;

  v_rounds := v_settings.roster_size - coalesce(v_settings.keeper_limit, 0);
  if v_rounds < 1 then
    raise exception 'Draft settings leave no rounds to draft (roster_size % - keeper_limit %)',
      v_settings.roster_size, coalesce(v_settings.keeper_limit, 0);
  end if;

  -- Rows outside the new shape have to go, but a pick an accepted trade
  -- depends on can never be deleted (FK is RESTRICT). Say so instead of
  -- letting a foreign-key error surface.
  select count(*) into v_blocked
  from public.draft_picks p
  join public.trade_assets a on a.draft_pick_id = p.id
  where p.season_id = p_season_id
    and (p.round > v_rounds or p.pick_number > v_rounds * v_settings.league_size);
  if v_blocked > 0 then
    raise exception 'Cannot reshape the board: % pick(s) referenced by trades fall outside the new grid', v_blocked;
  end if;

  update public.draft_settings
  set draft_order = p_order, updated_at = now()
  where season_id = p_season_id;

  delete from public.draft_picks
  where season_id = p_season_id
    and (round > v_rounds or pick_number > v_rounds * v_settings.league_size);

  -- Upsert, so existing rows keep their ids and any trade pointing at them
  -- stays valid. Everything is reset to slot ownership first; accepted pick
  -- trades are re-applied below.
  for v_round in 1..v_rounds loop
    for v_slot in 1..v_settings.league_size loop
      v_pick := (v_round - 1) * v_settings.league_size + v_slot;
      if v_settings.draft_type = 'snake' and v_round % 2 = 0 then
        v_team := p_order[v_settings.league_size - v_slot + 1];
      else
        v_team := p_order[v_slot];
      end if;
      insert into public.draft_picks (season_id, round, pick_number, team_id, original_team_id)
      values (p_season_id, v_round, v_pick, v_team, v_team)
      on conflict (season_id, pick_number) do update
        set round = excluded.round,
            team_id = excluded.team_id,
            original_team_id = excluded.original_team_id;
    end loop;
  end loop;

  v_applied := public.apply_pick_trade_overrides(p_season_id);

  perform public.append_admin_log('set_draft_order', jsonb_build_object(
    'season_id', p_season_id,
    'rounds', v_rounds,
    'draft_type', v_settings.draft_type,
    'order', to_jsonb(p_order),
    'trades_reapplied', v_applied));
end;
$$;

-- revert_finalize_keepers no longer clears the grid.
--
-- It used to delete every unused pick ("so the board can't run on a stale
-- grid"), which crashed on the RESTRICT foreign key the moment a pick trade
-- existed and would have dropped traded ownership silently if it hadn't. The
-- grid shape is owned by set_draft_order and finalize_keepers (both of which
-- now build roster_size - keeper_limit rounds), so a revert has nothing to
-- fix: leaving the rows keeps pick ids - and trade links - stable, and the
-- next finalize re-runs over the top of them.
create or replace function public.revert_finalize_keepers(p_season_id uuid)
returns int
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_settings record;
  v_restored int;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_settings from public.draft_settings where season_id = p_season_id;
  if v_settings.id is null then
    raise exception 'Season not found';
  end if;
  if v_settings.keepers_finalized_at is null then
    raise exception 'Keepers are not finalized';
  end if;
  if v_settings.status <> 'pre_draft' then
    raise exception 'Cannot revert once the draft has started - reset the draft first';
  end if;
  if exists (
    select 1 from public.draft_picks
    where season_id = p_season_id and player_id is not null
  ) then
    raise exception 'Cannot revert once picks have been made - reset the draft first';
  end if;

  -- Never clobber current rows (keeper tags made since finalize win).
  insert into public.rosters (season_id, team_id, player_id, acquisition, draft_pick_id)
  select d.season_id, d.team_id, d.player_id, d.acquisition, d.draft_pick_id
  from public.rosters_dropped d
  where d.season_id = p_season_id
  on conflict (season_id, player_id) do nothing;
  get diagnostics v_restored = row_count;

  delete from public.rosters_dropped where season_id = p_season_id;

  update public.draft_settings
  set keepers_finalized_at = null, updated_at = now()
  where season_id = p_season_id;

  perform public.append_admin_log('revert_finalize_keepers', jsonb_build_object(
    'season_id', p_season_id, 'restored', v_restored));

  return v_restored;
end;
$$;
