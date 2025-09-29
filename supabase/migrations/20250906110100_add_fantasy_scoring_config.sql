-- Add fantasy scoring configuration to draft settings
ALTER TABLE draft_settings
ADD COLUMN fantasy_scoring_config JSONB DEFAULT '{
  "points": 1.0,
  "rebounds": 1.2,
  "assists": 1.5,
  "steals": 2.0,
  "blocks": 2.0,
  "three_pointers_made": 0.5,
  "turnovers": -1.0,
  "field_goal_percentage": 0.1,
  "free_throw_percentage": 0.1
}'::jsonb;

-- Insert default config if no existing settings
INSERT INTO draft_settings (id, fantasy_scoring_config)
SELECT 'default', '{
  "points": 1.0,
  "rebounds": 1.0,
  "assists": 1.0,
  "steals": 1.0,
  "blocks": 1.0,
  "three_pointers_made": 1.0,
  "turnovers": 1.0,
  "field_goal_percentage": 1.0,
  "free_throw_percentage": 1.0
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM draft_settings);
