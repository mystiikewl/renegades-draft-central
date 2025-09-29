-- Update claim_team function to set owner_email in public.teams table

create or replace function public.claim_team(
  target_team_id uuid
)
returns json as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text := auth.email(); -- Get the current user's email
  user_has_team boolean;
  team_is_claimed boolean;
  updated_profiles_rows int;
  updated_teams_rows int;
begin
  -- Set the search path to include 'auth' schema
  SET search_path TO public, auth;

  -- Log current_user_id and target_team_id for debugging
  RAISE LOG 'claim_team: current_user_id = %', current_user_id;
  RAISE LOG 'claim_team: current_user_email = %', current_user_email;
  RAISE LOG 'claim_team: target_team_id = %', target_team_id;

  -- Check if the user is already on a team
  select exists(select 1 from public.profiles where user_id = current_user_id and team_id is not null) into user_has_team;
  if user_has_team then
    RAISE LOG 'claim_team: User already has a team.';
    return json_build_object('status', 'error', 'message', 'User is already assigned to a team.');
  end if;

  -- Check if the target team is already claimed by another user
  select exists(select 1 from public.profiles where team_id = target_team_id) into team_is_claimed;
  if team_is_claimed then
    RAISE LOG 'claim_team: This team has already been claimed.';
    return json_build_object('status', 'error', 'message', 'This team has already been claimed.');
  end if;

  -- Assign the user to the team in profiles table
  update public.profiles
  set team_id = target_team_id
  where user_id = current_user_id;
  GET DIAGNOSTICS updated_profiles_rows = ROW_COUNT;

  if updated_profiles_rows = 0 then
    RAISE LOG 'claim_team: No profile rows updated. User ID or Team ID might be invalid, or profile does not exist.';
    return json_build_object('status', 'error', 'message', 'Failed to assign team: profile not found or user ID mismatch.');
  end if;

  -- Update the teams table to set the owner_email
  update public.teams
  set owner_email = current_user_email
  where id = target_team_id;
  GET DIAGNOSTICS updated_teams_rows = ROW_COUNT;

  if updated_teams_rows = 0 then
    RAISE LOG 'claim_team: No team rows updated. Team ID might be invalid, or team does not exist.';
    -- Consider if this should be a hard error or just a warning, depending on business logic
    return json_build_object('status', 'error', 'message', 'Failed to update team ownership: team not found.');
  end if;

  RAISE LOG 'claim_team: Team claimed successfully for user % (email: %) and team %', current_user_id, current_user_email, target_team_id;
  return json_build_object('status', 'success', 'message', 'Team claimed successfully.');
exception
  when others then
    RAISE LOG 'claim_team: Error - %', sqlerrm;
    return json_build_object('status', 'error', 'message', sqlerrm);
end;
$$ language plpgsql security definer;
