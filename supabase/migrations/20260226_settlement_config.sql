CREATE TABLE IF NOT EXISTS settlement_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL DEFAULT 'Weekly',        -- Daily, Weekly, Bi-Weekly, Monthly
  start_day TEXT NOT NULL DEFAULT 'Saturday',         -- Monday, Tuesday, ... Sunday
  auto_settle BOOLEAN NOT NULL DEFAULT false,
  driver_notifications BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE settlement_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read settlement_config" ON settlement_config;
CREATE POLICY "Authenticated users can read settlement_config"
  ON settlement_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert settlement_config" ON settlement_config;
CREATE POLICY "Authenticated users can insert settlement_config"
  ON settlement_config FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update settlement_config" ON settlement_config;
CREATE POLICY "Authenticated users can update settlement_config"
  ON settlement_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Seed with default row
INSERT INTO settlement_config (period_type, start_day, auto_settle, driver_notifications)
VALUES ('Weekly', 'Saturday', false, false);
