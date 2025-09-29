-- Remove outdated columns from players table
ALTER TABLE public.players
DROP COLUMN IF EXISTS overall_rank,
DROP COLUMN IF EXISTS conference_rank,
DROP COLUMN IF EXISTS regional_rank,
DROP COLUMN IF EXISTS double_doubles,
DROP COLUMN IF EXISTS total_score;

-- Add new is_rookie column to players table
ALTER TABLE public.players
ADD COLUMN is_rookie BOOLEAN DEFAULT FALSE;

-- Optional: Add an index to the new column if it will be frequently queried
-- CREATE INDEX players_is_rookie_idx ON public.players (is_rookie);
