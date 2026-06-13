# Accessorial Catalog Integration Guide

## Quick Start

### 1. Import the Component
```tsx
import { AccessorialCatalogView } from "@/components/tables/AccessorialCatalogView"
```

### 2. Add to Your Page
```tsx
export default function AccessorialsAdminPage() {
  return (
    <main className="min-h-screen bg-[#080D1D]">
      <AccessorialCatalogView />
    </main>
  )
}
```

### 3. API Prerequisites

The component expects these API endpoints to exist:

#### GET `/api/drivers/pay-rates/accessorials`
Returns list of accessorials
```json
{
  "accessorials": [
    {
      "id": "uuid",
      "code": "DETENTION",
      "name": "Detention Charge",
      "description": "Charged when load is detained",
      "charge_type": "fixed",
      "default_amount": 75.00,
      "trigger_type": "event_threshold",
      "trigger_config": { "field": "detention_hours", "operator": ">", "threshold": 2 },
      "container_sizes": null,
      "load_types": null,
      "is_active": true,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

#### GET `/api/drivers/pay-rates/groups`
Returns list of driver groups
```json
{
  "groups": [
    {
      "id": "uuid",
      "name": "Local Drivers",
      "assignment_count": 5
    }
  ]
}
```

#### POST `/api/drivers/pay-rates/accessorials`
Create a new accessorial. Request body matches Accessorial interface.

#### PATCH `/api/drivers/pay-rates/accessorials`
Update an existing accessorial. Include `id` in the request body.

### 4. Database Schema Requirements

The component uses these Supabase tables:

```sql
-- Accessorials table
CREATE TABLE accessorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  charge_type VARCHAR(50) NOT NULL,
  default_amount DECIMAL(10, 2),
  trigger_type VARCHAR(50),
  trigger_config JSONB,
  container_sizes TEXT[],
  load_types TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Driver groups table (should already exist)
CREATE TABLE driver_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  pay_type VARCHAR(50) NOT NULL,
  base_rate DECIMAL(10, 2),
  is_company_driver BOOLEAN DEFAULT false,
  default_service_type VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Accessorial group rules (future enhancement)
CREATE TABLE accessorial_group_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessorial_id UUID NOT NULL REFERENCES accessorials(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES driver_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(accessorial_id, group_id)
);

-- Create indexes for performance
CREATE INDEX idx_accessorials_code ON accessorials(code);
CREATE INDEX idx_accessorials_is_active ON accessorials(is_active);
CREATE INDEX idx_accessorial_group_rules_accessorial ON accessorial_group_rules(accessorial_id);
```

## Layout Integration Examples

### Full Admin Page
```tsx
import { AccessorialCatalogView } from "@/components/tables/AccessorialCatalogView"

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#080D1D]">
      <div className="max-w-full mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">TMS Administration</h1>
          <p className="text-gray-400 mt-2">Manage rates, accessorials, and configurations</p>
        </div>

        <div className="mb-8">
          <AccessorialCatalogView />
        </div>
      </div>
    </div>
  )
}
```

### Tab-Based Navigation
```tsx
import { useState } from "react"
import { AccessorialCatalogView } from "@/components/tables/AccessorialCatalogView"
import { DriverPayRatesView } from "@/components/tables/DriverPayRatesView"

export default function PayRatesPage() {
  const [activeTab, setActiveTab] = useState<"rates" | "accessorials">("rates")

  return (
    <div className="min-h-screen bg-[#080D1D] p-6">
      <div className="mb-6 border-b border-white/10">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("rates")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "rates"
                ? "border-[#E8700A] text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Pay Rates
          </button>
          <button
            onClick={() => setActiveTab("accessorials")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "accessorials"
                ? "border-[#E8700A] text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Accessorials
          </button>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === "rates" && <DriverPayRatesView drivers={[]} />}
        {activeTab === "accessorials" && <AccessorialCatalogView />}
      </div>
    </div>
  )
}
```

### Sidebar Layout
```tsx
import { useState } from "react"
import { AccessorialCatalogView } from "@/components/tables/AccessorialCatalogView"

