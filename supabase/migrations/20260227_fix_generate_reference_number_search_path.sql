-- ============================================================
-- Fix: generate_reference_number() function search_path
--
-- The trigger "shipments_auto_reference" fires on INSERT into loads
-- and calls generate_reference_number(). This function queries the
-- "loads" table but was created without search_path = public,
-- causing "relation loads does not exist" errors on every INSERT.
-- ============================================================

ALTER FUNCTION generate_reference_number() SET search_path = public;
