# Driver Pay & Billing Rate System — Design Document

## Overview

Redesign the rate system to support both **zonal** (mile-range from/to a fixed point) and **defined** (specific point-to-point) lanes, with multi-line charge profiles that can be calculated per-move, by-event, by-leg, or between-statuses. This replaces the current single-rate-per-zone model.

## Hierarchy

```
Driver Group
  └─ Rate Profile (a named tariff template)
       └─ Lanes (zonal OR defined)
            ├─ Conditions (optional filters for when this lane applies)
            └─ Charge Items (multiple per lane: drayage, fuel, chassis, etc.)
                 └─ Charge Conditions (optional per-charge conditional logic)
```

## Current Tables (Keep & Extend)

| Table | Status | Notes |
|-------|--------|-------|
| `driver_groups` | **Keep** | Add optional `rate_profile_id` FK |
| `driver_group_assignments` | **Keep** | No changes |
| `lane_origins` | **Keep** | Used as anchor points for zonal lanes (origin OR destination) |
| `lane_zones` | **Keep** | Used for zonal lane mile ranges |
| `accessorials` | **Keep** | Global accessorial catalog |

## New Tables

### 1. `rate_profiles`
The top-level tariff template. A driver group references one rate profile.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text NOT NULL | e.g. "OO Per Move - Houston" |
| `description` | text | |
| `is_active` | boolean DEFAULT true | |
| `effective_date` | date | When this profile takes effect |
| `expires_date` | date | Optional expiry |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 2. `rate_profile_lanes`
Each lane within a rate profile. Can be **zonal** (references an origin/destination + zone) or **defined** (specific pickup/delivery points).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `rate_profile_id` | uuid FK → rate_profiles | |
| `lane_type` | text NOT NULL | `'zonal'` or `'defined'` |
| `name` | text | Auto-generated or user-set |
| **Zonal fields** | | |
| `anchor_point_id` | uuid FK → lane_origins | The fixed point (port, terminal, yard) |
| `anchor_role` | text | `'origin'` or `'destination'` — is this the pickup or delivery end? |
| `zone_id` | uuid FK → lane_zones | The zone (mile range) for the other end |
| **Defined fields** | | |
| `pickup_location` | text | For defined lanes (address/name) |
| `pickup_lat` | numeric | |
| `pickup_lng` | numeric | |
| `delivery_location` | text | For defined lanes |
| `delivery_lat` | numeric | |
| `delivery_lng` | numeric | |
| `return_location` | text | Optional return point |
| `return_lat` | numeric | |
| `return_lng` | numeric | |
| **Common fields** | | |
| `direction` | text | `'inbound'`, `'outbound'`, `'both'` |
| `priority` | int DEFAULT 0 | Higher = matched first (specific > zonal) |
| `is_active` | boolean DEFAULT true | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Zonal anchor_role explained:**
- `anchor_role = 'origin'`: The anchor point is the pickup. Zone determines where delivery goes (e.g., Port → Zone 5 delivery).
- `anchor_role = 'destination'`: The anchor point is the delivery. Zone determines where pickup comes from (e.g., Zone 3 pickup → Warehouse).
- This enables zonal rates from EITHER end — your key requirement.

**Matching logic:** When calculating a rate, the system first tries to match a `defined` lane (exact pickup/delivery match). If no match, falls back to `zonal` lanes (anchor + zone by mile range). Priority field breaks ties.

### 3. `rate_profile_conditions`
Optional additional conditions on a lane OR a charge for more specific matching.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `lane_id` | uuid FK → rate_profile_lanes | NULL if charge-level condition |
| `charge_id` | uuid FK → rate_profile_charges | NULL if lane-level condition |
| `condition_type` | text NOT NULL | See enum below |
| `operator` | text NOT NULL DEFAULT 'equals' | `'equals'`, `'not_equals'`, `'in'`, `'not_in'`, `'gt'`, `'gte'`, `'lt'`, `'lte'` |
| `condition_value` | jsonb | Flexible value storage |
| `logic_group` | int DEFAULT 1 | For grouping AND/OR logic |
| `logic_operator` | text DEFAULT 'AND' | `'AND'`, `'OR'`, `'NOT'` |
| `created_at` | timestamptz | |

