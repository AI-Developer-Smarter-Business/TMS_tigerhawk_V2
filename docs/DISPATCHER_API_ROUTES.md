# Dispatcher Module API Routes

Complete implementation of 13 API routes for the Dispatcher module in the TMS.

## Directory Structure

```
app/api/dispatcher/
├── loads/
│   ├── route.ts                    # GET (list) + POST (create)
│   ├── pipeline/
│   │   └── route.ts                # GET pipeline counts
│   └── [id]/
│       ├── route.ts                # GET + PATCH (full details & update)
│       ├── status/
│       │   └── route.ts            # PATCH (status transitions)
│       ├── assign-driver/
│       │   └── route.ts            # POST (assign driver)
│       ├── documents/
│       │   └── route.ts            # GET + POST (load documents)
│       ├── messages/
│       │   └── route.ts            # GET + POST (load messages)
│       ├── billing/
│       │   └── route.ts            # GET + POST + PATCH (charges)
│       ├── payments/
│       │   └── route.ts            # GET + POST (payments)
│       └── audit/
│           └── route.ts            # GET (audit log)
├── drivers/
│   └── route.ts                    # GET (drivers with loads)
├── problem-containers/
│   └── route.ts                    # GET (loads with holds/LFD issues)
└── street-turns/
    └── route.ts                    # GET (import/export matches by SSL)
```

## API Endpoints Reference

### Loads Management

#### GET /api/dispatcher/loads
List all loads with filtering and pagination.

**Query Parameters:**
- `search` (string): Search by reference_number, ssl, mbol, pickup_location, delivery_location
- `status` (string): Filter by load status
- `load_type` (string): Filter by load type (Import, Export, Road, Bill Only)
- `driver_id` (string): Filter by assigned driver
- `customer_id` (string): Filter by customer
- `date_from` (ISO string): Filter by creation date from
- `date_to` (ISO string): Filter by creation date to
- `page` (number): Page number (default: 1)
- `limit` (number): Results per page (default: 20)

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

#### POST /api/dispatcher/loads
Create a new load.

**Request Body:**
```json
{
  "customer_id": "string (required)",
  "pickup_location": "string (required)",
  "delivery_location": "string (required)",
  "return_location": "string (optional)",
  "container_id": "string (optional)",
  "driver_id": "string (optional)",
  "scheduled_pickup": "ISO string (optional)",
  "chassis_number": "string (optional)",
  "rate": "number (optional)",
  "notes": "string (optional)",
  "load_type": "Import | Export | Road | Bill Only (optional)",
  "route_type": "string (optional)",
  "ssl": "string (optional)",
  "mbol": "string (optional)",
  "house_bol": "string (optional)",
  "is_hazmat": "boolean (optional)",
  "is_hot": "boolean (optional)",
  "is_overweight": "boolean (optional)",
  "is_oog": "boolean (optional)",
  "is_street_turn": "boolean (optional)",
  "is_tanker": "boolean (optional)",
  "is_bonded": "boolean (optional)",
  "is_liquor": "boolean (optional)",
  "is_ev": "boolean (optional)",
  "is_double": "boolean (optional)",
  "is_genset": "boolean (optional)",
  "is_scale": "boolean (optional)"
}
```

#### GET /api/dispatcher/loads/[id]
Fetch full load details with all relations.

**Response:**
```json
{
  "id": "string",
  "reference_number": "string",
  "status": "string",
  "load_type": "string",
  "route_type": "string",
  "customers": {...},
  "containers": {...},
  "drivers": {...},
  ...all load fields...
}
```

#### PATCH /api/dispatcher/loads/[id]
Update load fields.

**Request Body:** (any of the load fields)
```json
{
  "pickup_location": "string (optional)",
  "delivery_location": "string (optional)",
  "rate": "number (optional)",
  "notes": "string (optional)",
  ...staff-only fields...
}
```

