-- Drop existing policies
drop policy if exists "Users can view keepers for their teams" on public.keepers;
drop policy if exists "Admins can manage all keepers" on public.keepers;

-- Create updated policies
create policy "Users can view keepers for their teams"
  on keepers for select
  using (
    team_id in (
      select team_id from profiles where user_id = auth.uid()
    )
    or exists (
      select 1 from profiles 
      where user_id = auth.uid() 
      and (email = 'ataha425@gmail.com' or is_admin = true)
    )
  );

create policy "Admins can manage all keepers"
  on keepers for all
  using (
    exists (
      select 1 from profiles 
      where user_id = auth.uid() 
      and (email = 'ataha425@gmail.com' or is_admin = true)
    )
  );