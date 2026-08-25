-- reset_draft: only clear roster rows created by this season's draft picks.
--
-- The ESPN keeper sync mirrors last season's ESPN rosters into the current
-- season; ESPN tags most of those acquisitions DRAFT, which import-league.mjs
-- maps to acquisition='draft' with draft_pick_id = null. The old
-- where-clause (acquisition = 'draft') deleted those mirror rows on reset,
-- dumping already-rostered 2025-26 players back into the draft pool.
-- make_pick() is the only writer that sets draft_pick_id, so requiring it
-- restricts the delete to rows the draft itself created.
create or replace function public.reset_draft(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  delete from public.rosters
  where season_id = p_season_id
    and acquisition = 'draft'
    and draft_pick_id is not null;

  update public.draft_picks
    set player_id = null, is_used = false, picked_at = null, team_id = original_team_id
    where season_id = p_season_id;

  update public.draft_settings
    set status = 'pre_draft', updated_at = now()
    where season_id = p_season_id;
end;
$$;
