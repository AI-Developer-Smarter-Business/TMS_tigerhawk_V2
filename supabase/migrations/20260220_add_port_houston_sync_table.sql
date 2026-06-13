-- Key-value store for Port Houston sync state (subscription IDs, rotation progress, etc.)
CREATE TABLE IF NOT EXISTS port_houston_sync (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

-- Allow service role full access (used by cron and admin client)
ALTER TABLE port_houston_sync ENABLE ROW LEVEL SECURITY;

-- RLS policy: allow service_role (admin client) full access
CREATE POLICY "service_role_all" ON port_houston_sync
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS policy: allow authenticated users to read (for status polling)
CREATE POLICY "authenticated_read" ON port_houston_sync
  FOR SELECT
  TO authenticated
  USING (true);
