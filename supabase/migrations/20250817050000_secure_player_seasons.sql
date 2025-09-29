-- Enable Row Level Security on the player_seasons table
ALTER TABLE public.player_seasons ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read player_seasons data
CREATE POLICY "Allow authenticated read access to player_seasons"
ON public.player_seasons
FOR SELECT
TO authenticated
USING (true);
