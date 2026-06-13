# Accessorial Configuration Examples

This document provides real-world examples of accessorial configurations and how they work.

## Example Accessorials

### 1. Detention Charge (Time-Based Threshold)
Charge applied when driver waits too long at pickup or delivery location.

```typescript
{
  id: "uuid-1",
  code: "DETENTION",
  name: "Detention Charge",
  description: "Charged when load is detained beyond 2 hours",
  charge_type: "fixed",
  default_amount: 75.00,
  trigger_type: "event_threshold",
  trigger_config: {
    field: "detention_hours",
    operator: ">",
    threshold: 2
  },
  container_sizes: null,  // Applies to all container sizes
  load_types: null,       // Applies to all load types
  is_active: true
}
```

**Display in UI**: "When detention > 2 hrs"
**When Applied**: Automatically added when detention exceeds 2 hours
**Groups**: All driver groups

---

### 2. Hazmat Surcharge (Load Property)
Percentage surcharge for hazardous materials.

```typescript
{
  id: "uuid-2",
  code: "HAZMAT",
  name: "Hazmat Surcharge",
  description: "15% surcharge for hazmat loads",
  charge_type: "percentage",
  default_amount: 15.00,
  trigger_type: "load_property",
  trigger_config: {
    field: "is_hazmat",
    value: true
  },
  container_sizes: null,
  load_types: null,
  is_active: true
}
```

**Display in UI**: "When load is hazmat"
**When Applied**: Automatically when is_hazmat flag is true
**Calculation**: 15% of base rate

---

### 3. Reefer Maintenance (Per Hour)
Hourly charge for refrigerated container maintenance.

```typescript
{
  id: "uuid-3",
  code: "REEFER",
  name: "Reefer Maintenance",
  description: "Hourly reefer maintenance charge",
  charge_type: "per_hour",
  default_amount: 5.00,
  trigger_type: "load_property",
  trigger_config: {
    field: "is_reefer",
    value: true
  },
  container_sizes: null,
  load_types: null,
  is_active: true
}
```

**Display in UI**: "When load is reefer"
**When Applied**: Automatically for reefer loads
**Calculation**: $5.00 × hours worked

---

### 4. Port Delivery Fee (Location-Based)
Fixed charge for port deliveries.

```typescript
{
  id: "uuid-4",
  code: "PORT_DELIVERY",
  name: "Port Delivery Fee",
  description: "Port delivery handling fee",
  charge_type: "fixed",
  default_amount: 100.00,
  trigger_type: "location_type",
  trigger_config: {
    location_type: "port"
  },
  container_sizes: null,
  load_types: null,
  is_active: true
}
```

**Display in UI**: "Delivery type: port"
**When Applied**: Automatically when delivery location is port
**Groups**: All driver groups

---

### 5. Extra Large Container (Size-Based)
Surcharge for 45ft containers.

```typescript
{
  id: "uuid-5",
  code: "EXTRA_LARGE",
  name: "Extra Large Container",
  description: "Surcharge for 45ft containers",
  charge_type: "fixed",
  default_amount: 50.00,
  trigger_type: "container_size",
  trigger_config: {
    sizes: ["45"]
  },
  container_sizes: ["45"],  // Restrict to 45ft only
  load_types: null,
  is_active: true
}
```

**Display in UI**: "Container sizes: 45"
**When Applied**: Automatically for 45ft containers
**Restriction**: Only applies to 45ft containers

---

### 6. Export Only (Load Type Restriction)
Charge only applicable to export loads.

```typescript
{
  id: "uuid-6",
  code: "EXPORT_SURCHARGE",
  name: "Export Surcharge",
  description: "Surcharge for export loads",
  charge_type: "fixed",
  default_amount: 75.00,
  trigger_type: "load_type",
  trigger_config: {
    types: ["Export"]
  },
  container_sizes: null,
  load_types: ["Export"],  // Restrict to export only
  is_active: true
}
```

**Display in UI**: "Load types: Export"
**When Applied**: Automatically for export loads
**Restriction**: Only applies to Export load type

---

### 7. Manual Fuel Surcharge (Dispatcher-Controlled)
Fuel surcharge applied manually by dispatcher.

```typescript
{
  id: "uuid-7",
  code: "FUEL_SURCHARGE",
  name: "Fuel Surcharge",
  description: "Manually applied fuel surcharge",
  charge_type: "percentage",
  default_amount: null,  // Dispatcher enters amount
  trigger_type: "manual",
  trigger_config: {},  // No automatic configuration
  container_sizes: null,
  load_types: null,
  is_active: true
}
```

