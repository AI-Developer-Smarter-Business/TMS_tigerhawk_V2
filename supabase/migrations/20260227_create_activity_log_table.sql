-- =============================================================
-- Create the activity_log table for system-wide audit tracking
-- =============================================================
-- This table records all CRUD operations across the TMS:
-- shipments, drivers, trucks, chassis, rate profiles, payments,
-- invoices, user account changes, etc.
-- =============================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type     text NOT NULL,          -- e.g. 'shipment', 'driver', 'truck', 'rate_profile'
  entity_id       text NOT NULL,          -- UUID of the affected record (text to handle any ID format)
  action          text NOT NULL,          -- 'created', 'updated', 'deleted', 'password_changed', etc.
  user_id         uuid REFERENCES auth.users(id),  -- who performed the action
  details         jsonb DEFAULT '{}'::jsonb,        -- flexible context (name, email, fields_changed, etc.)
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log (entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log (action);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id ON activity_log (entity_id);

-- Composite index for the most common filtered query (type + date range)
CREATE INDEX IF NOT EXISTS idx_activity_log_type_date ON activity_log (entity_type, created_at DESC);

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies:
-- Service role (used by API routes for inserts) bypasses RLS automatically.
-- Authenticated staff can read all logs.
-- Only admin/dispatcher/accounting can insert (for any direct client usage).

CREATE POLICY "Staff read activity_log"
  ON activity_log FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff insert activity_log"
  ON activity_log FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

-- No UPDATE or DELETE policies — audit logs should be immutable.
-- Service role can still write via API routes (bypasses RLS).

-- Auto-update the updated_at timestamp (optional, mostly for consistency)
CREATE OR REPLACE FUNCTION update_activity_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_log_updated_at
  BEFORE UPDATE ON activity_log
  FOR EACH ROW
  EXECUTE FUNCTION update_activity_log_updated_at();
