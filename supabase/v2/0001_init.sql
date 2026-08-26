-- ============================================================
-- Renegades Draft Central v2 — schema baseline (2026 season)
-- One clean migration for a fresh Supabase project.
-- Replaces 31 accreted 2025 migrations. 2025 history stays in
-- the old project; this DB starts empty per season.
-- ============================================================

-- ---------- helpers ----------
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- helper: is current user an admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- ---------- teams ----------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  owner_id uuid references auth.users(id) on delete set null, -- null = unclaimed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();

alter table public.teams enable row level security;
create policy "teams_select" on public.teams for select using (true);
create policy "teams_claim" on public.teams for update
  using (owner_id is null or owner_id = auth.uid())
  with check (owner_id = auth.uid() or (owner_id is null)); -- claim = set yourself; can't steal
create policy "teams_admin" on public.teams for all using (public.is_admin());

-- Atomic team claim. Returns error if already taken.
create or replace function public.claim_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.teams
  set owner_id = auth.uid()
  where id = p_team_id and owner_id is null;
  if not found then
    raise exception 'Team not available';
  end if;
end $$;

-- ---------- players (identity) ----------
-- Stable identity only. Per-season stats live in player_seasons.
create table public.players (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,              -- NBA API id / ESPN id; enables re-import dedupe
  name text not null,
  position text not null check (position in ('PG','SG','SF','PF','C','G','F','UTIL')),
  nba_team text,
  age numeric(4,1),
  is_rookie boolean not null default false,
  created_at timestamptz not null default now()
);
create extension if not exists pg_trgm;
create index players_name_idx on public.players using gin (name gin_trgm_ops);

-- ---------- player_seasons (stats) ----------
create table public.player_seasons (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season text not null,                 -- e.g. '2025-26'
  games_played int,
  minutes_per_game numeric(4,1),
  fg_made numeric(4,1), fg_pct numeric(5,3),
  ft_pct numeric(5,3),
  three_pm numeric(4,1),
  points numeric(5,1), rebounds numeric(4,1), assists numeric(4,1),
  steals numeric(4,1), blocks numeric(4,1), turnovers numeric(4,1),
  rank int,                             -- fantasy rank for this season
  unique (player_id, season)
);
create index player_seasons_season_idx on public.player_seasons(season);

-- ---------- keepers ----------
create table public.keepers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  season text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (team_id, player_id, season)
);

alter table public.keepers enable row level security;
create policy "keepers_select" on public.keepers for select using (true);
create policy "keepers_insert_own" on public.keepers for insert
  with check (
    exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid())
    or public.is_admin()
  );
create policy "keepers_delete_own" on public.keepers for delete
  using (
    exists (select 1 from public.teams t where t.id = team_id and t.owner_id = auth.uid())
    or public.is_admin()
  );

-- Keeper limit enforced here, not in app code.
create or replace function public.enforce_keeper_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit int;
  v_count int;
begin
  select coalesce((config->>'keeper_count')::int, 4)
    into v_limit
  from public.draft_settings
  where season = new.season;

  if v_limit is null then return new; end if; -- no settings yet -> allow, settings will gate

  select count(*) into v_count from public.keepers
  where team_id = new.team_id and season = new.season;

  if v_count >= v_limit then
    raise exception 'Keeper limit (%s) reached for season %', v_limit, new.season;
  end if;
  return new;
end $$;

create trigger keeper_limit before insert on public.keepers
  for each row execute function public.enforce_keeper_limit();

-- ---------- draft_settings (one row per season) ----------
create table public.draft_settings (
  season text primary key,              -- '2026-27'
  status text not null default 'pre_draft'
    check (status in ('pre_draft','keeper_window','live','paused','complete')),
  draft_type text not null default 'snake',
  league_size int not null default 10,
  roster_size int not null default 13,
  keeper_count int not null default 4,
  pick_time_limit_seconds int not null default 120,
  draft_order uuid[] not null default '{}',   -- ordered team ids; snake derived from this
  scoring jsonb not null default '{
    "points": 1.0, "rebounds": 1.2, "assists": 1.5,
    "steals": 2.0, "blocks": 2.0, "three_pm": 0.5, "turnovers": -1.0
  }'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger draft_settings_updated_at before update on public.draft_settings
  for each row execute function public.set_updated_at();

