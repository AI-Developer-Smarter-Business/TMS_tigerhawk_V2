-- ============================================================
-- Enable RLS on A/R, A/P, and audit tables
-- ============================================================
-- These tables were flagged as CRITICAL in Supabase security
-- alerts because RLS was disabled, allowing unrestricted access
-- via the anon key.
--
-- Pattern: All authenticated users get full CRUD access.
-- Role-based permissions (admin, accounting, dispatcher) are
-- enforced at the API route layer. RLS acts as a safety net
-- to block unauthenticated/anonymous access.
--
-- Uses DROP POLICY IF EXISTS to be idempotent (safe to re-run).
-- ============================================================

-- ============================================================
-- 1. ACCOUNTS PAYABLE TABLES
-- ============================================================

-- ap_deductions
ALTER TABLE ap_deductions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ap_deductions" ON ap_deductions;
CREATE POLICY "Authenticated users can read ap_deductions"
  ON ap_deductions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert ap_deductions" ON ap_deductions;
CREATE POLICY "Authenticated users can insert ap_deductions"
  ON ap_deductions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update ap_deductions" ON ap_deductions;
CREATE POLICY "Authenticated users can update ap_deductions"
  ON ap_deductions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete ap_deductions" ON ap_deductions;
CREATE POLICY "Authenticated users can delete ap_deductions"
  ON ap_deductions FOR DELETE TO authenticated USING (true);

-- ap_driver_pay
ALTER TABLE ap_driver_pay ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ap_driver_pay" ON ap_driver_pay;
CREATE POLICY "Authenticated users can read ap_driver_pay"
  ON ap_driver_pay FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert ap_driver_pay" ON ap_driver_pay;
CREATE POLICY "Authenticated users can insert ap_driver_pay"
  ON ap_driver_pay FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update ap_driver_pay" ON ap_driver_pay;
CREATE POLICY "Authenticated users can update ap_driver_pay"
  ON ap_driver_pay FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete ap_driver_pay" ON ap_driver_pay;
CREATE POLICY "Authenticated users can delete ap_driver_pay"
  ON ap_driver_pay FOR DELETE TO authenticated USING (true);

-- ap_dynamic_expenses
ALTER TABLE ap_dynamic_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ap_dynamic_expenses" ON ap_dynamic_expenses;
CREATE POLICY "Authenticated users can read ap_dynamic_expenses"
  ON ap_dynamic_expenses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert ap_dynamic_expenses" ON ap_dynamic_expenses;
CREATE POLICY "Authenticated users can insert ap_dynamic_expenses"
  ON ap_dynamic_expenses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update ap_dynamic_expenses" ON ap_dynamic_expenses;
CREATE POLICY "Authenticated users can update ap_dynamic_expenses"
  ON ap_dynamic_expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete ap_dynamic_expenses" ON ap_dynamic_expenses;
CREATE POLICY "Authenticated users can delete ap_dynamic_expenses"
  ON ap_dynamic_expenses FOR DELETE TO authenticated USING (true);

-- ap_settlements
ALTER TABLE ap_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ap_settlements" ON ap_settlements;
CREATE POLICY "Authenticated users can read ap_settlements"
  ON ap_settlements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert ap_settlements" ON ap_settlements;
CREATE POLICY "Authenticated users can insert ap_settlements"
  ON ap_settlements FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update ap_settlements" ON ap_settlements;
CREATE POLICY "Authenticated users can update ap_settlements"
  ON ap_settlements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete ap_settlements" ON ap_settlements;
CREATE POLICY "Authenticated users can delete ap_settlements"
  ON ap_settlements FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 2. ACCOUNTS RECEIVABLE TABLES
-- ============================================================

-- ar_invoices
ALTER TABLE ar_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ar_invoices" ON ar_invoices;
CREATE POLICY "Authenticated users can read ar_invoices"
  ON ar_invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert ar_invoices" ON ar_invoices;
CREATE POLICY "Authenticated users can insert ar_invoices"
  ON ar_invoices FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update ar_invoices" ON ar_invoices;
CREATE POLICY "Authenticated users can update ar_invoices"
  ON ar_invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete ar_invoices" ON ar_invoices;
CREATE POLICY "Authenticated users can delete ar_invoices"
  ON ar_invoices FOR DELETE TO authenticated USING (true);

