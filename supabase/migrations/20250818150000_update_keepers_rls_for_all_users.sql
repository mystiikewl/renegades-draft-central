-- Update keepers RLS policies to allow all users to read keepers (for draft filtering)
-- while maintaining restrictions on insert/update/delete operations

-- Drop existing policies
drop policy if exists "Users can view keepers for their teams" on public.keepers;
drop policy if exists "Admins can manage all keepers" on public.keepers;
drop policy if exists "Users can add keepers to their own team" on public.keepers;

-- Create new policies
create policy "All users can view all keepers"
  on keepers for select
  using (true);  -- Allow all users to read keepers

create policy "Users can add keepers to their own team"
  on keepers for insert
  with check (
    team_id in (
      select team_id from profiles where user_id = auth.uid()
    )
  );

create policy "Users can update keepers for their own team"
  on keepers for update
  using (
    team_id in (
      select team_id from profiles where user_id = auth.uid()
    )
  );

create policy "Users can delete keepers for their own team"
  on keepers for delete
  using (
    team_id in (
      select team_id from profiles where user_id = auth.uid()
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