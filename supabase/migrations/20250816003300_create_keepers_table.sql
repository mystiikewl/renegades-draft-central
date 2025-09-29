-- Create keepers table
create table if not exists public.keepers (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references public.players(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade not null,
  season text not null,
  created_at timestamp with time zone default now() not null,
  
  unique(player_id, season),
  unique(team_id, player_id, season)
);

-- Add indexes for better performance
create index if not exists keepers_team_id_idx on public.keepers(team_id);
create index if not exists keepers_player_id_idx on public.keepers(player_id);
create index if not exists keepers_season_idx on public.keepers(season);

-- Enable RLS
alter table public.keepers enable row level security;

-- Create policies
create policy "Users can view keepers for their teams"
  on keepers for select
  using (team_id in (
    select team_id from profiles where user_id = auth.uid()
  ));

create policy "Admins can manage all keepers"
  on keepers for all
  using (
    exists (
      select 1 from profiles 
      where user_id = auth.uid() 
      and email = 'ataha91@gmail.com'  -- Replace with actual admin email
    )
  );