**Display in UI**: "Manually applied"
**When Applied**: When dispatcher manually adds to load
**Use Case**: Volatile costs that require human judgment

---

### 8. Overweight Processing (Complex Trigger)
Charge for overweight loads with high threshold.

```typescript
{
  id: "uuid-8",
  code: "OVERWEIGHT",
  name: "Overweight Processing",
  description: "Processing fee for overweight loads",
  charge_type: "fixed",
  default_amount: 125.00,
  trigger_type: "load_property",
  trigger_config: {
    field: "is_overweight",
    value: true
  },
  container_sizes: ["40", "45"],  // Only 40/45ft
  load_types: ["Import"],         // Import only
  is_active: true
}
```

**Display in UI**: "When load is overweight"
**When Applied**: For overweight imports in 40/45ft containers
**Restrictions**: 40ft, 45ft containers only | Import loads only

---

### 9. Yard Storage (Multi-Day Threshold)
Charge for extended yard storage.

```typescript
{
  id: "uuid-9",
  code: "YARD_STORAGE",
  name: "Yard Storage Charge",
  description: "Charged for each day in yard storage",
  charge_type: "fixed",
  default_amount: 50.00,
  trigger_type: "event_threshold",
  trigger_config: {
    field: "yard_storage_days",
    operator: ">=",
    threshold: 3
  },
  container_sizes: null,
  load_types: null,
  is_active: true
}
```

**Display in UI**: "When yard storage >= 3"
**When Applied**: After 3+ days in yard
**Calculation**: $50/day × days over 3

---

### 10. Pre-Pull Prep (Special Load Property)
Charge for pre-pull preparation work.

```typescript
{
  id: "uuid-10",
  code: "PREPULL",
  name: "Pre-Pull Preparation",
  description: "Preparation charge for pre-pull loads",
  charge_type: "fixed",
  default_amount: 60.00,
  trigger_type: "load_property",
  trigger_config: {
    field: "is_pre_pull",
    value: true
  },
  container_sizes: null,
  load_types: null,
  is_active: true
}
```

**Display in UI**: "When load is pre_pull"
**When Applied**: Automatically for pre-pull loads

---

## Charge Type Examples

### Fixed Amount
```typescript
charge_type: "fixed"
default_amount: 75.00
// Result: $75.00 flat fee
```

### Per Hour
```typescript
charge_type: "per_hour"
default_amount: 5.00
// Result: $5.00 × hours (e.g., 8 hours = $40.00)
```

### Per Mile
```typescript
charge_type: "per_mile"
default_amount: 0.50
// Result: $0.50 × miles (e.g., 200 miles = $100.00)
```

### Percentage
```typescript
charge_type: "percentage"
default_amount: 15.00
// Result: 15% of base rate (e.g., $1000 base = $150)
```

### Tiered (Future Use)
```typescript
charge_type: "tiered"
default_amount: 50.00
// Tiered structure:
// 0-100 miles: $50
// 101-200 miles: $75
// 200+ miles: $100
// (Implementation depends on system requirements)
```

---

## Container Size Triggers

### Single Size
```typescript
trigger_config: {
  sizes: ["20"]
}
// Only applies to 20ft containers
```

### Multiple Sizes
```typescript
trigger_config: {
  sizes: ["40", "45"]
}
// Applies to 40ft and 45ft containers
```

### All Sizes
```typescript
// Leave sizes empty in trigger_config OR
container_sizes: null  // In restriction field
// Applies to all container sizes
```

---

## Load Type Restrictions

### Import Only
```typescript
load_types: ["Import"]
// Only applies to import loads
```

### Export Only
```typescript
load_types: ["Export"]
// Only applies to export loads
```

### Both Import and Export
```typescript
load_types: null  // or load_types: ["Import", "Export"]
// Applies to all load types
```

---

## Trigger Operator Examples

### Greater Than (>)
```typescript
trigger_config: {
  field: "detention_hours",
  operator: ">",
  threshold: 2
}
// Triggers when detention_hours > 2 (2+ hours, so 2.5, 3, 4, etc.)
```

### Greater or Equal (>=)
```typescript
trigger_config: {
  field: "yard_storage_days",
  operator: ">=",
  threshold: 3
}
// Triggers when yard_storage_days >= 3 (exactly 3 or more)
```

### Equal (=)
```typescript
trigger_config: {
  field: "specific_field",
  operator: "=",
  threshold: 5
}
// Triggers when field exactly equals 5
```

---

