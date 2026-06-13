-- ============================================================
-- Deduction Templates + Driver Deduction Settings
-- ============================================================
-- deduction_templates: defines the catalog of recurring deduction types
-- driver_deduction_settings: per-driver settings for each template
-- ============================================================

-- 1. Deduction Templates
CREATE TABLE IF NOT EXISTS deduction_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  deduction_type TEXT NOT NULL DEFAULT 'Fixed',       -- Fixed, Percentage, Per Mile
  math_operation TEXT NOT NULL DEFAULT 'Subtract',    -- Subtract, Add
  frequency TEXT NOT NULL DEFAULT 'Weekly',            -- Weekly, Biweekly, Monthly
  default_amount NUMERIC(12,2) DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Driver Deduction Settings (junction: driver × template)
CREATE TABLE IF NOT EXISTS driver_deduction_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES deduction_templates(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  limit_total NUMERIC(12,2),              -- optional total cap
  limit_per_period NUMERIC(12,2),         -- optional per-period cap
  total_deducted NUMERIC(12,2) DEFAULT 0, -- running total deducted so far
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(driver_id, template_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dds_driver ON driver_deduction_settings(driver_id);
CREATE INDEX IF NOT EXISTS idx_dds_template ON driver_deduction_settings(template_id);
CREATE INDEX IF NOT EXISTS idx_dt_enabled ON deduction_templates(enabled);

-- RLS
ALTER TABLE deduction_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_deduction_settings ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read/write
CREATE POLICY "Authenticated users can read deduction_templates"
  ON deduction_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert deduction_templates"
  ON deduction_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update deduction_templates"
  ON deduction_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete deduction_templates"
  ON deduction_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read driver_deduction_settings"
  ON driver_deduction_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert driver_deduction_settings"
  ON driver_deduction_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update driver_deduction_settings"
  ON driver_deduction_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete driver_deduction_settings"
  ON driver_deduction_settings FOR DELETE TO authenticated USING (true);

-- Seed some common deduction templates based on PortPro patterns
INSERT INTO deduction_templates (name, description, deduction_type, math_operation, frequency, default_amount, sort_order) VALUES
  ('Fuel',                       'Weekly fuel charge',                    'Fixed', 'Subtract', 'Weekly', 0,      1),
  ('Escrow',                     'Escrow deposit',                       'Fixed', 'Subtract', 'Weekly', 50.00,  2),
  ('Equipment Rental (Samsara)', 'Samsara ELD equipment rental',         'Fixed', 'Subtract', 'Weekly', 25.00,  3),
  ('Liability Insurance',        'Weekly liability insurance premium',    'Fixed', 'Subtract', 'Weekly', 230.46, 4),
  ('Cargo Insurance',            'Weekly cargo insurance premium',        'Fixed', 'Subtract', 'Weekly', 42.79,  5),
  ('Plate Rental',               'License plate rental fee',             'Fixed', 'Subtract', 'Weekly', 45.00,  6),
  ('Truck Payment',              'Truck lease / purchase payment',       'Fixed', 'Subtract', 'Weekly', 0,      7)
ON CONFLICT DO NOTHING;
