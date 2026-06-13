import {
  parseDriverCsvRows,
  parseDriverGroupCsvRows,
  driverRowToRpcPayload,
} from "./staff-schemas"

describe("staff-csv schemas", () => {
  it("parses valid driver rows and detects duplicate phones", () => {
    const ok = parseDriverCsvRows([
      {
        first_name: "A",
        last_name: "B",
        phone: "111",
        status: "Available",
      },
    ])
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(driverRowToRpcPayload(ok.data[0]).phone).toBe("111")
    }

    const dup = parseDriverCsvRows([
      { name: "X", phone: "222", status: "Available" },
      { name: "Y", phone: "222", status: "Available" },
    ])
    expect(dup.ok).toBe(false)
  })

  it("parses driver group rows", () => {
    const r = parseDriverGroupCsvRows([
      {
        name: "G1",
        pay_type: "per_move",
        base_rate: "100",
        is_company_driver: "false",
      },
    ])
    expect(r.ok).toBe(true)
  })
})
