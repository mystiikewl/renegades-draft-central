ALTER FUNCTION public.claim_team(uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.invite_and_assign_user_to_team(text, int) SET search_path = public;
