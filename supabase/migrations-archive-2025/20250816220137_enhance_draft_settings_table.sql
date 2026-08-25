-- Add season column
ALTER TABLE draft_settings
ADD COLUMN season TEXT DEFAULT '2025-26';

-- Add draft_type column
ALTER TABLE draft_settings
ADD COLUMN draft_type TEXT DEFAULT 'snake';

-- Add pick_time_limit_seconds column
ALTER TABLE draft_settings
ADD COLUMN pick_time_limit_seconds INTEGER DEFAULT 120;

-- Add draft_order column
ALTER TABLE draft_settings
ADD COLUMN draft_order JSONB DEFAULT '[]'::jsonb;
