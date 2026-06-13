import { syncVessels } from "@/lib/port-houston/sync"

const mockFetchVesselVisits = jest.fn()
const mockMapVessel = jest.fn()
const mockIsValidTerminal = jest.fn()
const mockUpsert = jest.fn()

jest.mock("@/lib/port-houston/client", () => ({
  fetchVesselVisits: (...args: unknown[]) => mockFetchVesselVisits(...args),
  fetchUnits: jest.fn(),
}))

jest.mock("@/lib/port-houston/mappers", () => ({
  mapVessel: (...args: unknown[]) => mockMapVessel(...args),
  mapUnit: jest.fn(),
  isValidTerminal: (...args: unknown[]) => mockIsValidTerminal(...args),
}))

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: mockUpsert,
    })),
  })),
}))

describe("port-houston sync", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpsert.mockResolvedValue({ error: null })
  })

  it("syncs only vessels mapped to valid terminals", async () => {
    mockFetchVesselVisits.mockResolvedValue([
      { visitId: "visit-1" },
      { visitId: "visit-2" },
    ])

    mockMapVessel
      .mockReturnValueOnce({ visit_id: "visit-1", terminal: "BCT" })
      .mockReturnValueOnce({ visit_id: "visit-2", terminal: "UNKNOWN" })

    mockIsValidTerminal
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)

    const result = await syncVessels()

    expect(result).toBe(1)
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const [rows] = mockUpsert.mock.calls[0]
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ visit_id: "visit-1", terminal: "BCT" })
  })
})
