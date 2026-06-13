import { extractBearerToken } from "../get-user-from-request"

function mockRequest(authorization: string | null) {
  return {
    headers: {
      get: (name: string) => (name === "Authorization" ? authorization : null),
    },
  } as import("next/server").NextRequest
}

describe("extractBearerToken", () => {
  it("parses Bearer token", () => {
    expect(extractBearerToken(mockRequest("Bearer eyJ.test.token"))).toBe("eyJ.test.token")
  })

  it("returns null when header missing", () => {
    expect(extractBearerToken(mockRequest(null))).toBeNull()
  })
})
