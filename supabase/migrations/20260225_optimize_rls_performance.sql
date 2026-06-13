-- ============================================================
-- Optimize RLS Performance: Consolidate + Auth Function Caching
-- ============================================================
-- Fixes Supabase lint warnings:
--   1. Multiple Permissive Policies — consolidate overlapping
--      policies into single policies per role+action
--   2. Auth RLS Initialization Plan — wrap auth.uid() and
--      get_user_role() in (SELECT ...) so Postgres evaluates
--      them once per query instead of once per row
--   3. Duplicate Indexes — drop redundant indexes
--
-- All DROP POLICY IF EXISTS for idempotency (safe to re-run).
-- ============================================================


-- ============================================================
-- SECTION 1: Tables from our migrations
-- Fix: "read" + "write (ALL)" overlap — drop the separate read
-- policy since the ALL policy already covers SELECT.
-- ============================================================

-- accessorial_group_rules
DROP POLICY IF EXISTS "Allow authenticated read on accessorial_group_rules" ON accessorial_group_rules;

-- accessorials
DROP POLICY IF EXISTS "Allow authenticated read on accessorials" ON accessorials;

-- driver_group_assignments
DROP POLICY IF EXISTS "Allow authenticated read on driver_group_assignments" ON driver_group_assignments;

-- driver_groups
DROP POLICY IF EXISTS "Allow authenticated read on driver_groups" ON driver_groups;

-- lane_origins
DROP POLICY IF EXISTS "Allow authenticated read on lane_origins" ON lane_origins;

-- lane_rates
DROP POLICY IF EXISTS "Allow authenticated read on lane_rates" ON lane_rates;

-- lane_zones
DROP POLICY IF EXISTS "Allow authenticated read on lane_zones" ON lane_zones;

-- port_houston_sync: has duplicate SELECT policies
DROP POLICY IF EXISTS "authenticated_read" ON port_houston_sync;

-- rate_profile_driver_groups: ALL policy covers SELECT already
DROP POLICY IF EXISTS "Authenticated users can view rate profile driver groups" ON rate_profile_driver_groups;


-- ============================================================
-- SECTION 2: Dashboard-created role-based policies
-- Fix: Consolidate multiple permissive policies per action into
-- single policies, and wrap auth functions in (SELECT ...)
-- for once-per-query evaluation instead of once-per-row.
--
-- NOTE: Using separate INSERT/UPDATE/DELETE instead of FOR ALL
-- to avoid creating a new overlap with the SELECT policy.
-- ============================================================

-- ----------------------------------------------------------
-- customers
-- Old: "Admin full access" (ALL), "Staff read" (SELECT),
--   "Dispatcher read" (SELECT), "Staff write" (INSERT),
--   "Staff update" (UPDATE), "Admin delete" (DELETE)
-- New: One policy per action, consolidated roles
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access on customers" ON customers;
DROP POLICY IF EXISTS "Staff read customers" ON customers;
DROP POLICY IF EXISTS "Dispatcher read customers" ON customers;
DROP POLICY IF EXISTS "Staff write customers" ON customers;
DROP POLICY IF EXISTS "Staff update customers" ON customers;
DROP POLICY IF EXISTS "Admin delete customers" ON customers;

CREATE POLICY "Authenticated read customers"
  ON customers FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff insert customers"
  ON customers FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff update customers"
  ON customers FOR UPDATE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'))
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Admin delete customers"
  ON customers FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'admin');

-- ----------------------------------------------------------
-- terminals
-- Old: "Admin full access" (ALL), "Dispatcher read" (SELECT)
-- New: Separate per-action policies, no ALL
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access on terminals" ON terminals;
DROP POLICY IF EXISTS "Dispatcher read terminals" ON terminals;

CREATE POLICY "Authenticated read terminals"
  ON terminals FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Admin insert terminals"
  ON terminals FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) = 'admin');

CREATE POLICY "Admin update terminals"
  ON terminals FOR UPDATE TO authenticated
  USING ((select get_user_role()) = 'admin')
  WITH CHECK ((select get_user_role()) = 'admin');

CREATE POLICY "Admin delete terminals"
  ON terminals FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'admin');

-- ----------------------------------------------------------
-- warehouses
-- Old: "Admin full access" (ALL), "Dispatcher read" (SELECT)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access on warehouses" ON warehouses;
DROP POLICY IF EXISTS "Dispatcher read warehouses" ON warehouses;

CREATE POLICY "Authenticated read warehouses"
  ON warehouses FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Admin insert warehouses"
  ON warehouses FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) = 'admin');

CREATE POLICY "Admin update warehouses"
  ON warehouses FOR UPDATE TO authenticated
  USING ((select get_user_role()) = 'admin')
  WITH CHECK ((select get_user_role()) = 'admin');

CREATE POLICY "Admin delete warehouses"
  ON warehouses FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'admin');

-- ----------------------------------------------------------
-- yards
-- Old: "Admin full access" (ALL), "Dispatcher read" (SELECT)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access on yards" ON yards;
DROP POLICY IF EXISTS "Dispatcher read yards" ON yards;

CREATE POLICY "Authenticated read yards"
  ON yards FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Admin insert yards"
  ON yards FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) = 'admin');

CREATE POLICY "Admin update yards"
  ON yards FOR UPDATE TO authenticated
  USING ((select get_user_role()) = 'admin')
  WITH CHECK ((select get_user_role()) = 'admin');

CREATE POLICY "Admin delete yards"
  ON yards FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'admin');

