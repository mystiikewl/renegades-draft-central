-- =====================================================================
-- Renegades Draft Central — 2026 rebuild, baseline schema
-- Seasons are first-class; rosters are the single source of drafted truth.
-- =====================================================================

create type season_status as enum ('archived', 'pre_draft', 'live', 'complete');
create type draft_status as enum ('pre_draft', 'paused', 'running', 'complete');
create type draft_type as enum ('snake', 'linear');
create type acquisition_type as enum ('draft', 'keeper', 'trade');

-- ---------------------------------------------------------------------
-- seasons — one row per league year ('2025-26', '2026-27', ...)
-- ---------------------------------------------------------------------
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  status season_status not null default 'pre_draft',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- teams — franchises, stable across seasons
-- ---------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  owner_profile_id uuid, -- fk added after profiles exists
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- profiles — one row per auth user, keyed directly by auth.uid()
-- (fixes the 2025 id/user_id confusion)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  team_id uuid references public.teams (id) on delete set null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (email)
);

alter table public.teams
  add constraint teams_owner_fkey
  foreign key (owner_profile_id) references public.profiles (id) on delete set null;

-- Auto-create profile on signup
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- players — static bio only, keyed on ESPN id for the import pipeline
-- ---------------------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  espn_id text unique,
  name text not null,
  position text,
  nba_team text,
  image_url text,
  created_at timestamptz not null default now()
);

create index players_name_idx on public.players using gin (to_tsvector('simple', name));

-- ---------------------------------------------------------------------
-- player_seasons — per-season stats; home of all numbers (JSONB so the
-- ESPN import can store whatever the feed provides without migrations)
-- ---------------------------------------------------------------------
create table public.player_seasons (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (player_id, season_id)
);

-- ---------------------------------------------------------------------
-- draft_settings — per-season draft configuration
-- ---------------------------------------------------------------------
create table public.draft_settings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null unique references public.seasons (id) on delete cascade,
  league_size int not null default 10,
  roster_size int not null default 8,
  keeper_limit int not null default 9,
  draft_type draft_type not null default 'snake',
  pick_time_limit_seconds int not null default 120,
  status draft_status not null default 'pre_draft',
  draft_order uuid[] not null default '{}', -- team ids, draft slot order
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- draft_picks — the board slots (who picks when); NOT the roster truth
-- ---------------------------------------------------------------------
create table public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  round int not null,
  pick_number int not null, -- overall pick number, 1-based
  team_id uuid not null references public.teams (id) on delete cascade,
  original_team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid references public.players (id) on delete set null,
  is_used boolean not null default false,
  picked_at timestamptz,
  unique (season_id, pick_number)
);

create index draft_picks_season_idx on public.draft_picks (season_id, pick_number);

-- ---------------------------------------------------------------------
-- rosters — THE source of truth for who is on which team, per season.
-- Kills the 2025 three-way split (players.is_drafted / draft_picks / keepers).
-- ---------------------------------------------------------------------
create table public.rosters (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  acquisition acquisition_type not null default 'draft',
  draft_pick_id uuid references public.draft_picks (id) on delete set null,
  acquired_at timestamptz not null default now(),
  unique (season_id, player_id) -- a player can be on exactly one roster per season
);

create index rosters_season_team_idx on public.rosters (season_id, team_id);

-- ---------------------------------------------------------------------
-- user_favourites — watchlist per user per season
-- ---------------------------------------------------------------------
create table public.user_favourites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, player_id, season_id)
);

-- ---------------------------------------------------------------------
-- Realtime: draft board + roster changes push to clients
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.draft_picks, public.rosters, public.players, public.teams, public.draft_settings;