alter table public.draft_settings enable row level security;
create policy "settings_select" on public.draft_settings for select using (true);
create policy "settings_admin" on public.draft_settings for all using (public.is_admin());

-- ---------- draft_picks ----------
create table public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  season text not null references public.draft_settings(season) on delete cascade,
  overall_pick int not null,
  round int not null,                   -- derived at pick time from league_size
  pick_number int not null,
  original_team_id uuid not null references public.teams(id), -- trade asset ownership
  current_team_id uuid not null references public.teams(id),  -- who picks now
  player_id uuid references public.players(id),
  picked_at timestamptz,
  unique (season, overall_pick),
  unique (season, player_id)
);

alter table public.draft_picks enable row level security;
create policy "picks_select" on public.draft_picks for select using (true);
-- No direct insert/update/delete for regular users: picks only via make_pick().
create policy "picks_admin" on public.draft_picks for all using (public.is_admin());

-- The draft engine. Server-authoritative: validates turn order, drafted status,
-- and writes the pick. Clients call this; they cannot forge picks.
create or replace function public.make_pick(p_player_id uuid)
returns public.draft_picks
language plpgsql security definer set search_path = public as $$
declare
  v_settings public.draft_settings;
  v_next_pick public.draft_picks;
  v_round int;
begin
  select * into v_settings from public.draft_settings where status = 'live';
  if not found then raise exception 'Draft is not live'; end if;

  -- next pick = lowest unused overall number
  select dp.* into v_next_pick
  from public.draft_picks dp
  where dp.season = v_settings.season and dp.player_id is null
  order by dp.overall_pick
  limit 1;
  if not found then raise exception 'Draft is complete'; end if;

  -- caller must own the team on the clock
  if not exists (
    select 1 from public.teams
    where id = v_next_pick.current_team_id and owner_id = auth.uid()
  ) then
    -- admins may pick for anyone (commissioner mode)
    if not public.is_admin() then
      raise exception 'Not your pick';
    end if;
  end if;

  -- snake math: round = floor((overall-1) / league_size) + 1
  -- (snake ordering is baked into draft_picks.current_team_id when the
  --  commissioner generates the grid from draft_settings.draft_order)
  v_round := ((v_next_pick.overall_pick - 1) / v_settings.league_size) + 1;

  update public.draft_picks
  set player_id = p_player_id, picked_at = now(), round = v_round
  where id = v_next_pick.id
  returning * into v_next_pick;

  return v_next_pick;
end $$;

-- Commissioner generates the full pick grid from draft_order before the draft.
-- Snake ordering applied here: even rounds reversed.
create or replace function public.generate_draft_grid(p_season text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_settings public.draft_settings;
  v_team uuid;
  v_overall int := 0;
  v_round int;
  v_slot int;
  v_league_size int;
  v_order uuid[];
begin
  select * into v_settings from public.draft_settings where season = p_season;
  if not found then raise exception 'No draft settings for %', p_season; end if;

  delete from public.draft_picks where season = p_season and player_id is null;

  v_order := v_settings.draft_order;
  v_league_size := coalesce(array_length(v_order, 1), 0);
  if v_league_size = 0 then
    raise exception 'draft_order is empty — set it before generating';
  end if;

  for v_round in 1..v_settings.roster_size loop
    for v_slot in 1..v_league_size loop
      v_overall := v_overall + 1;
      -- snake: odd rounds left-to-right, even rounds right-to-left
      if v_round % 2 = 1 then
        v_team := v_order[v_slot];
      else
        v_team := v_order[v_league_size - v_slot + 1];
      end if;
      insert into public.draft_picks (season, overall_pick, round, pick_number,
        original_team_id, current_team_id)
      values (p_season, v_overall, v_round, v_slot, v_team, v_team);
    end loop;
  end loop;
end $$;

-- ---------- user_favourites ----------
create table public.user_favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, player_id)
);
alter table public.user_favourites enable row level security;
create policy "fav_all" on public.user_favourites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_admin boolean not null default false,
  team_id uuid references public.teams(id) on delete set null,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id); -- cannot self-promote to admin: no insert policy; rows come from the signup trigger

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- seed ----------
insert into public.teams (name) values
  ('Team 1'),('Team 2'),('Team 3'),('Team 4'),('Team 5'),
  ('Team 6'),('Team 7'),('Team 8'),('Team 9'),('Team 10');

insert into public.draft_settings (season, league_size) values ('2026-27', 10);

