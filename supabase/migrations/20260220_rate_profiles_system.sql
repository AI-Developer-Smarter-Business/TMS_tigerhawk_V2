-- Migration: Rate Profiles System
-- Implements the new multi-line charge profile system with zonal and defined lanes.
-- See docs/RATE_SYSTEM_DESIGN.md for full design rationale.

-- =============================================================================
-- 1. charge_codes — Reference table for standardized charge codes
-- =============================================================================
CREATE TABLE IF NOT EXISTS charge_codes (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT, -- e.g. 'drayage', 'accessorial', 'warehouse', 'other'
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 2. rate_profiles — Top-level tariff templates
-- =============================================================================
CREATE TABLE IF NOT EXISTS rate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  effective_date DATE,
  expires_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 3. rate_profile_lanes — Zonal or defined lanes within a profile
-- =============================================================================
CREATE TABLE IF NOT EXISTS rate_profile_lanes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_profile_id UUID NOT NULL REFERENCES rate_profiles(id) ON DELETE CASCADE,
  lane_type TEXT NOT NULL CHECK (lane_type IN ('zonal', 'defined')),
  name TEXT,

  -- Zonal fields (used when lane_type = 'zonal')
  anchor_point_id UUID REFERENCES lane_origins(id) ON DELETE SET NULL,
  anchor_role TEXT CHECK (anchor_role IN ('origin', 'destination')),
  zone_id UUID REFERENCES lane_zones(id) ON DELETE SET NULL,

  -- Defined fields (used when lane_type = 'defined')
  pickup_location TEXT,
  pickup_lat NUMERIC,
  pickup_lng NUMERIC,
  delivery_location TEXT,
  delivery_lat NUMERIC,
  delivery_lng NUMERIC,
  return_location TEXT,
  return_lat NUMERIC,
  return_lng NUMERIC,

  -- Common fields
  direction TEXT CHECK (direction IN ('inbound', 'outbound', 'both')) DEFAULT 'both',
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure zonal lanes have anchor info, defined lanes have locations
  CONSTRAINT zonal_requires_anchor CHECK (
    lane_type != 'zonal' OR (anchor_point_id IS NOT NULL AND anchor_role IS NOT NULL AND zone_id IS NOT NULL)
  ),
  CONSTRAINT defined_requires_locations CHECK (
    lane_type != 'defined' OR (pickup_location IS NOT NULL OR delivery_location IS NOT NULL)
  )
);

-- =============================================================================
-- 4. rate_profile_charges — Charge line items per lane
-- =============================================================================
CREATE TABLE IF NOT EXISTS rate_profile_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane_id UUID NOT NULL REFERENCES rate_profile_lanes(id) ON DELETE CASCADE,
  charge_code TEXT NOT NULL,
  charge_name TEXT NOT NULL,

  -- Calculation mode
  calculation_mode TEXT NOT NULL CHECK (calculation_mode IN ('between_statuses', 'by_event', 'by_move', 'by_leg')),

  -- between_statuses fields
  status_from TEXT,
  status_to TEXT,

  -- by_event fields
  event TEXT,
  event_location TEXT,

  -- by_leg fields
  leg_from TEXT,
  leg_from_location TEXT,
  leg_to TEXT,
  leg_to_location TEXT,

  -- Rate configuration
  unit_of_measure TEXT NOT NULL CHECK (unit_of_measure IN ('per_day', 'per_hour', 'per_pounds', 'per_miles', 'per_road_toll_miles', 'fixed', 'percentage', 'per_15min')),
  rate NUMERIC NOT NULL,
  min_amount NUMERIC,
  max_amount NUMERIC,
  free_units NUMERIC DEFAULT 0,

  -- Behavior
  auto_add BOOLEAN DEFAULT true,
  effective_date_based_on TEXT DEFAULT 'current_date',
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure mode-specific fields are populated
  CONSTRAINT between_statuses_requires_fields CHECK (
    calculation_mode != 'between_statuses' OR (status_from IS NOT NULL AND status_to IS NOT NULL)
  ),
  CONSTRAINT by_event_requires_fields CHECK (
    calculation_mode != 'by_event' OR event IS NOT NULL
  ),
  CONSTRAINT by_leg_requires_fields CHECK (
    calculation_mode != 'by_leg' OR (leg_from IS NOT NULL AND leg_to IS NOT NULL)
  )
);

