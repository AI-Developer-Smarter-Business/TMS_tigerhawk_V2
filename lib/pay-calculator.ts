// lib/pay-calculator.ts
// Core pay calculation logic for the driver pay system

export type LoadProperties = {
  is_hazmat?: boolean
  is_overweight?: boolean
  is_reefer?: boolean
  is_pre_pull?: boolean
  is_chassis_split?: boolean
  detention_hours?: number
  yard_storage_days?: number
  container_size?: string // "20", "40", "45"
  load_type?: string // "Import", "Export"
  delivery_location_type?: string // "residential", "warehouse", "port"
}

export type AccessorialResult = {
  code: string
  name: string
  amount: number
  charge_type: string
}

export type PayCalculationResult = {
  base_pay: number
  base_description: string
  accessorials: AccessorialResult[]
  accessorial_total: number
  total_pay: number
}

type TriggerConfig = {
  field?: string
  value?: unknown
  operator?: string
  threshold?: number
  location_type?: string
  sizes?: string[]
  types?: string[]
}

type Accessorial = {
  id: string
  code: string
  name: string
  charge_type: string
  default_amount: number
  trigger_type: string
  trigger_config: TriggerConfig
  container_sizes: string[] | null
  load_types: string[] | null
}

/**
 * Evaluate whether an accessorial should trigger based on load properties
 */
export function evaluateAccessorialTrigger(
  accessorial: Accessorial,
  loadProperties: LoadProperties
): { triggered: boolean; amount: number } {
  const config = accessorial.trigger_config || {}

  // Check container size restriction first
  if (accessorial.container_sizes && accessorial.container_sizes.length > 0) {
    if (!loadProperties.container_size || !accessorial.container_sizes.includes(loadProperties.container_size)) {
      return { triggered: false, amount: 0 }
    }
  }

  // Check load type restriction
  if (accessorial.load_types && accessorial.load_types.length > 0) {
    if (!loadProperties.load_type || !accessorial.load_types.includes(loadProperties.load_type)) {
      return { triggered: false, amount: 0 }
    }
  }

  switch (accessorial.trigger_type) {
    case "load_property": {
      const field = config.field as keyof LoadProperties
      if (!field) return { triggered: false, amount: 0 }
      const actualValue = loadProperties[field]
      const expectedValue = config.value
      if (actualValue === expectedValue) {
        return { triggered: true, amount: accessorial.default_amount }
      }
      return { triggered: false, amount: 0 }
    }

    case "event_threshold": {
      const field = config.field as keyof LoadProperties
      if (!field) return { triggered: false, amount: 0 }
      const actualValue = loadProperties[field]
      if (typeof actualValue !== "number") return { triggered: false, amount: 0 }

      const threshold = config.threshold ?? 0
      const operator = config.operator ?? ">"

      let exceeded = false
      switch (operator) {
        case ">": exceeded = actualValue > threshold; break
        case ">=": exceeded = actualValue >= threshold; break
        case "=": exceeded = actualValue === threshold; break
        case "<": exceeded = actualValue < threshold; break
        default: exceeded = actualValue > threshold
      }

      if (!exceeded) return { triggered: false, amount: 0 }

      // For per_hour charges, multiply by the excess time
      if (accessorial.charge_type === "per_hour") {
        const excessTime = Math.max(0, actualValue - threshold)
        return { triggered: true, amount: accessorial.default_amount * excessTime }
      }

      return { triggered: true, amount: accessorial.default_amount }
    }

    case "location_type": {
      const locationType = config.location_type
      if (!locationType) return { triggered: false, amount: 0 }
      if (loadProperties.delivery_location_type === locationType) {
        return { triggered: true, amount: accessorial.default_amount }
      }
      return { triggered: false, amount: 0 }
    }

    case "container_size": {
      // Already handled by the restriction check above
      // If we got here, the container size matched
      return { triggered: true, amount: accessorial.default_amount }
    }

    case "load_type": {
      // Already handled by the restriction check above
      return { triggered: true, amount: accessorial.default_amount }
    }

    case "manual": {
      // Manual accessorials are never auto-triggered
      return { triggered: false, amount: 0 }
    }

    default:
      return { triggered: false, amount: 0 }
  }
}

/**
 * Format a human-readable trigger description
 */
export function describeTrigger(triggerType: string, triggerConfig: TriggerConfig): string {
  switch (triggerType) {
    case "load_property": {
      const field = triggerConfig.field || ""
      const labels: Record<string, string> = {
        is_hazmat: "load is hazmat",
        is_overweight: "load is overweight",
        is_reefer: "load is reefer",
        is_pre_pull: "pre-pull required",
        is_chassis_split: "chassis split required",
      }
      return `When ${labels[field] || field}`
    }
    case "event_threshold": {
      const field = triggerConfig.field || ""
      const op = triggerConfig.operator || ">"
      const threshold = triggerConfig.threshold ?? 0
      const fieldLabels: Record<string, string> = {
        detention_hours: "detention",
        yard_storage_days: "yard storage",
      }
      const unitLabels: Record<string, string> = {
        detention_hours: "hrs",
        yard_storage_days: "days",
      }
      return `When ${fieldLabels[field] || field} ${op} ${threshold} ${unitLabels[field] || ""}`
    }
    case "location_type":
      return `${(triggerConfig.location_type || "special")} delivery`
    case "container_size":
      return `Container size match`
    case "load_type":
      return `Load type match`
    case "manual":
      return "Manually applied"
    default:
      return triggerType
  }
}