-- ----------------------------------------------------------
-- loads
-- Old: "Staff read all shipments" (SELECT),
--      "Staff update shipments" (UPDATE)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Staff read all shipments" ON loads;
DROP POLICY IF EXISTS "Staff update shipments" ON loads;

CREATE POLICY "Staff read all shipments"
  ON loads FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff update shipments"
  ON loads FOR UPDATE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'))
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

-- ----------------------------------------------------------
-- drivers
-- Old: "Staff read all drivers" (SELECT)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Staff read all drivers" ON drivers;

CREATE POLICY "Staff read all drivers"
  ON drivers FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

-- ----------------------------------------------------------
-- documents
-- Old: "Staff read documents" (SELECT)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Staff read documents" ON documents;

CREATE POLICY "Staff read documents"
  ON documents FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

-- ----------------------------------------------------------
-- user_profiles
-- Old: "Users read own profile" (SELECT) with auth.uid()
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Users read own profile" ON user_profiles;

CREATE POLICY "Users read own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

-- ----------------------------------------------------------
-- user_preferences
-- Old: 4 separate policies (read/insert/update/delete) with auth.uid()
-- New: Single ALL policy with (select auth.uid()) — no overlap
--      issue because there's only one policy total
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;

CREATE POLICY "Users manage own preferences"
  ON user_preferences FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ----------------------------------------------------------
-- Load sub-tables: freight_descriptions, load_audit_log,
-- load_billing, load_documents, load_messages, load_payments
--
-- Old: "Staff full access" (ALL) + "Drivers read their load data" (SELECT)
-- Issues: (1) ALL overlaps with SELECT for staff users
--         (2) auth functions not wrapped in (select ...)
--
-- New: Single SELECT (staff + driver roles can read),
--      separate INSERT/UPDATE/DELETE for staff only.
--      All auth functions wrapped in (select ...).
-- ----------------------------------------------------------

-- freight_descriptions
DROP POLICY IF EXISTS "Staff full access on freight_descriptions" ON freight_descriptions;
DROP POLICY IF EXISTS "Drivers read their load data on freight_descriptions" ON freight_descriptions;

CREATE POLICY "Authenticated read freight_descriptions"
  ON freight_descriptions FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting', 'driver'));

CREATE POLICY "Staff insert freight_descriptions"
  ON freight_descriptions FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff update freight_descriptions"
  ON freight_descriptions FOR UPDATE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'))
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff delete freight_descriptions"
  ON freight_descriptions FOR DELETE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

-- load_audit_log
DROP POLICY IF EXISTS "Staff full access on load_audit_log" ON load_audit_log;
DROP POLICY IF EXISTS "Drivers read their load data on load_audit_log" ON load_audit_log;

CREATE POLICY "Authenticated read load_audit_log"
  ON load_audit_log FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting', 'driver'));

CREATE POLICY "Staff insert load_audit_log"
  ON load_audit_log FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff update load_audit_log"
  ON load_audit_log FOR UPDATE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'))
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff delete load_audit_log"
  ON load_audit_log FOR DELETE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

-- load_billing
DROP POLICY IF EXISTS "Staff full access on load_billing" ON load_billing;
DROP POLICY IF EXISTS "Drivers read their load data on load_billing" ON load_billing;

CREATE POLICY "Authenticated read load_billing"
  ON load_billing FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting', 'driver'));

CREATE POLICY "Staff insert load_billing"
  ON load_billing FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff update load_billing"
  ON load_billing FOR UPDATE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'))
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff delete load_billing"
  ON load_billing FOR DELETE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

-- load_documents
DROP POLICY IF EXISTS "Staff full access on load_documents" ON load_documents;
DROP POLICY IF EXISTS "Drivers read their load data on load_documents" ON load_documents;

CREATE POLICY "Authenticated read load_documents"
  ON load_documents FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting', 'driver'));

CREATE POLICY "Staff insert load_documents"
  ON load_documents FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff update load_documents"
  ON load_documents FOR UPDATE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'))
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff delete load_documents"
  ON load_documents FOR DELETE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

-- load_messages
DROP POLICY IF EXISTS "Staff full access on load_messages" ON load_messages;
DROP POLICY IF EXISTS "Drivers read their load data on load_messages" ON load_messages;

CREATE POLICY "Authenticated read load_messages"
  ON load_messages FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting', 'driver'));

CREATE POLICY "Staff insert load_messages"
  ON load_messages FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff update load_messages"
  ON load_messages FOR UPDATE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'))
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff delete load_messages"
  ON load_messages FOR DELETE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

-- load_payments
DROP POLICY IF EXISTS "Staff full access on load_payments" ON load_payments;
DROP POLICY IF EXISTS "Drivers read their load data on load_payments" ON load_payments;

CREATE POLICY "Authenticated read load_payments"
  ON load_payments FOR SELECT TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting', 'driver'));

CREATE POLICY "Staff insert load_payments"
  ON load_payments FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff update load_payments"
  ON load_payments FOR UPDATE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'))
  WITH CHECK ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));

CREATE POLICY "Staff delete load_payments"
  ON load_payments FOR DELETE TO authenticated
  USING ((select get_user_role()) IN ('admin', 'dispatcher', 'accounting'));


-- ============================================================
-- SECTION 3: Drop duplicate indexes on containers
-- ============================================================

-- containers has both containers_status_idx and idx_containers_status (identical)
DROP INDEX IF EXISTS containers_status_idx;

-- containers has both containers_container_number_key (UNIQUE constraint)
-- and containers_number_idx (regular index) — the UNIQUE constraint
-- already creates an index, so the manual one is redundant
DROP INDEX IF EXISTS containers_number_idx;
