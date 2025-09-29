-- Add updated_at column to draft_settings table
ALTER TABLE draft_settings
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for draft_settings table
DROP TRIGGER IF EXISTS update_draft_settings_updated_at ON public.draft_settings;

CREATE TRIGGER update_draft_settings_updated_at
  BEFORE UPDATE ON public.draft_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();