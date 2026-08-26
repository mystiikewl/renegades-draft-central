-- Fix: is_admin() referenced auth.uid() while pinned to an empty
-- search_path, which fails at call time. Repoint to a pinned safe path.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = 'public', 'auth'
stable
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