-- ar_invoice_lines
ALTER TABLE ar_invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ar_invoice_lines" ON ar_invoice_lines;
CREATE POLICY "Authenticated users can read ar_invoice_lines"
  ON ar_invoice_lines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert ar_invoice_lines" ON ar_invoice_lines;
CREATE POLICY "Authenticated users can insert ar_invoice_lines"
  ON ar_invoice_lines FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update ar_invoice_lines" ON ar_invoice_lines;
CREATE POLICY "Authenticated users can update ar_invoice_lines"
  ON ar_invoice_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete ar_invoice_lines" ON ar_invoice_lines;
CREATE POLICY "Authenticated users can delete ar_invoice_lines"
  ON ar_invoice_lines FOR DELETE TO authenticated USING (true);

-- ar_credit_memos
ALTER TABLE ar_credit_memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ar_credit_memos" ON ar_credit_memos;
CREATE POLICY "Authenticated users can read ar_credit_memos"
  ON ar_credit_memos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert ar_credit_memos" ON ar_credit_memos;
CREATE POLICY "Authenticated users can insert ar_credit_memos"
  ON ar_credit_memos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update ar_credit_memos" ON ar_credit_memos;
CREATE POLICY "Authenticated users can update ar_credit_memos"
  ON ar_credit_memos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete ar_credit_memos" ON ar_credit_memos;
CREATE POLICY "Authenticated users can delete ar_credit_memos"
  ON ar_credit_memos FOR DELETE TO authenticated USING (true);

-- ar_payments
ALTER TABLE ar_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ar_payments" ON ar_payments;
CREATE POLICY "Authenticated users can read ar_payments"
  ON ar_payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert ar_payments" ON ar_payments;
CREATE POLICY "Authenticated users can insert ar_payments"
  ON ar_payments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update ar_payments" ON ar_payments;
CREATE POLICY "Authenticated users can update ar_payments"
  ON ar_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete ar_payments" ON ar_payments;
CREATE POLICY "Authenticated users can delete ar_payments"
  ON ar_payments FOR DELETE TO authenticated USING (true);

-- ar_payment_applications
ALTER TABLE ar_payment_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ar_payment_applications" ON ar_payment_applications;
CREATE POLICY "Authenticated users can read ar_payment_applications"
  ON ar_payment_applications FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert ar_payment_applications" ON ar_payment_applications;
CREATE POLICY "Authenticated users can insert ar_payment_applications"
  ON ar_payment_applications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update ar_payment_applications" ON ar_payment_applications;
CREATE POLICY "Authenticated users can update ar_payment_applications"
  ON ar_payment_applications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete ar_payment_applications" ON ar_payment_applications;
CREATE POLICY "Authenticated users can delete ar_payment_applications"
  ON ar_payment_applications FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. AUDIT TABLES
-- ============================================================

-- chassis_audit_uploads
ALTER TABLE chassis_audit_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read chassis_audit_uploads" ON chassis_audit_uploads;
CREATE POLICY "Authenticated users can read chassis_audit_uploads"
  ON chassis_audit_uploads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert chassis_audit_uploads" ON chassis_audit_uploads;
CREATE POLICY "Authenticated users can insert chassis_audit_uploads"
  ON chassis_audit_uploads FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update chassis_audit_uploads" ON chassis_audit_uploads;
CREATE POLICY "Authenticated users can update chassis_audit_uploads"
  ON chassis_audit_uploads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete chassis_audit_uploads" ON chassis_audit_uploads;
CREATE POLICY "Authenticated users can delete chassis_audit_uploads"
  ON chassis_audit_uploads FOR DELETE TO authenticated USING (true);

-- waiting_time_events
ALTER TABLE waiting_time_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read waiting_time_events" ON waiting_time_events;
CREATE POLICY "Authenticated users can read waiting_time_events"
  ON waiting_time_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert waiting_time_events" ON waiting_time_events;
CREATE POLICY "Authenticated users can insert waiting_time_events"
  ON waiting_time_events FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update waiting_time_events" ON waiting_time_events;
CREATE POLICY "Authenticated users can update waiting_time_events"
  ON waiting_time_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can delete waiting_time_events" ON waiting_time_events;
CREATE POLICY "Authenticated users can delete waiting_time_events"
  ON waiting_time_events FOR DELETE TO authenticated USING (true);
