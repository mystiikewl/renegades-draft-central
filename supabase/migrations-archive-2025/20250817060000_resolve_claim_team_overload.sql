-- Resolve claim_team function overload by dropping all versions and recreating with UUID parameter

-- Drop existing claim_team functions to resolve overload issues
-- Drop function with UUID parameter if it exists
DROP FUNCTION IF EXISTS public.claim_team(uuid);
-- Drop function with INTEGER parameter if it exists (this is the problematic one)
DROP FUNCTION IF EXISTS public.claim_team(integer);

-- Re-create the claim_team function with the correct UUID parameter
create or replace function public.claim_team(
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
$$ language plpgsql security definer;
