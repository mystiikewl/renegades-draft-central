-- Add double_doubles and triple_doubles columns to players table for ESPN roto integration
-- These fields were mistakenly dropped in a previous migration but are required for fantasy basketball

ALTER TABLE public.players
ADD COLUMN double_doubles INTEGER DEFAULT 0,
ADD COLUMN triple_doubles INTEGER DEFAULT 0;

-- Add comments to document the fields
COMMENT ON COLUMN public.players.double_doubles IS 'Number of double-doubles achieved by the player';
COMMENT ON COLUMN public.players.triple_doubles IS 'Number of triple-doubles achieved by the player';

-- Add indexes for performance (optional but recommended for frequently queried fields)
CREATE INDEX IF NOT EXISTS players_double_doubles_idx ON public.players (double_doubles DESC);
CREATE INDEX IF NOT EXISTS players_triple_doubles_idx ON public.players (triple_doubles DESC);