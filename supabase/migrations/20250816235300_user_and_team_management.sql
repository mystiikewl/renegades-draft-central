-- Supabase migration for User and Team Management enhancements

-- Step 1: Create the is_admin helper function
-- This function checks if the currently authenticated user has the 'admin' role.
-- For this implementation, we'll assume an 'is_admin' boolean column on the 'profiles' table.
create or replace function is_admin()
returns boolean as $$
begin
  return (
    select is_admin
    from public.profiles
    where id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- Step 2: Create the RPC function for admins to invite and assign users
-- This function handles the atomic operation of inviting a user and creating their profile.
create or replace function invite_and_assign_user_to_team(
  user_email text,
  target_team_id int
)
returns json as $$
declare
  invited_user_id uuid;
begin
  -- This function must be run by an admin
  if not is_admin() then
    raise exception 'Only admins can perform this action';
  end if;

  -- Invite the user using their email
  select raw_user_meta_data->>'id' into invited_user_id from auth.users where email = user_email;
  
  if invited_user_id is null then
      select id into invited_user_id from auth.invite_user_by_email(user_email);
  end if;

  -- Insert a new profile for the invited user, linking them to the team
  insert into public.profiles (id, email, team_id)
  values (invited_user_id, user_email, target_team_id)
  on conflict (id) do update
  set team_id = excluded.team_id;

  return json_build_object('status', 'success', 'user_id', invited_user_id);
exception
  when others then
    return json_build_object('status', 'error', 'message', sqlerrm);
end;
$$ language plpgsql security definer;

-- Step 3: Create the RPC function for users to claim an unassigned team
create or replace function claim_team(
  target_team_id uuid
)
returns json as $$
declare
  current_user_id uuid := auth.uid();
  user_has_team boolean;
  team_is_claimed boolean;
begin
  -- Check if the user is already on a team
  select exists(select 1 from public.profiles where id = current_user_id and team_id is not null) into user_has_team;
  if user_has_team then
    raise exception 'User is already assigned to a team.';
  end if;

  -- Check if the target team is already claimed by another user
  select exists(select 1 from public.profiles where team_id = target_team_id) into team_is_claimed;
  if team_is_claimed then
    raise exception 'This team has already been claimed.';
  end if;

  -- Assign the user to the team
  update public.profiles
  set team_id = target_team_id
  where id = current_user_id;

  return json_build_object('status', 'success', 'message', 'Team claimed successfully.');
exception
  when others then
    return json_build_object('status', 'error', 'message', sqlerrm);
end;
$$ language plpgsql;

-- Step 4: Set up RLS policies for teams table
alter table public.teams enable row level security;

drop policy if exists "Admins can manage teams" on public.teams;
create policy "Admins can manage teams" on public.teams
  for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "Authenticated users can view available teams" on public.teams;
create policy "Authenticated users can view available teams" on public.teams
  for select
  using (
    auth.role() = 'authenticated' and
    not exists (
      select 1 from public.profiles where profiles.team_id = teams.id
    )
  );

-- Step 5: Set up RLS policies for profiles table
alter table public.profiles enable row level security;

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles" on public.profiles
  for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles
  for select
  using (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());