-- =============================================================================
-- 5. rate_profile_conditions — Conditional logic on lanes or charges
-- =============================================================================
CREATE TABLE IF NOT EXISTS rate_profile_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane_id UUID REFERENCES rate_profile_lanes(id) ON DELETE CASCADE,
  charge_id UUID REFERENCES rate_profile_charges(id) ON DELETE CASCADE,

  condition_type TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'equals' CHECK (operator IN ('equals', 'not_equals', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte')),
  condition_value JSONB NOT NULL,

  -- Grouping for AND/OR/NOT logic
  logic_group INT DEFAULT 1,
  logic_operator TEXT DEFAULT 'AND' CHECK (logic_operator IN ('AND', 'OR', 'NOT')),

  created_at TIMESTAMPTZ DEFAULT now(),

  -- Must reference either a lane or a charge, not neither
  CONSTRAINT must_have_parent CHECK (lane_id IS NOT NULL OR charge_id IS NOT NULL)
);

-- =============================================================================
-- 6. Add rate_profile_id FK to driver_groups
-- =============================================================================
ALTER TABLE driver_groups ADD COLUMN IF NOT EXISTS rate_profile_id UUID REFERENCES rate_profiles(id) ON DELETE SET NULL;

-- =============================================================================
-- 7. Indexes for query performance
-- =============================================================================

-- rate_profiles
CREATE INDEX IF NOT EXISTS idx_rate_profiles_active ON rate_profiles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rate_profiles_effective ON rate_profiles(effective_date, expires_date);

-- rate_profile_lanes
CREATE INDEX IF NOT EXISTS idx_rate_profile_lanes_profile ON rate_profile_lanes(rate_profile_id);
CREATE INDEX IF NOT EXISTS idx_rate_profile_lanes_type ON rate_profile_lanes(lane_type);
CREATE INDEX IF NOT EXISTS idx_rate_profile_lanes_anchor ON rate_profile_lanes(anchor_point_id, anchor_role) WHERE lane_type = 'zonal';
CREATE INDEX IF NOT EXISTS idx_rate_profile_lanes_zone ON rate_profile_lanes(zone_id) WHERE lane_type = 'zonal';
CREATE INDEX IF NOT EXISTS idx_rate_profile_lanes_priority ON rate_profile_lanes(priority DESC);

-- rate_profile_charges
CREATE INDEX IF NOT EXISTS idx_rate_profile_charges_lane ON rate_profile_charges(lane_id);
CREATE INDEX IF NOT EXISTS idx_rate_profile_charges_code ON rate_profile_charges(charge_code);
CREATE INDEX IF NOT EXISTS idx_rate_profile_charges_mode ON rate_profile_charges(calculation_mode);
CREATE INDEX IF NOT EXISTS idx_rate_profile_charges_active ON rate_profile_charges(is_active) WHERE is_active = true;

-- rate_profile_conditions
CREATE INDEX IF NOT EXISTS idx_rate_profile_conditions_lane ON rate_profile_conditions(lane_id) WHERE lane_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rate_profile_conditions_charge ON rate_profile_conditions(charge_id) WHERE charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rate_profile_conditions_type ON rate_profile_conditions(condition_type);

-- driver_groups rate_profile lookup
CREATE INDEX IF NOT EXISTS idx_driver_groups_rate_profile ON driver_groups(rate_profile_id) WHERE rate_profile_id IS NOT NULL;

-- charge_codes
CREATE INDEX IF NOT EXISTS idx_charge_codes_active ON charge_codes(is_active) WHERE is_active = true;

-- =============================================================================
-- 8. RLS Policies (match existing pattern — authenticated users can read, admin/dispatcher can write)
-- =============================================================================
ALTER TABLE rate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_profile_lanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_profile_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_profile_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_codes ENABLE ROW LEVEL SECURITY;

-- Read policies: any authenticated user
CREATE POLICY "Authenticated users can read rate_profiles"
  ON rate_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read rate_profile_lanes"
  ON rate_profile_lanes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read rate_profile_charges"
  ON rate_profile_charges FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read rate_profile_conditions"
  ON rate_profile_conditions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read charge_codes"
  ON charge_codes FOR SELECT TO authenticated USING (true);

-- Write policies: admin and dispatcher roles via service role client (bypasses RLS)
-- The API routes use serviceSupabase for mutations, so we don't need insert/update/delete
-- policies for regular users. Service role bypasses RLS entirely.

-- =============================================================================
-- 9. Updated_at triggers (auto-update timestamps)
-- =============================================================================

-- Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_rate_profiles
  BEFORE UPDATE ON rate_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_rate_profile_lanes
  BEFORE UPDATE ON rate_profile_lanes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_rate_profile_charges
  BEFORE UPDATE ON rate_profile_charges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 10. Seed charge codes
-- =============================================================================
INSERT INTO charge_codes (code, name, category) VALUES
  ('S100', 'DRAYAGE', 'drayage'),
  ('S101', 'DRAYAGE (ALL-IN)', 'drayage'),
  ('S102', 'DRAYAGE RATE', 'drayage'),
  ('S103', 'DRAY NON-BONDED - DSI', 'drayage'),
  ('S104', 'FUEL', 'drayage'),
  ('S105', 'BOBTAIL CHARGE', 'drayage'),
  ('S106', 'BONDED CARGO CHARGE', 'drayage'),
  ('S107', 'BONDED MOVE', 'drayage'),
  ('S108', 'CHASSIS', 'drayage'),
  ('S109', 'CHASSIS SPLIT', 'drayage'),
  ('S110', 'CHASSIS USAGE', 'drayage'),
  ('S111', 'ADDITIONAL CHASSIS USAGE', 'drayage'),
  ('S112', 'CITATION', 'accessorial'),
  ('S113', 'CRATE TARPING', 'accessorial'),
  ('S114', 'CREDIT', 'accessorial'),
  ('S115', 'DETENTION CHARGES', 'accessorial'),
  ('S116', 'DELIVERY CHARGES', 'drayage'),
  ('S117', 'DELIVERY PICK-UP', 'drayage'),
  ('S118', 'DEMUR-DET FEE', 'accessorial'),
  ('S120', 'DRY RUN', 'accessorial'),
  ('S121', 'DRY RUN/CANCELLED ORDER', 'accessorial'),
  ('S122', 'DROP CHARGE', 'accessorial'),
  ('S124', 'EMPTY RETURN', 'drayage'),
  ('S126', 'FLATBED LOADED', 'drayage'),
  ('S127', 'FLIP CHARGE', 'accessorial'),
  ('S128', 'HAZMAT', 'accessorial'),
  ('S130', 'LINE HAUL', 'drayage'),
  ('S131', 'OFF-HIRE REPOSITIONING', 'drayage'),
  ('S132', 'OVERWEIGHT', 'accessorial'),
  ('S133', 'PIER CONGESTION', 'accessorial'),
  ('S134', 'PLACARD FEE', 'accessorial'),
  ('S136', 'PORT CONGESTION FEE', 'accessorial'),
  ('S137', 'POWER ONLY LOAD', 'drayage'),
  ('S138', 'REDELIVERY', 'drayage'),
  ('S140', 'REPOSITIONING CONTAINERS', 'drayage'),
  ('S141', 'PERMIT', 'accessorial'),
  ('S142', 'SURCHARGE - 4%', 'accessorial'),
  ('S143', 'SURCHARGE - 20%', 'accessorial'),
  ('S145', 'SATURDAY DELIVERY', 'accessorial'),
  ('S146', 'SCALE LOAD', 'accessorial'),
  ('S147', 'SCALE TICKET', 'accessorial'),
  ('S148', 'SORT AND SEGREGATION', 'warehouse'),
  ('S150', 'STOP OFF', 'accessorial'),
  ('S151', 'STRAP', 'accessorial'),
  ('S152', 'PREPULL', 'accessorial'),
  ('S153', 'SWING CHARGE', 'accessorial'),
  ('S154', 'TANKER ENDORSEMENT', 'accessorial'),
  ('S155', 'TARP', 'accessorial'),
  ('S156', 'TOLLS', 'accessorial'),
  ('S157', 'TRAFFIC FINE', 'accessorial'),
  ('S158', 'TRANSPORTATION', 'drayage'),
  ('S159', 'TRI-AXLE', 'accessorial'),
  ('S160', 'WAITING TIME', 'accessorial'),
  ('S162', 'YARD PULL', 'accessorial'),
  ('S163', 'YARD DAYS', 'accessorial'),
  ('S164', 'ADDITIONAL HOURS', 'accessorial'),
  ('S165', 'ADDITIONAL WEIGHT', 'accessorial'),
  ('S167', 'LUMPER', 'accessorial'),
  ('S200', 'AIR BAGS', 'warehouse'),
  ('S201', 'BILL OF LADING FEE', 'warehouse'),
  ('S202', 'BLOCKS AND BRACES', 'warehouse'),
  ('S205', 'PER DIEM', 'accessorial'),
  ('S207', 'FLEXI BAG DISPOSAL', 'warehouse'),
  ('S208', 'PALLET CHARGE - SKU/WRAP', 'warehouse'),
  ('S210', 'RELOAD', 'warehouse'),
  ('S211', 'TRANSLOAD', 'warehouse'),
  ('S212', 'CANCELLATION/RESTOCKING', 'warehouse'),
  ('S213', 'UNLOAD', 'warehouse'),
  ('S214', 'NO SHOW', 'accessorial'),
  ('S215', 'DISPOSAL FEE', 'warehouse'),
  ('S301', 'CONTAINER STORAGE - WHS', 'warehouse'),
  ('S302', 'CONTAINER INSPECTION', 'warehouse'),
  ('S303', 'DEVANNING', 'warehouse'),
  ('S304', 'PALLET DELIVERY', 'warehouse'),
  ('S305', 'HOURLY PAY', 'other'),
  ('S306', 'LABELING', 'warehouse'),
  ('S308', 'PALLET HANDLING', 'warehouse'),
  ('S309', 'PALLETIZATION', 'warehouse'),
  ('S310', 'PALLETIZING LABOR', 'warehouse'),
  ('S312', 'PALLETS', 'warehouse'),
  ('S313', 'PALLET STORAGE', 'warehouse'),
  ('S314', 'PARTS', 'other'),
  ('S315', '30-DAY STORAGE CHARGE', 'warehouse'),
  ('S316', '60 DAY STORAGE CHARGE', 'warehouse'),
  ('S317', 'STORAGE', 'warehouse'),
  ('S320', 'WAREHOUSING STORAGE', 'warehouse'),
  ('S321', 'WHS - LOAD/BLOCK/BRACE', 'warehouse'),
  ('S400', 'ALL-IN RATE', 'other'),
  ('S420', 'CARRIER FREIGHT PAY', 'other'),
  ('S430', 'MAINTENANCE AND REPAIR', 'other'),
  ('S440', 'PACKAGED MOTOR OIL', 'other'),
  ('S450', 'CONSUMABLES', 'other'),
  ('S470', 'SERVICE COST', 'other'),
  ('S491', 'TIRE REBILL', 'other'),
  ('S492', 'TRANSACTION FEE', 'other'),
  ('S499', 'OTHER', 'other')
ON CONFLICT (code) DO NOTHING;
