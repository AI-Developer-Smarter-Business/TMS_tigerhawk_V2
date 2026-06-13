# Accessorial Catalog UI Component

Complete production-ready component for managing accessorial charges in TigerhawkTMS.

## Overview

The `AccessorialCatalogView` component provides a comprehensive interface for managing scenario-based charges that attach to loads. It includes:
- Table display of all accessorials with filtering and search
- Add/Edit modal with dynamic trigger configuration
- Toggle active/inactive status
- Real-time API integration
- Dark theme styling consistent with the application

## File Location

```
/sessions/optimistic-practical-ride/mnt/tigerhawk-tms/components/tables/AccessorialCatalogView.tsx
```

## Features

### 1. **Table Display**
- Displays all accessorials with the following columns:
  - **Code**: Bold orange text (e.g., "DETENTION")
  - **Name**: Human-readable name
  - **Type**: Charge type badge (Fixed, Per Hour, Per Mile, Percentage, Tiered)
  - **Amount**: Formatted currency based on charge type
  - **Trigger**: Human-readable trigger description
  - **Groups**: Driver group assignments (placeholder for future implementation)
  - **Status**: Active/Inactive indicator with toggle
  - **Actions**: Edit and toggle buttons

### 2. **Search and Filtering**
- **Search Bar**: Filter by code or name
- **Type Filter Pills**: All Types | Fixed | Per Hour | Per Mile | Percentage
- Real-time filtering with debouncing

### 3. **Add/Edit Modal**
Dynamic modal with the following fields:

#### Basic Information
- **Code** (required): Uppercase text (e.g., "DETENTION")
- **Name** (required): Human-readable name
- **Description**: Optional textarea
- **Charge Type** (required): Dropdown with options
  - Fixed: Dollar amount
  - Per Hour: $/hour
  - Per Mile: $/mile
  - Percentage: Percentage value
  - Tiered: Complex rate structure
- **Default Amount**: Numeric input

#### Trigger Configuration
Dynamic form fields based on selected trigger type:

- **Manual Application**: No configuration needed
- **Load Property**:
  - Property dropdown: Hazmat, Overweight, Reefer, Pre-Pull, Chassis Split
  - Value: True/False toggle
  - Example: "When load is hazmat"

- **Event Threshold**:
  - Field: Detention Hours, Yard Storage Days
  - Operator: >, >=, =
  - Threshold: Numeric value
  - Example: "When detention > 2 hrs"

- **Location Type**:
  - Dropdown: Residential, Warehouse, Port
  - Example: "Residential delivery"

- **Container Size**:
  - Checkboxes: 20ft, 40ft, 45ft
  - Example: "Container sizes: 20, 40"

- **Load Type**:
  - Checkboxes: Import, Export
  - Example: "Load types: Import, Export"

#### Restrictions
- **Container Size Restriction** (optional): Select specific container sizes or "All"
- **Load Type Restriction** (optional): Select specific load types or "All"
- **Driver Group Assignment**: Checkboxes for each available driver group

### 4. **Status Management**
- Toggle button to activate/deactivate accessorials
- Green dot indicator for active status
- Gray dot indicator for inactive status

## Data Structure

### Accessorial Type
```typescript
interface Accessorial {
  id: string
  code: string
  name: string
  description: string | null
  charge_type: "fixed" | "percentage" | "tiered" | "per_hour" | "per_mile"
  default_amount: number | null
  trigger_type: "load_property" | "event_threshold" | "location_type" | "container_size" | "load_type" | "manual" | null
  trigger_config: Record<string, unknown> | null
  container_sizes: string[] | null
  load_types: string[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}
```

### Trigger Config Examples
```typescript
// Load Property
{ field: "is_hazmat", value: true }

// Event Threshold
{ field: "detention_hours", operator: ">", threshold: 2 }

// Location Type
{ location_type: "residential" }

// Container Size
{ sizes: ["20", "40"] }

// Load Type
{ types: ["Import", "Export"] }

// Manual
{}
```

## API Integration

All API calls route through `/api/drivers/pay-rates/accessorials`

### GET - Fetch Accessorials
```bash
GET /api/drivers/pay-rates/accessorials?all=true
```
Returns all accessorials including inactive ones.

### POST - Create Accessorial
```bash
POST /api/drivers/pay-rates/accessorials
Content-Type: application/json

{
  "code": "DETENTION",
  "name": "Detention Charge",
  "description": "Charged when load is detained",
  "charge_type": "fixed",
  "default_amount": 75.00,
  "trigger_type": "event_threshold",
  "trigger_config": { "field": "detention_hours", "operator": ">", "threshold": 2 },
  "container_sizes": null,
  "load_types": null,
  "is_active": true
}
```

