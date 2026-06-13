'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useRef } from 'react';

type RealtimeTable =
  | 'loads'
  | 'load_documents'
  | 'containers'
  | 'vessels'
  | 'activity_log'
  | 'waiting_time_events';

type UseRealtimeRefreshOptions = {
  tables: RealtimeTable[];
  onRefresh: () => void;
  debounceMs?: number;
  /** Per-table Supabase filter, e.g. `load_id=eq.<uuid>` */
  filters?: Partial<Record<RealtimeTable, string>>;
};

/**
 * Subscribes to realtime table updates and triggers a debounced refresh callback.
 * Includes graceful reconnection if the channel enters an unhealthy state.
 */
export function useRealtimeRefresh({
  tables,
  onRefresh,
  debounceMs = 1200,
  filters,
}: UseRealtimeRefreshOptions) {
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const tablesKey = tables.join(',');
  const filtersKey = JSON.stringify(filters ?? {});

  useEffect(() => {
    const tableList = tablesKey ? (tablesKey.split(',') as RealtimeTable[]) : [];
    const parsedFilters = JSON.parse(filtersKey) as Partial<
      Record<RealtimeTable, string>
    >;
    if (!tableList.length) return;

    const supabase = createClient();
    let channel = supabase.channel(
      `live-refresh:${tablesKey}:${filtersKey}:${Date.now()}`,
    );
    let unsubscribed = false;

    const triggerRefresh = () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => {
        onRefreshRef.current();
      }, debounceMs);
    };

    const wireChannel = () => {
      for (const table of tableList) {
        const filter = parsedFilters[table];
        channel = channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            ...(filter ? { filter } : {}),
          },
          triggerRefresh,
        );
      }

      channel.subscribe((status) => {
        if (unsubscribed) return;
        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          if (reconnectTimeoutRef.current)
            clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (unsubscribed) return;
            supabase.removeChannel(channel);
            channel = supabase.channel(
              `live-refresh:${tablesKey}:${filtersKey}:${Date.now()}`,
            );
            wireChannel();
          }, 2000);
        }
      });
    };

    wireChannel();

    return () => {
      unsubscribed = true;
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [tablesKey, filtersKey, debounceMs]);
}