#### PATCH /api/dispatcher/loads/[id]/status
Update load status with validation.

**Request Body:**
```json
{
  "status": "Available | Assigned | Dispatched | In Transit | Delivered | Completed | ... (required)"
}
```

Valid transitions are defined in `VALID_LOAD_TRANSITIONS` in `/types/dispatcher.ts`.

#### POST /api/dispatcher/loads/[id]/assign-driver
Assign an available driver to a load.

**Request Body:**
```json
{
  "driver_id": "string (required)"
}
```

**Effects:**
- Updates load status to "Assigned"
- Updates driver status to "On Job"
- Creates activity log entry

### Load Sub-Resources

#### GET /api/dispatcher/loads/[id]/documents
List all documents for a load.

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "load_id": "string",
      "filename": "string",
      "url": "string",
      "document_type": "string",
      "file_size": "number",
      "uploaded_by": "string",
      "uploaded_at": "ISO string",
      "created_at": "ISO string"
    }
  ]
}
```

#### POST /api/dispatcher/loads/[id]/documents
Add a new document to a load.

**Request Body:**
```json
{
  "filename": "string (required)",
  "url": "string (required)",
  "document_type": "string (required)",
  "file_size": "number (optional)"
}
```

#### GET /api/dispatcher/loads/[id]/messages
List all messages for a load.

**Response:** Array of messages in chronological order

#### POST /api/dispatcher/loads/[id]/messages
Add a new message to a load.

**Request Body:**
```json
{
  "message": "string (required)"
}
```

#### GET /api/dispatcher/loads/[id]/billing
List billing charges for a load.

**Response:**
```json
{
  "data": [...charges...],
  "summary": {
    "totalCharges": "number",
    "chargeCount": "number"
  }
}
```

#### POST /api/dispatcher/loads/[id]/billing
Add a new charge.

**Request Body:**
```json
{
  "charge_type": "string (required)",
  "description": "string (optional)",
  "amount": "number (required)"
}
```

#### PATCH /api/dispatcher/loads/[id]/billing
Update an existing charge.

**Request Body:**
```json
{
  "charge_id": "string (required)",
  "charge_type": "string (optional)",
  "description": "string (optional)",
  "amount": "number (optional)"
}
```

#### GET /api/dispatcher/loads/[id]/payments
List payments for a load.

#### POST /api/dispatcher/loads/[id]/payments
Add a new payment.

**Request Body:**
```json
{
  "payment_type": "string (required)",
  "amount": "number (required)",
  "reference": "string (optional)",
  "paid_at": "ISO string (optional)"
}
```

#### GET /api/dispatcher/loads/[id]/audit
Fetch audit log for a load (staff only).

**Response:** Array of audit entries with change history

### Pipeline & Analytics

#### GET /api/dispatcher/loads/pipeline
Get pipeline counts for the dispatch dashboard.

**Response:**
```json
{
  "arrivingOnVessel": 5,
  "arrivingOnHold": 2,
  "arrivingReleased": 3,
  "needPickup": 12,
  "needPickupLFD": 2,
  "needPickupApt": 10,
  "needDelivery": 8,
  "needDeliveryAtTerminal": 3,
  "needDeliveryInYard": 5,
  "needReturn": 4,
  "needReturnReady": 2,
  "needReturnNotReady": 2,
  "dropped": 6,
  "droppedInYard": 3,
  "droppedAtCustomer": 3,
  "dispatched": 10,
  "finishedToday": 7
}
```

**Metrics Definitions:**
- `arrivingOnVessel`: Containers on vessel or in transit
- `arrivingOnHold`: Loads with customs hold status
- `arrivingReleased`: Loads with freight released status
- `needPickup`: Available/Freight Released without pickup
- `needPickupLFD`: Pickups overdue per Last Free Day
- `needPickupApt`: Pickups with scheduled appointments
- `needDelivery`: Dispatched/In Transit without delivery
- `needDeliveryAtTerminal`: Deliveries at terminal
- `needDeliveryInYard`: Deliveries in yard
- `needReturn`: Delivered loads pending return
- `needReturnReady`: Returns ready per LFD
- `needReturnNotReady`: Returns not yet ready
- `dropped`: Containers dropped off
- `droppedInYard`: Dropped at yard
- `droppedAtCustomer`: Dropped at customer
- `dispatched`: Currently dispatched loads
- `finishedToday`: Loads completed today

### Drivers

#### GET /api/dispatcher/drivers
List drivers with their current and active loads.

**Query Parameters:**
- `status` (string): Filter by driver status (Available, On Job, etc.)
- `search` (string): Search by name or phone

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "phone": "string",
      "status": "string",
      "currentLoad": { ...load... } | null,
      "activeLoadCount": "number",
      "allLoads": [...loads...]
    }
  ],
  "total": "number"
}
```

