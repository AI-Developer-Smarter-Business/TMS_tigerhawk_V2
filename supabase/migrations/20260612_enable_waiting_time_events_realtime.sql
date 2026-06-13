-- Enable Supabase Realtime for waiting_time_events so TMS wait timers
-- update live when drivers start/stop from the mobile app.

ALTER TABLE public.waiting_time_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication not found — skipping waiting_time_events Realtime add.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables pt
    WHERE pt.pubname = 'supabase_realtime'
      AND pt.schemaname = 'public'
      AND pt.tablename = 'waiting_time_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.waiting_time_events;
    RAISE NOTICE 'Realtime: added public.waiting_time_events to supabase_realtime';
  END IF;
END $$;
