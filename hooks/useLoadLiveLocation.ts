'use client';

import { createClient } from '@/lib/supabase/client';
import {
  parseDriverLiveLocation,
  type DriverLiveLocation,
} from '@/lib/live-tracking/driver-location';
import { useEffect, useState } from 'react';

/**
 * Subscribes to Supabase Realtime `loads` UPDATE for one load and patches live GPS columns.
 * PP2 Semana 8 — task 8.12.
 */
export function useLoadLiveLocation(
  loadId: string,
  initial: DriverLiveLocation | null,
): DriverLiveLocation | null {
  const [location, setLocation] = useState(initial);

  useEffect(() => {
    setLocation(initial);
  }, [
    loadId,
    initial?.latitude,
    initial?.longitude,
    initial?.lastSeenAt,
    initial?.accuracyM,
  ]);

  useEffect(() => {
    if (!loadId) return;

    const supabase = createClient();
    let channel = supabase.channel(`load-live-location:${loadId}:${Date.now()}`);
    let unsubscribed = false;

    const wire = () => {
      channel = channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'loads',
          filter: `id=eq.${loadId}`,
        },
        (payload) => {
          const next = parseDriverLiveLocation(payload.new as LoadLocationRow);
          if (next) setLocation(next);
        },
      );

      channel.subscribe((status) => {
        if (unsubscribed) return;
        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setTimeout(() => {
            if (unsubscribed) return;
            supabase.removeChannel(channel);
            channel = supabase.channel(
              `load-live-location:${loadId}:${Date.now()}`,
            );
            wire();
          }, 2000);
        }
      });
    };

    wire();

    return () => {
      unsubscribed = true;
      supabase.removeChannel(channel);
    };
  }, [loadId]);

  return location;
}

type LoadLocationRow = {
  current_latitude?: number | null;
  current_longitude?: number | null;
  last_seen_at?: string | null;
  location_accuracy_m?: number | null;
};