**condition_type enum (from PortPro "Match Load" + sidebar):**

Location & routing conditions:
- `load_type` — value: `["Import", "Export"]`
- `customer` — value: `["customer_id_1"]`
- `terminal` — value: `["terminal_name"]`
- `warehouse` — value: `["warehouse_name"]`
- `chassis_pickup` — value: `["location"]`
- `hook_chassis` — value: `["location"]`
- `container_return` — value: `["location"]`
- `chassis_term` — value: `["location"]`
- `drop_location` — value: `["location"]`
- `stopoff` — value: `["location"]`
- `delivery_country` — value: `["US"]`
- `city_state` — value: `["Houston, TX"]`
- `state` — value: `["TX", "LA"]`
- `postal_zip_code_groups` — value: `["77571", "77058"]`
- `city_groups` — value: `["group_id"]`

Equipment conditions:
- `container_type` — value: `["HC", "GP", "RF", "OT", "FL"]`
- `container_size` — value: `["20", "40", "45"]`
- `ssl` (steamship line) — value: `["OOCL", "MSC", "COSCO", "MAERSK"]`
- `chassis_type` — value: `["type"]`
- `chassis_size` — value: `["20", "40", "45"]`
- `chassis_owner` — value: `["owner"]`

Load property conditions:
- `hazmat` — value: `true`
- `overweight` — value: `true`
- `hot` — value: `true`
- `liquor` — value: `true`
- `reefer` — value: `true`
- `genset` — value: `true`
- `bonded` — value: `true`
- `scale` — value: `true`
- `street_turn` — value: `true`
- `oog` (out of gauge) — value: `true`
- `ev` (electric vehicle) — value: `true`
- `double` — value: `true`
- `tanker` — value: `true`
- `dropped` — value: `true`

Other conditions:
- `csr` — value: `["csr_name"]`
- `branch` — value: `["branch_name"]`
- `commodity_profile` — value: `["profile"]`
- `commodities_weight` — value: `{ "operator": "gt", "value": 44000 }`
- `delivery_day` — value: `["Monday", "Saturday"]`
- `delivery_time_24hrs` — value: `{ "from": "06:00", "to": "18:00" }`

### 4. `rate_profile_charges`
Individual charge line items within a lane. Each lane can have multiple charges (drayage base, fuel surcharge, chassis, etc.).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `lane_id` | uuid FK → rate_profile_lanes | |
| `charge_code` | text NOT NULL | e.g. "S100", "S108", "S104" |
| `charge_name` | text NOT NULL | e.g. "DRAYAGE", "CHASSIS", "FUEL" |
| `calculation_mode` | text NOT NULL | See modes below |
| `status_from` | text | For between_statuses mode |
| `status_to` | text | For between_statuses mode |
| `event` | text | For by_event mode |
| `event_location` | text | For by_event: City/State/Zip/Profile filter |
| `leg_from` | text | For by_leg mode |
| `leg_from_location` | text | For by_leg: location filter |
| `leg_to` | text | For by_leg mode |
| `leg_to_location` | text | For by_leg: location filter |
| `unit_of_measure` | text NOT NULL | See units below |
| `rate` | numeric NOT NULL | Dollar amount or percentage |
| `min_amount` | numeric | Minimum charge |
| `max_amount` | numeric | Maximum charge |
| `free_units` | numeric DEFAULT 0 | Free hours/days/miles before charge kicks in |
| `auto_add` | boolean DEFAULT true | Auto-include on load or manual-only |
| `effective_date_based_on` | text | When effective date is evaluated |
| `description` | text | |
| `sort_order` | int DEFAULT 0 | Display ordering |
| `is_active` | boolean DEFAULT true | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**calculation_mode options (4 modes from PortPro):**

