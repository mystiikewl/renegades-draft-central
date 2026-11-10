-- create_season: clone draft settings from the prior season instead of
-- inserting schema defaults. The defaults (roster_size 8, keeper_limit 9)
-- never matched this league's real config (17/9) and could let
-- keeper_limit exceed roster_size slip through. (Backlog P1 #2.)
--
-- Hardening only; behaviour of the existing guards is unchanged.

create or replace function public.create_season(p_label text)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_season_id uuid;
  v_year int;
  v_suffix int;
  v_active_draft_status text;
  v_twin text;
  v_prior_season_id uuid;
  v_prior record;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if p_label is null or p_label !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Season label "%" is not in YYYY-YY format (e.g. 2027-28) — scripts address seasons by exact label', p_label;
  end if;

  v_year := substring(p_label from 1 for 4)::int;
  v_suffix := substring(p_label from 6 for 2)::int;
  if v_year < 2020 or v_year > 2100 or (v_year % 100) + 1 <> v_suffix then
    raise exception 'Season label "%" does not roll over correctly — expected %-%', p_label, v_year, lpad(((v_year % 100) + 1)::text, 2, '0');
  end if;

  select label into v_twin from public.seasons where left(label, 4) = left(p_label, 4);
  if v_twin is not null then
    raise exception 'Season "%" already covers start year % — archive/repair it instead of creating a twin', v_twin, left(p_label, 4);
  end if;

  -- A still-undrafted active season means rollover is premature.
  select ds.status into v_active_draft_status
  from public.seasons s
  left join public.draft_settings ds on ds.season_id = s.id
  where s.is_active
  limit 1;
  if v_active_draft_status in ('pre_draft', 'running', 'paused') then
    raise exception 'The active season has not drafted yet (status: %) — finish or reset it before creating the next season', v_active_draft_status;
  end if;

  -- The season we are about to deactivate becomes the config source.
  select id into v_prior_season_id
  from public.seasons
  where is_active
  limit 1;

  update public.seasons set is_active = false where is_active;

  insert into public.seasons (label, is_active) values (p_label, true)
    returning id into v_season_id;

  -- Clone league config from the prior season when available; otherwise fall
  -- back to sane defaults (should only happen for the very first season).
  if v_prior_season_id is not null then
    select * into v_prior from public.draft_settings where season_id = v_prior_season_id;
  end if;

  insert into public.draft_settings (
    season_id, league_size, roster_size, keeper_limit, draft_type,
    pick_time_limit_seconds, status, draft_order, keepers_finalized_at
  ) values (
    v_season_id,
    coalesce(v_prior.league_size, 10),
    coalesce(v_prior.roster_size, 17),
    coalesce(v_prior.keeper_limit, 9),
    coalesce(v_prior.draft_type, 'linear'),
    coalesce(v_prior.pick_time_limit_seconds, 120),
    'pre_draft',
    '{}'::uuid[],
    null
  );

  perform public.append_admin_log('create_season', jsonb_build_object(
    'label', p_label, 'season_id', v_season_id,
    'cloned_from', v_prior_season_id));

  return v_season_id;
end;
$$;