export default function AdminLayout() {
  const [activeSection, setActiveSection] = useState("accessorials")

  return (
    <div className="flex min-h-screen bg-[#080D1D]">
      {/* Sidebar */}
      <div className="w-64 bg-[#0B1120] border-r border-white/10 p-6">
        <h2 className="text-xl font-bold text-white mb-6">Administration</h2>
        <nav className="space-y-2">
          <button
            onClick={() => setActiveSection("accessorials")}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
              activeSection === "accessorials"
                ? "bg-[#E8700A] text-white font-medium"
                : "text-gray-400 hover:bg-white/10"
            }`}
          >
            Accessorials
          </button>
          <button
            onClick={() => setActiveSection("groups")}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
              activeSection === "groups"
                ? "bg-[#E8700A] text-white font-medium"
                : "text-gray-400 hover:bg-white/10"
            }`}
          >
            Driver Groups
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {activeSection === "accessorials" && <AccessorialCatalogView />}
        {/* Other sections */}
      </div>
    </div>
  )
}
```

## Customization

### Changing Colors
Update the color constants in the component:
```tsx
// Change primary accent color from orange to blue
className="bg-[#3B82F6]" // Instead of bg-[#E8700A]
```

### Disabling Features
```tsx
// In AccessorialCatalogView, comment out:
// - Search functionality (search bar)
// - Filter pills
// - Edit functionality (pencil button)
// - Toggle functionality (toggle button)
```

### Adding Bulk Operations
```tsx
// Add checkbox column to table
<input type="checkbox" onChange={() => handleBulkSelect(accessorial.id)} />

// Add bulk action buttons
<button onClick={() => handleBulkDelete(selectedIds)}>Delete Selected</button>
<button onClick={() => handleBulkUpdate(selectedIds, { is_active: true })}>
  Activate All
</button>
```

## Testing

### Test Data Creation
```sql
INSERT INTO accessorials (code, name, charge_type, default_amount, trigger_type, trigger_config, is_active)
VALUES
  ('DETENTION', 'Detention Charge', 'fixed', 75.00, 'event_threshold', '{"field":"detention_hours","operator":">","threshold":2}', true),
  ('HAZMAT', 'Hazmat Surcharge', 'percentage', 15.00, 'load_property', '{"field":"is_hazmat","value":true}', true),
  ('REEFER', 'Reefer Charge', 'per_hour', 5.00, 'load_property', '{"field":"is_reefer","value":true}', true),
  ('RESIDENTIAL', 'Residential Delivery', 'fixed', 50.00, 'location_type', '{"location_type":"residential"}', true);
```

### Manual Testing Checklist
- [ ] Display all accessorials
- [ ] Search by code and name
- [ ] Filter by charge type
- [ ] Create new accessorial
- [ ] Edit existing accessorial
- [ ] Toggle active/inactive status
- [ ] Modal closes on cancel
- [ ] API errors display alerts
- [ ] Loading states show spinner
- [ ] Empty state shows message

## Performance Considerations

1. **Large Datasets**: If > 1000 accessorials, implement pagination:
   ```tsx
   const [page, setPage] = useState(1)
   const itemsPerPage = 50
   const paginatedData = filteredAccessorials.slice(
     (page - 1) * itemsPerPage,
     page * itemsPerPage
   )
   ```

2. **Virtual Scrolling**: For very large tables, consider virtualization library

3. **Debounced Search**: Already implemented via React state, consider adding debounce:
   ```tsx
   const debouncedSearch = useCallback(
     debounce((query) => setSearchQuery(query), 300),
     []
   )
   ```

## Error Handling

The component includes error handling for:
- Network failures
- Invalid form data
- API errors (400, 500, etc.)
- Missing data

All errors display user-friendly alert messages.

## Accessibility

The component includes:
- Semantic HTML structure
- ARIA labels on icon buttons
- Color contrast compliance
- Keyboard navigation
- Focus management

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Related Documentation

- [Component README](./components/tables/ACCESSORIAL_CATALOG_README.md)
- [API Routes](./app/api/drivers/pay-rates/accessorials/route.ts)
- [Driver Groups API](./app/api/drivers/pay-rates/groups/route.ts)

## Troubleshooting

### Component not rendering
- Ensure "use client" directive is present
- Check that page/layout is not accidentally marking as server component
- Verify all imports resolve correctly

### API calls failing
- Check that user is authenticated
- Verify user has "admin" or "dispatcher" role
- Ensure Supabase tables exist and have correct RLS policies
- Check browser console for detailed error messages

### Styling issues
- Verify Tailwind CSS is properly configured
- Check that bg-[#0B1120] and other custom colors exist in tailwind config
- Ensure dark mode is enabled in tailwind config

### Data not updating
- Check that PATCH endpoint returns updated record
- Verify is_active toggle sets correct value
- Check network tab to see actual API response

## Future Enhancements

1. **Driver Group Rules**: Implement accessorial_group_rules table and UI
2. **Bulk Operations**: Add select checkboxes and bulk action buttons
3. **Import/Export**: CSV functionality for backup and migration
4. **Audit Log**: Track who created/modified each accessorial
5. **Duplicate**: Clone existing accessorial with new code
6. **Approval Workflow**: Add pending/approved status for new accessorials
7. **Rate History**: Track historical amount changes
8. **Usage Analytics**: Show which accessorials are most frequently applied
