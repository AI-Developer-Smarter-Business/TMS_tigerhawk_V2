jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

import type { NextRequest } from 'next/server';

import { PATCH } from '@/app/api/dispatcher/loads/[id]/status/route';

const mockGetUser = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(async () => ({ error: null })),
      upsert: jest.fn(async () => ({ error: null })),
    })),
  })),
}));

jest.mock('@/lib/email/sendTemplateEmail', () => ({
  sendTemplateEmail: jest.fn(async () => undefined),
}));

jest.mock('@/lib/transitions', () => ({
  getEffectiveTransitions: jest.fn(async () => ({
    Assigned: ['In Transit', 'Completed'],
  })),
}));

jest.mock('@/lib/validations/validate', () => ({
  validateBody: jest.fn(() => ({
    success: true,
    data: { status: 'In Transit' },
  })),
}));

jest.mock('@/lib/loadHolds', () => ({
  getActiveHoldKeys: jest.fn(() => ['freight_hold']),
}));

type SingleResult = { data: unknown; error: unknown };

function mockPatchRequest(body: { status: string }): NextRequest {
  return {
    headers: {
      get: () => null,
    },
    json: async () => body,
  } as unknown as NextRequest;
}

function buildSingleQuery(result: SingleResult) {
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(async () => result),
      })),
    })),
  };
}

describe('PATCH /api/dispatcher/loads/[id]/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 for non-admin users when active holds exist', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'dispatcher@test.com' } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'loads') {
        return buildSingleQuery({
          data: {
            id: 'load-1',
            status: 'Assigned',
            driver_id: 'user-1',
            freight_hold: 'hold',
            carrier_hold: false,
          },
          error: null,
        });
      }

      if (table === 'user_profiles') {
        return buildSingleQuery({
          data: { role: 'dispatcher' },
          error: null,
        });
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await PATCH(mockPatchRequest({ status: 'In Transit' }), {
      params: Promise.resolve({ id: 'load-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'ACTIVE_HOLDS',
      activeHolds: ['freight_hold'],
    });
  });
});
