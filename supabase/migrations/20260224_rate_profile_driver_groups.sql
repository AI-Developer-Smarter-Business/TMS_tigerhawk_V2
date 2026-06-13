-- Migration: Many-to-many relationship between rate profiles and driver groups
-- A driver group can now be assigned to multiple rate profiles.

-- =============================================================================
-- 1. Junction table for rate_profiles <-> driver_groups
-- =============================================================================
CREATE TABLE IF NOT EXISTS rate_profile_driver_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_profile_id UUID NOT NULL REFERENCES rate_profiles(id) ON DELETE CASCADE,
  driver_group_id UUID NOT NULL REFERENCES driver_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rate_profile_id, driver_group_id)
);

-- Index for fast lookups in both directions
CREATE INDEX IF NOT EXISTS idx_rpdg_profile ON rate_profile_driver_groups(rate_profile_id);
CREATE INDEX IF NOT EXISTS idx_rpdg_group ON rate_profile_driver_groups(driver_group_id);

-- =============================================================================
-- 2. Migrate existing driver_groups.rate_profile_id data into junction table
-- =============================================================================
INSERT INTO rate_profile_driver_groups (rate_profile_id, driver_group_id)
SELECT rate_profile_id, id
FROM driver_groups
WHERE rate_profile_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. RLS policies — same as other driver pay rate tables
-- =============================================================================
ALTER TABLE rate_profile_driver_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rate profile driver groups"
  ON rate_profile_driver_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and dispatchers can manage rate profile driver groups"
  ON rate_profile_driver_groups FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
