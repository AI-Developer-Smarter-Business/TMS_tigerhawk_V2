import {
  formatLastSeenAt,
  getDriverLastSeenLabel,
  isLiveTrackingActiveStatus,
  parseDriverLiveLocation,
} from '../driver-location';

describe('parseDriverLiveLocation', () => {
  it('returns null when coordinates are missing', () => {
    expect(parseDriverLiveLocation({})).toBeNull();
  });

  it('parses valid coordinates', () => {
    expect(
      parseDriverLiveLocation({
        current_latitude: 29.76,
        current_longitude: -95.36,
        last_seen_at: '2026-06-22T12:00:00.000Z',
        location_accuracy_m: 12,
      }),
    ).toEqual({
      latitude: 29.76,
      longitude: -95.36,
      lastSeenAt: '2026-06-22T12:00:00.000Z',
      accuracyM: 12,
    });
  });

  it('rejects 0,0 coordinates', () => {
    expect(
      parseDriverLiveLocation({ current_latitude: 0, current_longitude: 0 }),
    ).toBeNull();
  });
});

describe('getDriverLastSeenLabel', () => {
  it('returns label for active trip with last_seen_at', () => {
    const now = Date.parse('2026-06-22T12:05:00.000Z');
    expect(
      getDriverLastSeenLabel(
        {
          status: 'In Transit',
          current_latitude: 29.76,
          current_longitude: -95.36,
          last_seen_at: '2026-06-22T12:04:30.000Z',
        },
        now,
      ),
    ).toBe('Just now');
  });

  it('returns null when load is completed', () => {
    expect(
      getDriverLastSeenLabel({
        status: 'Completed',
        current_latitude: 29.76,
        current_longitude: -95.36,
        last_seen_at: '2026-06-22T12:04:30.000Z',
      }),
    ).toBeNull();
  });

  it('returns null when nowMs is null (SSR / pre-hydration)', () => {
    expect(
      getDriverLastSeenLabel(
        {
          status: 'In Transit',
          current_latitude: 29.76,
          current_longitude: -95.36,
          last_seen_at: '2026-06-22T12:04:30.000Z',
        },
        null,
      ),
    ).toBeNull();
  });
});

describe('formatLastSeenAt', () => {
  const now = Date.parse('2026-06-22T12:05:00.000Z');

  it('returns Just now under one minute', () => {
    expect(
      formatLastSeenAt('2026-06-22T12:04:30.000Z', now),
    ).toBe('Just now');
  });

  it('returns minutes ago under one hour', () => {
    expect(
      formatLastSeenAt('2026-06-22T11:50:00.000Z', now),
    ).toBe('15 min ago');
  });

  it('uses en-US 12-hour clock for older pings', () => {
    expect(
      formatLastSeenAt('2026-06-22T08:00:00.000Z', now),
    ).toBe(
      new Date('2026-06-22T08:00:00.000Z').toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    );
  });
});

describe('isLiveTrackingActiveStatus', () => {
  it('includes In Transit', () => {
    expect(isLiveTrackingActiveStatus('In Transit')).toBe(true);
  });

  it('excludes Completed', () => {
    expect(isLiveTrackingActiveStatus('Completed')).toBe(false);
  });
});
