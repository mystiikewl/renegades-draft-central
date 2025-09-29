-- Add is_admin column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Update the handle_new_user function to include is_admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, is_admin)
  VALUES (NEW.id, NEW.email, NEW.email = 'ataha91@gmail.com');
  RETURN NEW;
END;
$$;

-- Update existing profiles to set is_admin for the main admin user
UPDATE public.profiles 
SET is_admin = TRUE 
WHERE email = 'ataha91@gmail.com';

-- Drop existing policies
drop policy if exists "Users can view keepers for their teams" on public.keepers;
drop policy if exists "Admins can manage all keepers" on public.keepers;

-- Create updated policies with correct admin email
create policy "Users can view keepers for their teams"
  on keepers for select
  using (
    team_id in (
      select team_id from profiles where user_id = auth.uid()
    )
    or exists (
      select 1 from profiles 
      where user_id = auth.uid() 
      and (email = 'ataha91@gmail.com' or is_admin = true)
    )
  );

create policy "Admins can manage all keepers"
  on keepers for all
  using (
    exists (
      select 1 from profiles 
      where user_id = auth.uid() 
      and (email = 'ataha91@gmail.com' or is_admin = true)
    )
  );