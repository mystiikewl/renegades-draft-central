CREATE OR REPLACE FUNCTION unassign_team_owner(p_user_id uuid)
RETURNS void AS $$
DECLARE
    old_team_id uuid;
BEGIN
    -- Get the current team_id of the user
    SELECT team_id INTO old_team_id
    FROM public.profiles
    WHERE id = p_user_id;

    -- Update the profiles table to set team_id to NULL
    UPDATE public.profiles
    SET team_id = NULL
    WHERE id = p_user_id;

    -- If the user was an owner of a team, unassign them from that team
    UPDATE public.teams
    SET owner_email = NULL
    WHERE owner_email = (SELECT email FROM public.profiles WHERE id = p_user_id)
    AND id = old_team_id;
END;
$$ LANGUAGE plpgsql;
