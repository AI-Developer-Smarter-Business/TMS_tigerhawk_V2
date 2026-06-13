-- Task 20 — Realtime (hooks/useRealtimeRefresh.ts): add core tables to supabase_realtime
--   so postgres_changes subscriptions receive events. Idempotent.
-- Task 21 — Safety net: CREATE INDEX IF NOT EXISTS (same definitions as 20260430) for
--   environments that missed that migration; NOTICE if RPC functions are still missing
--   (apply 20260430_csv_import_staff_and_report_indexes.sql in full for RPC bodies).
-- Task 22 — No DDL: operational / RLS checklist remains in docs/RLS_SECURITY_REVIEW_T22.md.

-- ── Task 21 indexes (idempotent; duplicates definitions from 20260430) ─────────
CREATE INDEX IF NOT EXISTS idx_loads_created_at_desc ON public.loads (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ar_invoices_created_at_desc ON public.ar_invoices (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ar_invoices_open_status ON public.ar_invoices (billing_status, created_at DESC)
  WHERE billing_status IS NOT NULL
    AND billing_status NOT IN ('Paid', 'Cancelled', 'Write-off');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'import_drivers_csv_transaction'
  ) THEN
    RAISE NOTICE 'Task 21: public.import_drivers_csv_transaction(jsonb) is missing — run migration 20260430_csv_import_staff_and_report_indexes.sql';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'import_driver_groups_csv_transaction'
  ) THEN
    RAISE NOTICE 'Task 21: public.import_driver_groups_csv_transaction(jsonb) is missing — run migration 20260430_csv_import_staff_and_report_indexes.sql';
  END IF;
END $$;

-- ── Task 20: publication membership ───────────────────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication not found — skipping Realtime table add (non-standard Postgres; ignore if expected).';
    RETURN;
  END IF;

  FOREACH tbl IN ARRAY ARRAY['loads', 'containers', 'vessels', 'activity_log']
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables pt
      WHERE pt.pubname = 'supabase_realtime'
        AND pt.schemaname = 'public'
        AND pt.tablename = tbl
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    RAISE NOTICE 'Realtime: added public.% to supabase_realtime', tbl;
  END LOOP;
END $$;