1. `between_statuses` — Pay calculated for the time/distance between two load statuses.
   - Uses `status_from` and `status_to` fields
   - Status values: ENROUTE_TO_CHASSIS, ARRIVED_TO_CHASSIS, ENROUTE_TO_PICK_CONTAINER, ARRIVED_AT_PICK_CONTAINER, ENROUTE_TO_DELIVER_LOAD, ARRIVED_AT_DELIVER_LOAD, ENROUTE_TO_DROP_CONTAINER, DROPPED, ENROUTE_TO_STOP_OFF, ARRIVED_AT_STOP_OFF, ENROUTE_TO_HOOK_CONTAINER, ARRIVED_TO_HOOK_CONTAINER, ENROUTE_TO_RETURN_LOAD, ARRIVED_AT_RETURN_LOAD, ENROUTE_TO_RETURN_CHASSIS, ARRIVED_TO_RETURN_CHASSIS, COMPLETED

2. `by_event` — Pay triggered when a specific event occurs, optionally at a specific location.
   - Uses `event` and `event_location` fields
   - Event values: PICK_UP_CONTAINER, DELIVER_CONTAINER, RETURN_CONTAINER, DROP_CONTAINER, STOP_OFF, TERMINATE_CHASSIS, COMPLETED, HOOK_CONTAINER, HOOK_CHASSIS, LIFT_OFF, LIFT_ON, DELIVER_LOAD_DROP_AND_HOOK, DROP_CHASSIS

3. `by_move` — Flat rate for the entire move regardless of events/legs.
   - No additional fields needed (simplest mode)

4. `by_leg` — Pay calculated for a specific leg (from one event to another), each optionally location-filtered.
   - Uses `leg_from`, `leg_from_location`, `leg_to`, `leg_to_location` fields
   - Leg values: same as event values above (PICK_UP_CONTAINER, DELIVER_CONTAINER, etc.)

**unit_of_measure options (from PortPro):**
- `per_day` — Rate × number of days
- `per_hour` — Rate × number of hours
- `per_pounds` — Rate × weight in pounds
- `per_miles` — Rate × distance in miles
- `per_road_toll_miles` — Rate × toll road miles
- `fixed` — Flat dollar amount
- `percentage` — Percentage of another charge (typically drayage base)
- `per_15min` — Rate × 15-minute increments

**effective_date_based_on options:**
- `current_date` — Today's date
- `created_at` — Load creation date
- `move_start_date` — When the move started
- Any status value (same as status_from list) — Date that status was reached

**Charge Code catalog (from PortPro, for seeding `charge_codes` reference table):**

