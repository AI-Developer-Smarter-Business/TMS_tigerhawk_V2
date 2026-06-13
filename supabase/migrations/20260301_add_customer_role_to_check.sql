-- ============================================================
-- Add 'customer' to the user_profiles role check constraint
-- The existing constraint only allows: admin, dispatcher, accounting, driver
-- We need to add 'customer' for portal users
-- ============================================================

-- Drop the existing check constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Re-create with 'customer' included
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'dispatcher', 'accounting', 'driver', 'customer'));
