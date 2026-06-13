-- ============================================================
-- Fix: Add missing INSERT and DELETE RLS policies for loads table
--
-- The loads table had RLS enabled with only SELECT and UPDATE policies.
-- Missing INSERT policy caused POST /api/dispatcher/loads to fail with
--   "relation 'loads' does not exist" (42P01) — a misleading error from
--   PostgREST when RLS blocks the operation with no matching policy.
-- Missing DELETE policy caused DELETE to return 200 but silently
--   affect 0 rows, so loads were never actually deleted.
-- ============================================================

-- INSERT policy: admin and dispatcher can create loads
DROP POLICY IF EXISTS "Staff insert loads" ON loads;
CREATE POLICY "Staff insert loads"
  ON loads FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher'));

-- DELETE policy: admin and dispatcher can delete loads
DROP POLICY IF EXISTS "Staff delete loads" ON loads;
CREATE POLICY "Staff delete loads"
  ON loads FOR DELETE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher'));

-- Also add a SELECT policy for drivers so they can view their assigned loads
DROP POLICY IF EXISTS "Drivers read own loads" ON loads;
CREATE POLICY "Drivers read own loads"
  ON loads FOR SELECT TO authenticated
  USING (
    (select get_user_role()) = 'driver'
    AND driver_id = auth.uid()
  );
