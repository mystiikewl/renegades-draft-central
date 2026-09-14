-- Guard create_season against duplicate/near-duplicate labels (backlog P1 #1).
--
-- Root cause of the 2026-09-14 incident: a hand-typed label ("Season 26-27"
-- vs "2026-27") created a twin season that stole is_active, while every
-- script addresses seasons by exact label — the app went blind to the real
-- season's keepers/pool.
--
-- Guards, in order:
--   1. Label must match the machine-addressed YYYY-YY contract.
--   2. The YY suffix must be the year's actual rollover (2027 -> 28).
--   3. No other season may share the label (plus a unique index below).
--   4. No other season may share the start year (catches "2026-28" twins).
--   5. The active season must have finished drafting — creating the next
--      season mid-cycle is what steals is_active from a live board.

create unique index if not exists seasons_label_key on public.seasons (label);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'seasons_label_format'
  ) then
    alter table public.seasons
      add constraint seasons_label_format check (label ~ '^[0-9]{4}-[0-9]{2}$');
  end if;
end;
$$;

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

  -- A still-undrafted active season means rollover is premature: the new
  -- season would steal is_active and blind the app to the live board.
  select ds.status into v_active_draft_status
  from public.seasons s
  left join public.draft_settings ds on ds.season_id = s.id
  where s.is_active
  limit 1;
  if v_active_draft_status in ('pre_draft', 'running', 'paused') then
    raise exception 'The active season has not drafted yet (status: %) — finish or reset it before creating the next season', v_active_draft_status;
  end if;

  update public.seasons set is_active = false where is_active;

  insert into public.seasons (label, is_active) values (p_label, true)
    returning id into v_season_id;

  insert into public.draft_settings (season_id) values (v_season_id);

  perform public.append_admin_log('create_season', jsonb_build_object(
    'label', p_label, 'season_id', v_season_id));

  return v_season_id;
end;
$$;