| Code | Name |
|------|------|
| S100 | DRAYAGE |
| S101 | DRAYAGE (ALL-IN) |
| S102 | DRAYAGE RATE |
| S103 | DRAY NON-BONDED - DSI |
| S104 | FUEL |
| S105 | BOBTAIL CHARGE |
| S106 | BONDED CARGO CHARGE |
| S107 | BONDED MOVE |
| S108 | CHASSIS |
| S109 | CHASSIS SPLIT |
| S110 | CHASSIS USAGE |
| S111 | ADDITIONAL CHASSIS USAGE |
| S112 | CITATION |
| S113 | CRATE TARPING |
| S114 | CREDIT |
| S115 | DETENTION CHARGES |
| S116 | DELIVERY CHARGES |
| S117 | DELIVERY PICK-UP |
| S118 | DEMUR-DET FEE |
| S120 | DRY RUN |
| S121 | DRY RUN/CANCELLED ORDER |
| S122 | DROP CHARGE |
| S124 | EMPTY RETURN |
| S126 | FLATBED LOADED |
| S127 | FLIP CHARGE |
| S128 | HAZMAT |
| S130 | LINE HAUL |
| S131 | OFF-HIRE REPOSITIONING |
| S132 | OVERWEIGHT |
| S133 | PIER CONGESTION |
| S134 | PLACARD FEE |
| S136 | PORT CONGESTION FEE |
| S137 | POWER ONLY LOAD |
| S138 | REDELIVERY |
| S140 | REPOSITIONING CONTAINERS |
| S141 | PERMIT |
| S142 | SURCHARGE - 4% |
| S143 | SURCHARGE - 20% |
| S145 | SATURDAY DELIVERY |
| S146 | SCALE LOAD |
| S147 | SCALE TICKET |
| S148 | SORT AND SEGREGATION |
| S150 | STOP OFF |
| S151 | STRAP |
| S152 | PREPULL |
| S153 | SWING CHARGE |
| S154 | TANKER ENDORSEMENT |
| S155 | TARP |
| S156 | TOLLS |
| S157 | TRAFFIC FINE |
| S158 | TRANSPORTATION |
| S159 | TRI-AXLE |
| S160 | WAITING TIME |
| S162 | YARD PULL |
| S163 | YARD DAYS |
| S164 | ADDITIONAL HOURS |
| S165 | ADDITIONAL WEIGHT |
| S167 | LUMPER |
| S200 | AIR BAGS |
| S201 | BILL OF LADING FEE |
| S202 | BLOCKS AND BRACES |
| S205 | PER DIEM |
| S207 | FLEXI BAG DISPOSAL |
| S208 | PALLET CHARGE - SKU/WRAP |
| S210 | RELOAD |
| S211 | TRANSLOAD |
| S212 | CANCELLATION/RESTOCKING |
| S213 | UNLOAD |
| S214 | NO SHOW |
| S215 | DISPOSAL FEE |
| S301 | CONTAINER STORAGE - WHS |
| S302 | CONTAINER INSPECTION |
| S303 | DEVANNING |
| S304 | PALLET DELIVERY |
| S305 | HOURLY PAY |
| S306 | LABELING |
| S308 | PALLET HANDLING |
| S309 | PALLETIZATION |
| S310 | PALLETIZING LABOR |
| S312 | PALLETS |
| S313 | PALLET STORAGE |
| S314 | PARTS |
| S315 | 30-DAY STORAGE CHARGE |
| S316 | 60 DAY STORAGE CHARGE |
| S317 | STORAGE |
| S320 | WAREHOUSING STORAGE |
| S321 | WHS - LOAD/BLOCK/BRACE |
| S400 | ALL-IN RATE |
| S420 | CARRIER FREIGHT PAY |
| S430 | MAINTENANCE AND REPAIR |
| S440 | PACKAGED MOTOR OIL |
| S450 | CONSUMABLES |
| S470 | SERVICE COST |
| S491 | TIRE REBILL |
| S492 | TRANSACTION FEE |
| S499 | OTHER |

## Additional Load Conditions (Sidebar Filters on Tariff)

These are set at the tariff (rate profile) level, not per-charge. They filter which loads the entire tariff applies to:

