-- Semana 2 / Tarea 8: provenance for stored coordinates on pay-rate / zone map anchors.
-- See docs/SUGGESTION_FOR_RESOLVING_GEOLOCATION.md and TAREAS_TRELLO.md (Tarea 8).

ALTER TABLE lane_origins
  ADD COLUMN IF NOT EXISTS coordinate_source TEXT,
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

ALTER TABLE lane_origins DROP CONSTRAINT IF EXISTS lane_origins_coordinate_source_check;
ALTER TABLE lane_origins ADD CONSTRAINT lane_origins_coordinate_source_check CHECK (
  coordinate_source IS NULL
  OR coordinate_source IN (
    'nominatim',
    'manual',
    'import',
    'external_api',
    'legacy'
  )
);

COMMENT ON COLUMN lane_origins.coordinate_source IS
  'How latitude/longitude were obtained: nominatim, manual, import, external_api, or legacy (rows that already had coords before this column existed).';
COMMENT ON COLUMN lane_origins.geocoded_at IS
  'Timestamp when coordinates were last set or confirmed.';

-- Rows that already had coordinates: mark as legacy for support / regression tracing.
UPDATE lane_origins
SET coordinate_source = 'legacy'
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND coordinate_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_lane_origins_active_missing_coords
  ON lane_origins (id)
  WHERE is_active = true
    AND (latitude IS NULL OR longitude IS NULL);
