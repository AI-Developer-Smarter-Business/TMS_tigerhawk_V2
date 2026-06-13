-- Add 'per_move' to the unit_of_measure CHECK constraint on rate_profile_charges
-- The original constraint only included: per_day, per_hour, per_pounds, per_miles, per_road_toll_miles, fixed, percentage, per_15min
-- PortPro also uses 'per_move' which was missing

ALTER TABLE rate_profile_charges
  DROP CONSTRAINT IF EXISTS rate_profile_charges_unit_of_measure_check;

ALTER TABLE rate_profile_charges
  ADD CONSTRAINT rate_profile_charges_unit_of_measure_check
  CHECK (unit_of_measure IN ('per_move', 'per_day', 'per_hour', 'per_pounds', 'per_miles', 'per_road_toll_miles', 'fixed', 'percentage', 'per_15min'));