- **Container Type**: Select (HC, GP, RF, OT, FL, etc.)
- **Container Size**: Select (20', 40', 45', etc.)
- **SSL** (Steamship Line): Multi-select
- **CSR**: Multi-select
- **Chassis Type**: Select
- **Chassis Size**: Select (20, 40, 45)
- **Chassis Owner**: Select
- **Boolean flags**: Hazmat, Overweight, Liquor, Hot, Genset, Scale, Street Turn, OOG, Bonded, EV, Double, Tanker

## Calculation Flow

```
1. Input: load record (driver, origin, destination, distance, container info, events, timestamps)
2. Find driver's group → get rate_profile_id
3. Check tariff-level conditions (container type/size, SSL, hazmat, etc.)
4. Match lane:
   a. Try defined lanes first (exact pickup/delivery match, check lane conditions)
   b. Fall back to zonal lanes:
      - Check if anchor_role='origin' matches load pickup + zone covers delivery distance
      - OR anchor_role='destination' matches load delivery + zone covers pickup distance
   c. Use highest priority match
5. For matched lane, get all active charges where auto_add=true:
   a. by_move → apply flat rate
   b. between_statuses → calculate time/distance between status_from and status_to timestamps
   c. by_event → check if the specified event occurred (optionally at the specified location)
   d. by_leg → calculate for the segment between leg_from and leg_to events
   e. Apply unit_of_measure: fixed, per_mile × distance, per_hour × hours, percentage × base, etc.
   f. Apply min/max amounts, subtract free units
   g. Evaluate per-charge conditions if any
6. Sum all charge amounts
7. Add triggered accessorials (from existing accessorials table)
8. Return breakdown: { charges: [...], accessorials: [...], total }
```

## Migration Strategy

The existing `lane_rates` table data can be migrated into the new structure:
- Each existing lane_origin becomes the anchor_point for zonal lanes
- Each existing rate becomes a `rate_profile` + `rate_profile_lane` (zonal, anchor_role='origin') + single `rate_profile_charge` (by_move, fixed)
- Existing `accessorials` stay as-is — they're a separate global layer
- The old `lane_rates` table can be deprecated but kept temporarily for rollback safety

## UI Changes

The "Lane Rates" tab transforms into:

**Rate Profiles tab** (replaces Lane Rates):
- List of rate profiles with name, effective date, lane count
- Click into a profile → see lanes (zonal + defined) with conditions
- Click into a lane → see charge items with full configuration
- Each charge shows: code, name, calculation mode, unit, rate, min/max, conditions

The existing zone map and matrix view can be preserved as a visualization within the zonal lane editor.

**Tabs become:**
1. Driver Groups (unchanged)
2. Rate Profiles (new — replaces Lane Rates)
3. Accessorials (unchanged)
4. Pay Calculator (enhanced to show per-charge breakdown)

## Example: "OO Per Move - Port Houston"

```
Rate Profile: "Owner Operator - Per Move"
│
├── Lane: Zonal — anchor: Port of Houston (origin) → Zone 1 (0-25mi)
│   ├── S100 DRAYAGE — by_move, fixed, $275.00
│   ├── S108 CHASSIS — by_move, fixed, $45.00
│   └── S104 FUEL — by_move, percentage, 18% (of drayage)
│
├── Lane: Zonal — anchor: Port of Houston (origin) → Zone 5 (51-65mi)
│   ├── S100 DRAYAGE — by_leg
│   │   ├── leg: PICK_UP_CONTAINER → DELIVER_CONTAINER: per_miles, $2.50/mi
│   │   └── leg: RETURN_CONTAINER → DROP_CONTAINER: fixed, $85.00
│   ├── S108 CHASSIS — by_move, fixed, $55.00
│   └── S104 FUEL — by_move, percentage, 18%
│
├── Lane: Zonal — anchor: Customer Warehouse (destination) → Zone 3 (26-40mi)
│   │   [anchor_role = 'destination' — zone applies to pickup side]
│   ├── S100 DRAYAGE — by_move, fixed, $310.00
│   └── S104 FUEL — by_move, percentage, 18%
│
├── Lane: Defined — Bayport Terminal → PBP Inc (5055 Grand Pkwy)
│   │   Conditions: container_size IN ['40'], load_type = 'Export'
│   ├── S101 DRAYAGE ALL-IN — by_move, fixed, $375.00
│   └── (no separate chassis/fuel — it's all-in)
│
└── Lane: Defined — Any → PBP Inc (Saturday delivery)
    │   Conditions: delivery_day IN ['Saturday']
    ├── S145 SATURDAY DELIVERY — by_event, event: DELIVER_CONTAINER, fixed, $75.00
    └── S100 DRAYAGE — by_move, fixed, $350.00
```
