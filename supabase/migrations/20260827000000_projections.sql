-- Per-player external projections (ESPN fantasy), stored separately from
-- player_seasons actuals so projection refreshes never touch real stats.
create table if not exists public.projections (
  player_id uuid not null references public.players(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  source text not null default 'espn',
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (season_id, player_id)
);

alter table public.projections enable row level security;

create policy "projections_read" on public.projections
  for select using (true);

create policy "projections_write" on public.projections
  for all using (public.is_admin()) with check (public.is_admin());
