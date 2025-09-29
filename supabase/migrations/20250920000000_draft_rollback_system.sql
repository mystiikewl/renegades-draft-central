-- Draft Rollback System Migration
-- Adds audit logging and rollback functionality for draft picks

-- Create audit log table for tracking rollback operations
CREATE TABLE draft_rollback_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rollback_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'rollback', 'preview', 'cancel'
  admin_user_id UUID REFERENCES auth.users(id),
  rollback_point JSONB NOT NULL, -- Stores the rollback criteria (pick number, round, etc.)
  affected_picks JSONB NOT NULL, -- Array of picks that were/will be affected
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'executed', 'failed', 'cancelled'
  error_message TEXT,
  metadata JSONB -- Additional context like IP, user agent, etc.
);

-- Create rollback snapshots table for bookmarking common rollback points
CREATE TABLE draft_rollback_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, -- User-friendly name like "After Round 2"
  description TEXT,
  snapshot_data JSONB NOT NULL, -- Complete draft state at this point
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_bookmarked BOOLEAN DEFAULT false
);

-- RLS Policies for audit table
ALTER TABLE draft_rollback_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view rollback audit" ON draft_rollback_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Only admins can insert audit logs
CREATE POLICY "Admins can insert rollback audit" ON draft_rollback_audit
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- RLS Policies for snapshots table
ALTER TABLE draft_rollback_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rollback snapshots" ON draft_rollback_snapshots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Function to perform rollback with audit logging
CREATE OR REPLACE FUNCTION rollback_draft_picks(
  p_rollback_criteria JSONB,
  p_admin_user_id UUID,
  p_rollback_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_picks JSONB;
  result JSONB;
BEGIN
  -- Insert audit log entry
  INSERT INTO draft_rollback_audit (
    rollback_id,
    action_type,
    admin_user_id,
    rollback_point,
    affected_picks,
    status
  ) VALUES (
    p_rollback_id,
    'rollback',
    p_admin_user_id,
    p_rollback_criteria,
    '[]'::jsonb,
    'pending'
  );

  -- Get picks to rollback based on criteria
  WITH picks_to_rollback AS (
    SELECT
      dp.*,
      jsonb_build_object(
        'id', dp.id,
        'round', dp.round,
        'pick_number', dp.pick_number,
        'player_id', dp.player_id,
        'current_team_id', dp.current_team_id,
        'is_used', dp.is_used
      ) as pick_snapshot
    FROM draft_picks dp
    WHERE
      CASE
        WHEN p_rollback_criteria->>'type' = 'pick_number'
        THEN dp.overall_pick >= (p_rollback_criteria->>'pick_number')::integer
        WHEN p_rollback_criteria->>'type' = 'round'
        THEN dp.round >= (p_rollback_criteria->>'round')::integer
        WHEN p_rollback_criteria->>'type' = 'datetime'
        THEN dp.created_at >= (p_rollback_criteria->>'datetime')::timestamptz
        ELSE false
      END
      AND dp.is_used = true
  )
  SELECT
    jsonb_agg(pick_snapshot),
    jsonb_build_object(
      'success', true,
      'rollback_id', p_rollback_id,
      'affected_count', count(*)
    )
  INTO affected_picks, result
  FROM picks_to_rollback;

  -- Update the audit log with affected picks
  UPDATE draft_rollback_audit
  SET
    affected_picks = COALESCE(affected_picks, '[]'::jsonb),
    status = 'executed'
  WHERE rollback_id = p_rollback_id;

  -- Perform the actual rollback
  UPDATE draft_picks
  SET
    is_used = false,
    player_id = null,
    current_team_id = original_team_id
  WHERE id IN (
    SELECT (value->>'id')::uuid
    FROM jsonb_array_elements(affected_picks)
    WHERE (value->>'is_used')::boolean = true
  );

  -- Update players table to mark them as undrafted
  UPDATE players
  SET
    is_drafted = false,
    drafted_by_team_id = null
  WHERE id IN (
    SELECT DISTINCT (value->>'player_id')::uuid
    FROM jsonb_array_elements(affected_picks)
    WHERE value->>'player_id' IS NOT NULL
  );

  RETURN result;
END;
$$;

-- Function to preview rollback without executing
CREATE OR REPLACE FUNCTION preview_draft_rollback(
  p_rollback_criteria JSONB,
  p_admin_user_id UUID,
  p_rollback_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_picks JSONB;
  result JSONB;
BEGIN
  -- Insert audit log entry
  INSERT INTO draft_rollback_audit (
    rollback_id,
    action_type,
    admin_user_id,
    rollback_point,
    affected_picks,
    status
  ) VALUES (
    p_rollback_id,
    'preview',
    p_admin_user_id,
    p_rollback_criteria,
    '[]'::jsonb,
    'pending'
  );

  -- Get picks that would be affected
  WITH picks_to_rollback AS (
    SELECT
      dp.*,
      jsonb_build_object(
        'id', dp.id,
        'round', dp.round,
        'pick_number', dp.pick_number,
        'player_id', dp.player_id,
        'current_team_id', dp.current_team_id,
        'is_used', dp.is_used
      ) as pick_snapshot
    FROM draft_picks dp
    WHERE
      CASE
        WHEN p_rollback_criteria->>'type' = 'pick_number'
        THEN dp.overall_pick >= (p_rollback_criteria->>'pick_number')::integer
        WHEN p_rollback_criteria->>'type' = 'round'
        THEN dp.round >= (p_rollback_criteria->>'round')::integer
        WHEN p_rollback_criteria->>'type' = 'datetime'
        THEN dp.created_at >= (p_rollback_criteria->>'datetime')::timestamptz
        ELSE false
      END
      AND dp.is_used = true
  )
  SELECT
    jsonb_agg(pick_snapshot),
    jsonb_build_object(
      'success', true,
      'rollback_id', p_rollback_id,
      'affected_count', count(*),
      'preview', true
    )
  INTO affected_picks, result
  FROM picks_to_rollback;

  -- Update the audit log with affected picks
  UPDATE draft_rollback_audit
  SET
    affected_picks = COALESCE(affected_picks, '[]'::jsonb),
    status = 'executed'
  WHERE rollback_id = p_rollback_id;

  RETURN result;
END;
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_draft_picks_rollback_query
ON draft_picks(overall_pick, round, created_at, is_used);

CREATE INDEX IF NOT EXISTS idx_draft_rollback_audit_admin_user
ON draft_rollback_audit(admin_user_id, executed_at);

CREATE INDEX IF NOT EXISTS idx_draft_rollback_audit_status
ON draft_rollback_audit(status, executed_at);

-- Add comments for documentation
COMMENT ON TABLE draft_rollback_audit IS 'Audit log for tracking draft rollback operations';
COMMENT ON TABLE draft_rollback_snapshots IS 'Saved rollback points for easy reference';
COMMENT ON FUNCTION rollback_draft_picks IS 'Execute draft rollback with full audit logging';
COMMENT ON FUNCTION preview_draft_rollback IS 'Preview rollback impact without executing changes';