### PATCH - Update Accessorial
```bash
PATCH /api/drivers/pay-rates/accessorials
Content-Type: application/json

{
  "id": "uuid",
  "code": "DETENTION",
  "name": "Updated Name",
  "is_active": true
}
```

### Toggle Active Status
```bash
PATCH /api/drivers/pay-rates/accessorials
Content-Type: application/json

{
  "id": "uuid",
  "is_active": false
}
```

## Usage

### Basic Implementation
```tsx
import { AccessorialCatalogView } from "@/components/tables/AccessorialCatalogView"

export default function AccessorialsPage() {
  return <AccessorialCatalogView />
}
```

### In a Layout
```tsx
export default function AdminPage() {
  return (
    <div className="space-y-6">
      <h1>Administration</h1>
      <AccessorialCatalogView />
    </div>
  )
}
```

## Styling

### Color Scheme
- **Primary Background**: `bg-[#0B1120]` (table rows)
- **Secondary Background**: `bg-[#111827]` (headers, modals)
- **Accent Color**: `bg-[#E8700A]` (orange, buttons, highlights)
- **Borders**: `border-white/10`, `border-white/5`
- **Text Primary**: `text-white`
- **Text Secondary**: `text-gray-400`

### Charge Type Badge Colors
- **Fixed**: Green (`bg-green-500/10`, `text-green-400`)
- **Per Hour**: Blue (`bg-blue-500/10`, `text-blue-400`)
- **Per Mile**: Purple (`bg-purple-500/10`, `text-purple-400`)
- **Percentage**: Amber (`bg-amber-500/10`, `text-amber-400`)
- **Tiered**: Cyan (`bg-cyan-500/10`, `text-cyan-400`)

## Responsive Design

- Mobile-optimized table with horizontal scrolling
- Modal scrolls content on small screens
- Filter pills wrap on smaller viewports
- Touch-friendly button sizes (min 44px for mobile)

## Accessibility

- Proper semantic HTML (`<table>`, `<label>`, `<button>`)
- ARIA labels on icon buttons
- Color contrast meets WCAG AA standards
- Keyboard navigation support via native form elements
- Focus states with orange outline on inputs

## Performance Optimizations

- Memoized filter calculations with `useMemo`
- Debounced search via React state
- Optimistic UI updates for toggle actions
- Lazy loading of driver groups on mount
- Efficient API request batching

## Future Enhancements

### TODO Items in Code
1. **Group Assignment Persistence**: Fetch and save `accessorial_group_rules` table entries
2. **Group Display**: Show actual assigned groups in table
3. **Bulk Operations**: Select multiple accessorials for bulk updates
4. **Import/Export**: CSV import/export functionality
5. **Audit Log**: Track changes with timestamps and user info
6. **Duplicate Accessorial**: Clone existing accessorial configurations

### Suggested Endpoints Needed
```typescript
// Fetch group rules for an accessorial
GET /api/drivers/pay-rates/accessorials/{id}/groups

// Save group assignments
POST /api/drivers/pay-rates/accessorials/{id}/groups
Body: { group_ids: string[] }

// Bulk update status
PATCH /api/drivers/pay-rates/accessorials/bulk
Body: { ids: string[], is_active: boolean }
```

## Error Handling

The component includes:
- Network error alerts
- Validation error messages
- Loading states with spinners
- Graceful fallbacks for missing data

## Type Safety

Fully typed with TypeScript:
- Strict null checks enabled
- Enum-like types for charge and trigger types
- Partial types for form submissions
- Generic component props interface

## Dependencies

### External
- `lucide-react`: Icon library
- React hooks: useState, useEffect, useMemo, useCallback

### Internal
- Supabase client API (via `/api` routes)
- TigerhawkTMS styling conventions
- Dark theme color palette

## Testing Recommendations

### Unit Tests
- Filter logic with various combinations
- Trigger config display helpers
- Amount formatting for different charge types

### Integration Tests
- Fetch and display accessorials
- Create new accessorial with API call
- Edit existing accessorial
- Toggle active/inactive status
- Modal form validation

### E2E Tests
- Complete CRUD workflow
- Search and filter functionality
- Modal open/close interactions
- API error handling

## Known Limitations

1. **Group Assignments**: Currently selectable in modal but not persisted
2. **Trigger Config UI**: Dynamically rendered based on trigger type; may need expansion for complex rules
3. **Batch Operations**: No bulk update/delete functionality
4. **Audit Trail**: No change history tracking

## Related Components

- `DriverPayRatesView`: Related pay rate management
- `SettlementSettingsView`: Related settlement configuration
- `LaneRateMatrixView`: Related rate matrices

## Support

For issues or enhancements, refer to the TODO comments in the component code for areas marked for future implementation.
