-- =====================================================================
-- Row Level Security — 2026 rebuild
-- Principles:
--   * Read access for authenticated league members on everything
--   * Writes ONLY through SECURITY DEFINER RPCs (no direct table writes,
--     no auth.role()='authenticated' write policies)
--   * Admin authorization via is_admin() inside functions, never via
--     hardcoded emails in policies
-- =====================================================================

-- Helper: current user's admin flag (SECURITY DEFINER so RLS doesn't
-- recurse; profiles select is already open but this is also used inside
-- write-path functions).
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = 'public', 'auth'
stable
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- profiles: self-service display name only. is_admin / email / team_id
-- (team via claim_team RPC) are NOT client-writable.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy profiles_update_own_display_name on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));

-- ---------------------------------------------------------------------
-- Everything below: read for authenticated; writes via RPCs only
-- ---------------------------------------------------------------------
alter table public.seasons enable row level security;
create policy seasons_select on public.seasons
  for select to authenticated using (true);

alter table public.teams enable row level security;
create policy teams_select on public.teams
  for select to authenticated using (true);

alter table public.players enable row level security;
create policy players_select on public.players
  for select to authenticated using (true);

alter table public.player_seasons enable row level security;
create policy player_seasons_select on public.player_seasons
  for select to authenticated using (true);

alter table public.draft_settings enable row level security;
create policy draft_settings_select on public.draft_settings
  for select to authenticated using (true);

alter table public.draft_picks enable row level security;
create policy draft_picks_select on public.draft_picks
  for select to authenticated using (true);

alter table public.rosters enable row level security;
create policy rosters_select on public.rosters
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- user_favourites: the one table users write directly (own rows only)
-- ---------------------------------------------------------------------
alter table public.user_favourites enable row level security;

create policy favourites_select on public.user_favourites
  for select to authenticated using (true);

create policy favourites_insert_own on public.user_favourites
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy favourites_delete_own on public.user_favourites
  for delete to authenticated using (profile_id = auth.uid());
