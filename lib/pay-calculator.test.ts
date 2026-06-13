import { describeTrigger, evaluateAccessorialTrigger } from "@/lib/pay-calculator"

describe("pay-calculator", () => {
  it("applies per-hour event threshold by excess units", () => {
    const result = evaluateAccessorialTrigger(
      {
        id: "acc-1",
        code: "DET",
        name: "Detention",
        charge_type: "per_hour",
        default_amount: 45,
        trigger_type: "event_threshold",
        trigger_config: {
          field: "detention_hours",
          operator: ">",
          threshold: 2,
        },
        container_sizes: null,
        load_types: null,
      },
      { detention_hours: 5 }
    )

    expect(result).toEqual({ triggered: true, amount: 135 })
  })

  it("does not trigger when container size restriction mismatches", () => {
    const result = evaluateAccessorialTrigger(
      {
        id: "acc-2",
        code: "HZ",
        name: "Hazmat",
        charge_type: "flat",
        default_amount: 150,
        trigger_type: "load_property",
        trigger_config: {
          field: "is_hazmat",
          value: true,
        },
        container_sizes: ["40"],
        load_types: null,
      },
      {
        is_hazmat: true,
        container_size: "20",
      }
    )

    expect(result).toEqual({ triggered: false, amount: 0 })
  })

  it("formats event threshold trigger description with labels", () => {
    expect(
      describeTrigger("event_threshold", {
        field: "detention_hours",
        operator: ">=",
        threshold: 1,
      })
    ).toBe("When detention >= 1 hrs")
  })
})