## Group Assignment Patterns

### Assign to All Groups
```typescript
// Select all groups in modal
selectedGroups: ["group-1", "group-2", "group-3"]
// OR leave empty to default to all
```

### Assign to Specific Groups
```typescript
selectedGroups: ["local-drivers-group", "long-haul-group"]
// Only these groups see this accessorial
```

### Create Group-Specific Charges
```typescript
// Example: Premium accessorial for high-level drivers
{
  code: "PREMIUM_SERVICE",
  name: "Premium Driver Service",
  charge_type: "fixed",
  default_amount: 150.00,
  selectedGroups: ["premium-drivers-only"]
}
```

---

## Validation Rules

When creating an accessorial, ensure:

1. **Code**: Required, unique, uppercase (e.g., "DETENTION")
2. **Name**: Required, human-readable (e.g., "Detention Charge")
3. **Charge Type**: Required, one of: fixed, per_hour, per_mile, percentage, tiered
4. **Default Amount**: Required for automatic triggers, optional for manual

### Trigger Type Validation
- **manual**: No config required
- **load_property**: field and value required
- **event_threshold**: field, operator, threshold required
- **location_type**: location_type required
- **container_size**: sizes array required
- **load_type**: types array required

---

## Real-World Scenario

### Load Details
- Type: Import
- Container: 40ft
- Hazmat: Yes
- Detention: 3 hours
- Location: Warehouse (not port)
- Yard Storage: 4 days

### Applied Accessorials
1. **HAZMAT** (15% surcharge) - is_hazmat = true
2. **DETENTION** ($75) - detention_hours > 2
3. **YARD_STORAGE** ($50/day) - yard_storage_days >= 3 (charge 1 day)

### Total Accessorial Charges
- Hazmat: 15% of base
- Detention: $75.00
- Yard Storage: $50.00 (for day 4)
- **Total: Base × 1.15 + $125.00**

---

## Common Issues & Solutions

### Accessorial Not Applying
**Problem**: Accessorial created but not applying to loads
**Solution**:
1. Check trigger_config is correctly formatted
2. Verify is_active = true
3. Confirm load properties match trigger conditions
4. Check container_sizes and load_types restrictions

### Wrong Amount Showing
**Problem**: Charge amount is different than configured
**Solution**:
1. For percentage charges, verify base calculation
2. For per_hour, check duration calculation
3. Check driver group overrides aren't applied
4. Verify amount wasn't manually adjusted by dispatcher

### Duplicate Charges
**Problem**: Same charge applies multiple times
**Solution**:
1. Check trigger_config for overlapping conditions
2. Verify load doesn't match multiple triggers
3. Ensure manual and automatic charges don't overlap
4. Check system isn't applying charge twice

---

## Testing New Accessorials

### Test Data
```sql
-- Create test load
INSERT INTO loads (...)
VALUES (
  load_type: 'Import',
  is_hazmat: true,
  is_reefer: false,
  is_overweight: false,
  container_size: '40',
  detention_hours: 3,
  yard_storage_days: 4,
  ...
);

-- Create test accessorial
INSERT INTO accessorials (...)
VALUES (
  code: 'TEST_CHARGE',
  name: 'Test Charge',
  charge_type: 'fixed',
  default_amount: 99.99,
  trigger_type: 'manual',
  is_active: true
);
```

### Verification Steps
1. Create load with test properties
2. Create accessorial with test configuration
3. Verify UI shows new accessorial
4. Toggle active/inactive and verify
5. Edit accessorial and verify changes save
6. Delete test data

---

## Migration Guide

### From Legacy System
If migrating from another TMS:

1. **Map Charge Codes**: Document old codes → new CODES
2. **Verify Amounts**: Compare default_amounts between systems
3. **Test Triggers**: Create matching trigger_config for each old rule
4. **Validate Groups**: Ensure driver_groups exist and match
5. **Batch Import**: Use API bulk import endpoint (if available)
6. **Verification**: Run comparison report on migration

Example mapping:
```
Old System → TigerhawkTMS
DET001    → DETENTION
HAZ001    → HAZMAT
REF001    → REEFER
```

---

## Performance Notes

- Accessorials are loaded once on page load
- Filtering happens client-side (memoized for performance)
- API calls are sequential (could be batched)
- No pagination for < 1000 items
- Virtual scrolling not needed for typical datasets

### Optimization Tips
- Cache accessorials locally for 5 minutes
- Implement pagination for > 10k records
- Use search debouncing to reduce API calls
- Consider lazy loading for load property options

