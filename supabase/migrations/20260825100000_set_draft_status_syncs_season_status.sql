-- Fix: make_pick requires seasons.status = 'live', but set_draft_status only
-- updated draft_settings.status — no code path ever set a season 'live', so
-- every real draft would fail on pick #1 with "Season is not live".
-- set_draft_status now syncs the season status: running → live,
-- pre_draft → pre_draft (e.g. after reset_draft); paused/complete leave the
-- season status untouched (a paused draft is still a live season).
create or replace function public.set_draft_status(p_season_id uuid, p_status draft_status)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_status = 'running' and not exists (
    select 1 from public.draft_picks where season_id = p_season_id limit 1
  ) then
    raise exception 'Generate the draft order before starting';
  end if;
  update public.draft_settings
    set status = p_status, updated_at = now()
    where season_id = p_season_id;

  if p_status = 'running' then
    update public.seasons set status = 'live'
    where id = p_season_id and status <> 'complete';
  elsif p_status = 'pre_draft' then
    update public.seasons set status = 'pre_draft'
    where id = p_season_id and status not in ('archived', 'complete');
  end if;
end;
$$;
