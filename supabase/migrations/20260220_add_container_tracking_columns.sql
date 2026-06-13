-- Migration: Add container tracking columns for Port Houston integration
-- These columns are needed for the PH sync to write tracking data
-- and for the dispatcher to display port-synced container info.

-- Tracking timestamps
ALTER TABLE containers ADD COLUMN IF NOT EXISTS time_in timestamptz;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS time_out timestamptz;

-- Port Houston sync metadata
ALTER TABLE containers ADD COLUMN IF NOT EXISTS ph_synced_at timestamptz;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS unit_id text UNIQUE;

-- Stop/hold flags from port
ALTER TABLE containers ADD COLUMN IF NOT EXISTS stopped_road boolean DEFAULT false;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS stopped_vessel boolean DEFAULT false;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS stopped_rail boolean DEFAULT false;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS impediment_road text;

-- Equipment and classification
ALTER TABLE containers ADD COLUMN IF NOT EXISTS equipment_type text;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS freight_kind text;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS dray_status text;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS gross_weight_kg numeric;

-- Transit state (may already exist — IF NOT EXISTS handles that)
ALTER TABLE containers ADD COLUMN IF NOT EXISTS transit_state text;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS shipping_line text;

-- Create index for PH sync lookups
CREATE INDEX IF NOT EXISTS idx_containers_unit_id ON containers(unit_id);
CREATE INDEX IF NOT EXISTS idx_containers_ph_synced_at ON containers(ph_synced_at);
CREATE INDEX IF NOT EXISTS idx_containers_status ON containers(status);