### Problem Containers

#### GET /api/dispatcher/problem-containers
Get loads with holds or LFD (Last Free Day) issues.

**Query Parameters:**
- `hold_type` (string): Filter by hold type (customs, freight, terminal, fees, other)
- `page` (number): Page number (default: 1)
- `limit` (number): Results per page (default: 20)

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "status": "string",
      "holds": {
        "customs": { "status": "string", "note": "string" } | null,
        "freight": { "status": "string", "note": "string" } | null,
        "terminal": { "status": "string", "note": "string" } | null,
        "fees": { "status": "string", "note": "string" } | null,
        "other": { "status": "string", "note": "string" } | null,
        "carrier": boolean
      },
      "lfdIssue": {
        "type": "last_free_day_passed",
        "daysOverdue": "number"
      } | null,
      ...load data...
    }
  ],
  "pagination": {...}
}
```

### Street Turns

#### GET /api/dispatcher/street-turns
Get available import/export matches grouped by SSL and container size.

**Query Parameters:**
- `ssl` (string): Filter by specific SSL
- `container_size` (string): Filter by container size

**Response:**
```json
{
  "data": {
    "matches": [
      {
        "ssl": "string",
        "containerSize": "string",
        "importCount": "number",
        "exportCount": "number",
        "imports": [...loads...],
        "exports": [...loads...]
      }
    ],
    "unmatched": [...],
    "summary": {
      "totalSSLGroups": "number",
      "matchedPairs": "number",
      "unmatchedGroups": "number",
      "totalImports": "number",
      "totalExports": "number"
    }
  }
}
```

## Authentication & Authorization

All endpoints require:
1. **Authentication**: Valid Supabase session (createClient from server)
2. **Authorization**: Role-based access control via user_profiles table

**Role Permissions:**
- **admin**: Full access to all endpoints
- **dispatcher**: Full access to all endpoints
- **driver**: Limited access (loads assigned to them, drivers list, some pipeline data)

## Error Responses

All endpoints follow consistent error formatting:

```json
{
  "error": "Error message",
  "status": 400 | 401 | 403 | 404 | 500
}
```

**Status Codes:**
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found
- `400`: Bad request (validation error)
- `500`: Internal server error

## Activity Logging

Major operations are automatically logged to the `activity_log` table:
- Load creation
- Load updates
- Status changes
- Driver assignments
- Document uploads
- Message additions
- Billing changes
- Payment records

Logs include:
- `entity_type`: Type of entity (load, load_document, etc.)
- `entity_id`: ID of the entity
- `action`: Action performed
- `user_id`: User who performed the action
- `details`: Additional context (JSON)

## Transactions & Consistency

- Load creation verifies customer, container, and driver exist
- Driver assignment checks driver availability
- Status transitions validate against VALID_LOAD_TRANSITIONS
- Driver status updates occur on assignment and completion
- All changes are timestamped with updated_at

## Rate Limiting

Not currently implemented but should be added at the middleware level.

## Caching

Responses are not cached (CDR should be implemented at frontend level).
