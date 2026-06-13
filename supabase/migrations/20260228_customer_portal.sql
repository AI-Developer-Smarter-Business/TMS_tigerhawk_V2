-- ============================================================
-- Customer Portal: Database Migration
-- Adds customer_id to user_profiles and RLS policies for
-- customer role access to loads, documents, containers, etc.
-- ============================================================

-- 1. Add customer_id column to user_profiles
--    Links a portal user to their customer record
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_customer_id ON user_profiles(customer_id);

-- 2. Helper function: get the customer_id for the current auth user
--    Cached per query via (SELECT ...) wrapper pattern
CREATE OR REPLACE FUNCTION get_user_customer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_id FROM user_profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- RLS Policies for Customer Role
-- ============================================================

-- 3. Loads: customers can read their own loads
CREATE POLICY "Customers read own loads"
  ON loads
  FOR SELECT
  TO authenticated
  USING (
    (select get_user_role()) = 'customer'
    AND customer_id = (select get_user_customer_id())
  );

-- 4. Load Documents: customers can read documents for their loads
CREATE POLICY "Customers read own load documents"
  ON load_documents
  FOR SELECT
  TO authenticated
  USING (
    (select get_user_role()) = 'customer'
    AND load_id IN (
      SELECT id FROM loads
      WHERE customer_id = (select get_user_customer_id())
    )
  );

-- 5. Containers: customers can read containers linked to their loads
CREATE POLICY "Customers read own containers"
  ON containers
  FOR SELECT
  TO authenticated
  USING (
    (select get_user_role()) = 'customer'
    AND id IN (
      SELECT container_id FROM loads
      WHERE customer_id = (select get_user_customer_id())
        AND container_id IS NOT NULL
    )
  );

-- 6. Customers table: customer users can read their own customer record
CREATE POLICY "Customers read own record"
  ON customers
  FOR SELECT
  TO authenticated
  USING (
    (select get_user_role()) = 'customer'
    AND id = (select get_user_customer_id())
  );

-- 7. Vessels: customers can read vessels linked to their containers
CREATE POLICY "Customers read related vessels"
  ON vessels
  FOR SELECT
  TO authenticated
  USING (
    (select get_user_role()) = 'customer'
    AND id IN (
      SELECT c.vessel_id FROM containers c
      JOIN loads l ON l.container_id = c.id
      WHERE l.customer_id = (select get_user_customer_id())
        AND c.vessel_id IS NOT NULL
    )
  );
