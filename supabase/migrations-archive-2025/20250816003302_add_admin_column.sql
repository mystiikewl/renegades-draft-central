-- Add is_admin column to profiles table
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
  VALUES (NEW.id, NEW.email, NEW.email = 'ataha425@gmail.com');
  RETURN NEW;
END;
$$;

-- Update existing profiles to set is_admin for the main admin user
UPDATE public.profiles 
SET is_admin = TRUE 
WHERE email = 'ataha425@gmail.com';