import type { LoadStatus } from '@/types/dispatcher';

/** Active trip statuses — mirrors Tigerhawk Mobile `LIVE_TRACKING_ACTIVE_STATUSES`. */
const LIVE_TRACKING_ACTIVE_STATUSES: ReadonlySet<LoadStatus> = new Set([
  'Dispatched',
  'In Transit',
  'Arrived At Pickup',
  'Arrived At Delivery',
  'Arrived At Return Empty',
  'Arrived To Hook Container',
  'At Warehouse',
  'Dropped - Empty',
  'Dropped - Loaded',
  'Enroute To Drop Container',
  'Enroute To Return Empty',
]);

export type DriverLiveLocation = {
  latitude: number;
  longitude: number;
  lastSeenAt: string | null;
  accuracyM: number | null;
};

type LoadLocationRow = {
  current_latitude?: number | null;
  current_longitude?: number | null;
  last_seen_at?: string | null;
  location_accuracy_m?: number | null;
};

export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export function parseDriverLiveLocation(row: LoadLocationRow): DriverLiveLocation | null {
  const lat = row.current_latitude;
  const lng = row.current_longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!isValidCoordinate(lat, lng)) return null;

  return {
    latitude: lat,
    longitude: lng,
    lastSeenAt: row.last_seen_at ?? null,
    accuracyM:
      typeof row.location_accuracy_m === 'number' && Number.isFinite(row.location_accuracy_m)
        ? row.location_accuracy_m
        : null,
  };
}

export function isLiveTrackingActiveStatus(status: LoadStatus | null | undefined): boolean {
  if (!status) return false;
  return LIVE_TRACKING_ACTIVE_STATUSES.has(status);
}

/** Fixed locale so Node SSR and browser hydration produce identical time strings. */
const LAST_SEEN_TIME_LOCALE = 'en-US';

/** Table/list label — null until client `now` is available (avoids hydration mismatch). */
export function getDriverLastSeenLabel(
  load: LoadLocationRow & { status?: LoadStatus | null },
  nowMs: number | null = null,
): string | null {
  if (nowMs === null) return null;
  if (!isLiveTrackingActiveStatus(load.status ?? null)) return null;
  const parsed = parseDriverLiveLocation(load);
  if (!parsed?.lastSeenAt) return null;
  return formatLastSeenAt(parsed.lastSeenAt, nowMs);
}

export function formatLastSeenAt(lastSeenAt: string | null, nowMs = Date.now()): string {
  if (!lastSeenAt) return 'Unknown';
  const ts = Date.parse(lastSeenAt);
  if (!Number.isFinite(ts)) return 'Unknown';

  const elapsedMs = Math.max(0, nowMs - ts);
  if (elapsedMs < 60_000) return 'Just now';
  if (elapsedMs < 3_600_000) {
    const minutes = Math.floor(elapsedMs / 60_000);
    return `${minutes} min ago`;
  }
  return new Date(ts).toLocaleTimeString(LAST_SEEN_TIME_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
