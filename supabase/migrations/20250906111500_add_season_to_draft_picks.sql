-- Add season column to draft_picks
ALTER TABLE draft_picks
ADD COLUMN season TEXT DEFAULT '2025-26';

-- Update existing draft_picks to use the current season
UPDATE draft_picks SET season = '2025-26' WHERE season IS NULL;
