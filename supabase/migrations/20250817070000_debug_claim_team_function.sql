-- Debugging: Add logging to the claim_team function

create or replace function public.claim_team(
  target_team_id uuid
)
returns json as $$
declare
  current_user_id uuid := auth.uid();
  user_has_team boolean;
  team_is_claimed boolean;
begin
  -- Log current_user_id and target_team_id for debugging
  RAISE LOG 'claim_team: current_user_id = %', current_user_id;
  RAISE LOG 'claim_team: target_team_id = %', target_team_id;

  -- Check if the user is already on a team
  select exists(select 1 from public.profiles where id = current_user_id and team_id is not null) into user_has_team;
  if user_has_team then
    RAISE LOG 'claim_team: User already has a team.';
    raise exception 'User is already assigned to a team.';
  end if;

  -- Check if the target team is already claimed by another user
  select exists(select 1 from public.profiles where team_id = target_team_id) into team_is_claimed;
  if team_is_claimed then
    RAISE LOG 'claim_team: Team already claimed.';
    raise exception 'This team has already been claimed.';
  end if;

  -- Assign the user to the team
  update public.profiles
  set team_id = target_team_id
  where id = current_user_id;

  RAISE LOG 'claim_team: Team claimed successfully for user % and team %', current_user_id, target_team_id;
  return json_build_object('status', 'success', 'message', 'Team claimed successfully.');
exception
  when others then
    RAISE LOG 'claim_team: Error - %', sqlerrm;
    return json_build_object('status', 'error', 'message', sqlerrm);
end;
$$ language plpgsql security definer;
