# Claude Prompt Templates for TigerHawk TMS

This document provides ready-to-use prompts for building the TigerHawk TMS with Claude's help. Copy and paste these prompts, filling in the bracketed sections with your specifics.

---

## Project Context (Use this in every new chat)

Paste this at the start of any new Claude conversation to give context:

```
I'm building a custom Transportation Management System (TMS) for TigerHawk Logistics,
a drayage company in Houston, TX. We're replacing PortPro ($4,500/month) with a
Next.js + Supabase solution.

Tech Stack:
- Frontend: Next.js 14, React, Tailwind CSS, shadcn/ui
- Backend: Next.js API routes, Supabase (PostgreSQL)
- Auth: Supabase Auth
- Hosting: Vercel
- External: Port Houston API for vessel tracking

Database Schema:
- customers: id, name, email, phone, address, portal_enabled
- vessels: id, name, voyage_number, terminal, eta, ata, etd
- containers: id, container_number, vessel_id, bol_number, size, type, status, available_date
- shipments: id, customer_id, container_id, reference_number, pickup_location,
  delivery_location, status, driver_id, chassis_number, scheduled_pickup, actual_pickup
- drivers: id, name, phone, license_number, status, current_location
- warehouse_inventory: id, customer_id, shipment_id, description, quantity, location,
  received_date, status

My partner is working on [frontend/backend]. I'm focusing on [your area].
```

---

## Frontend Development Prompts

### Creating a New Page

```
Create a Next.js page for [feature name] with the following requirements:

Context: [Paste project context above]

Requirements:
- Route: /[route-name]
- Display [data type] in a table/grid/list
- Include filters for [filter criteria]
- Add search by [search fields]
- Use shadcn/ui components for consistency
- Make it mobile-responsive
- Use Tailwind CSS for styling

Data structure:
[Describe or paste the relevant table schema]

Show me the complete page.tsx file.
```

**Example:**
```
Create a Next.js page for vessel tracking with the following requirements:

Context: [Paste project context]

Requirements:
- Route: /dashboard/vessels
- Display upcoming vessel arrivals in a table
- Include filters for terminal (BCT/BAY) and date range
- Add search by vessel name or voyage number
- Use shadcn/ui Table component
- Make it mobile-responsive
- Show vessel name, voyage, terminal, ETA, and status

Data comes from vessels table:
- id, name, voyage_number, terminal, eta, ata, etd, last_synced

Show me the complete app/dashboard/vessels/page.tsx file.
```

### Creating a Component

```
Create a React component for [component purpose].

Context: [Paste project context]

Requirements:
- Name: [ComponentName]
- Props: [list props with types]
- Functionality: [describe what it does]
- Styling: Use Tailwind CSS
- Include proper TypeScript types

[Additional specific requirements]

Show me the complete component code.
```

**Example:**
```
Create a React component for displaying a shipment status badge.

Context: [Paste project context]

Requirements:
- Name: ShipmentStatusBadge
- Props: status (string): "Created" | "Assigned" | "In Transit" | "Delivered"
- Functionality: Display color-coded badge based on status
- Styling: Use Tailwind CSS
  - Created: gray
  - Assigned: blue
  - In Transit: yellow
  - Delivered: green
- Make it accessible (proper aria labels)

Show me the complete component code in components/ShipmentStatusBadge.tsx
```

### Creating a Form

```
Create a form for [form purpose] using React Hook Form and Zod validation.

Context: [Paste project context]

Requirements:
- Fields: [list fields with types]
- Validation rules: [describe validation]
- On submit: [what happens]
- Use shadcn/ui Form components
- Include error handling
- Show loading state during submission

Show me:
1. The Zod schema
2. The complete form component
3. The API route it should call
```

**Example:**
```
Create a form for creating a new shipment using React Hook Form and Zod validation.

Context: [Paste project context]

Requirements:
- Fields:
  - customer_id (select from customers)
  - container_id (select from available containers)
  - reference_number (text, required)
  - pickup_location (text, required)
  - delivery_location (text, required)
  - scheduled_pickup (datetime)
- Validation: all fields required except scheduled_pickup
- On submit: POST to /api/shipments
- Use shadcn/ui Form, Select, Input components
- Include error handling and success message
- Show loading state during submission

Show me:
1. The Zod schema
2. The complete form component in components/forms/CreateShipmentForm.tsx
3. The API route in app/api/shipments/route.ts
```

---

## Backend Development Prompts

### Creating an API Route

```
Create a Next.js API route for [endpoint purpose].

Context: [Paste project context]

Requirements:
- Method: [GET/POST/PUT/DELETE]
- Route: /api/[route]
- Input: [describe request body/params]
- Output: [describe response format]
- Database operations: [what it does with Supabase]
- Error handling: [specific error cases]
- Authentication: [if required]

Show me the complete route.ts file with proper TypeScript types.
```

**Example:**
```
Create a Next.js API route for fetching vessel schedules.

Context: [Paste project context]

Requirements:
- Method: GET
- Route: /api/vessels
- Query params: terminal (optional), startDate, endDate
- Output: Array of vessel objects with all fields
- Database: Query Supabase vessels table
- Filter by terminal if provided
- Filter by ETA between startDate and endDate
- Error handling: Return 400 for invalid dates, 500 for database errors
- Authentication: Require valid Supabase session

Show me the complete app/api/vessels/route.ts file with proper TypeScript types.
```

### Port Houston API Integration

```
Create a script to sync vessel schedules from Port Houston API to Supabase.

Context: [Paste project context]

Requirements:
- Fetch vessel schedules from Port Houston GetVesselSchedule API
- Authentication: OAuth 2.0 with client credentials
- Store/update vessels in Supabase vessels table
- Handle: new vessels (insert), existing vessels (update)
- Date range: next 14 days
- Both terminals: BCT and BAY
- Error handling and logging
- Can be run as Vercel cron job

Environment variables:
- PORT_HOUSTON_CLIENT_ID
- PORT_HOUSTON_CLIENT_SECRET
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Show me the complete script with error handling.
```

### Database Query

```
Write a Supabase query for [query purpose].

Context: [Paste project context]

Requirements:
- Table: [table name]
- Select: [fields]
- Filter: [conditions]
- Join: [if needed, describe relationships]
- Sort: [order by]
- Return: [TypeScript type]

Show me the query using Supabase JavaScript client.
```

**Example:**
```
Write a Supabase query to get all shipments for a customer with container and driver details.

Context: [Paste project context]

Requirements:
- Table: shipments
- Select: all shipment fields, plus container details and driver name
- Filter: customer_id matches parameter
- Join: containers table and drivers table
- Sort: scheduled_pickup descending (newest first)
- Return: TypeScript type ShipmentWithDetails[]

Show me the query using Supabase JavaScript client with proper types.
```

---

## Integration Prompts

### Setting Up Authentication

```
Show me how to set up Supabase authentication for the TigerHawk TMS.

Context: [Paste project context]

I need:
1. Supabase auth configuration
2. Login page with email/password
3. Protected route middleware for authenticated pages
4. Sign out functionality
5. Get current user in components
6. Role-based access (admin, dispatcher, driver, customer roles)

Show me all the necessary code and configuration.
```

### Email Notifications

```
Create an email notification system for [notification type].

Context: [Paste project context]

Requirements:
- Trigger: [when to send]
- Recipients: [who receives it]
- Content: [what information to include]
- Email service: Resend
- Template: Professional HTML email
- Include: Company branding, relevant links

Show me:
1. The email template (React Email or HTML)
2. The function to send the email
3. Where to call it in the application
```

**Example:**
```
Create an email notification system for container availability alerts.

Context: [Paste project context]

Requirements:
- Trigger: When container status changes to "Available"
- Recipients: Customer associated with the shipment
- Content: Container number, BOL, available date, last free day, pickup instructions
- Email service: Resend
- Template: Professional HTML email
- Include: TigerHawk Logistics branding, link to customer portal

Show me:
1. The email template
2. The function to send the email in lib/email.ts
3. Where to call it in the container update API route
```

---

## Troubleshooting Prompts

### Debugging Errors

```
I'm getting this error in my TigerHawk TMS:

[Paste error message]

Context: [Paste project context]

What I'm trying to do:
[Describe what you're building/doing]

The code:
[Paste relevant code]

How do I fix this?
```

### Code Review

```
Review this code for the TigerHawk TMS and suggest improvements:

Context: [Paste project context]

[Paste your code]

Check for:
- TypeScript best practices
- Performance issues
- Security concerns
- Error handling
- Code organization
- Accessibility

Provide specific recommendations.
```

### Fixing a Bug

```
I have a bug in [feature name] of the TigerHawk TMS:

Context: [Paste project context]

Expected behavior:
[What should happen]

Actual behavior:
[What actually happens]

Relevant code:
[Paste code]

Console errors:
[Paste any errors]

How do I fix this?
```

---

## Testing Prompts

### Writing Tests

```
Write tests for [component/function name] in the TigerHawk TMS.

Context: [Paste project context]

Code to test:
[Paste code]

Test framework: Jest + React Testing Library

Test cases:
- [List specific scenarios to test]

Show me the complete test file.
```

### Test Data Generation

```
Generate realistic test data for the TigerHawk TMS database.

Context: [Paste project context]

I need:
- 5 customers
- 10 vessels (next 2 weeks)
- 30 containers on various vessels
- 20 shipments in different statuses
- 5 drivers

Format: SQL INSERT statements or Supabase JavaScript client code

Include realistic Houston-area addresses and terminal data.
```

---

## Styling Prompts

### Component Styling

```
Style this component for the TigerHawk TMS using Tailwind CSS:

Context: [Paste project context]

[Paste component code]

Design requirements:
- Professional, modern look
- Blue/gray color scheme (match TigerHawk branding)
- Mobile-responsive
- Accessible (proper contrast, focus states)
- Consistent with dashboard design

Show me the updated component with Tailwind classes.
```

### Dashboard Layout

```
Create a dashboard layout for the TigerHawk TMS.

Context: [Paste project context]

Requirements:
- Sidebar navigation with: Dashboard, Vessels, Containers, Shipments, Drivers,
  Warehouse, Customers, Reports
- Top bar with: user menu, notifications, search
- Main content area
- Mobile-responsive (collapsible sidebar)
- Use shadcn/ui components
- Professional blue/gray color scheme

Show me the complete layout component.
```

---

## Documentation Prompts

### API Documentation

```
Generate API documentation for [endpoint].

Context: [Paste project context]

[Paste API route code]

Include:
- Endpoint URL and method
- Authentication requirements
- Request parameters/body
- Response format
- Error codes
- Example request/response

Format as markdown.
```

### User Guide

```
Write user documentation for [feature] in the TigerHawk TMS.

Context: [Paste project context]

Audience: [dispatchers/customers/drivers]

Include:
- Step-by-step instructions
- Screenshots descriptions
- Common issues and solutions
- Tips and best practices

Format as markdown.
```

---

## Advanced Prompts

### Performance Optimization

```
Optimize this code for performance in the TigerHawk TMS:

Context: [Paste project context]

[Paste code]

Current issues:
- [Describe performance problems]

Suggest:
- Database query optimizations
- React rendering optimizations
- Caching strategies
- Code splitting opportunities

Show me the optimized code with explanations.
```

### Security Review

```
Review the security of this code for the TigerHawk TMS:

Context: [Paste project context]

[Paste code]

Check for:
- SQL injection vulnerabilities
- XSS vulnerabilities
- Authentication/authorization issues
- Data exposure risks
- API security best practices

Provide specific fixes for any issues found.
```

---

## Continuation Prompts

When Claude's response is cut off or you need more:

```
Continue from where you left off.
```

```
Show me the rest of the code.
```

```
Now show me [next part].
```

```
Can you also add [additional feature]?
```

---

## Tips for Best Results

### ✅ Do:
- **Provide context** - Always include project context in new conversations
- **Be specific** - The more details, the better the response
- **Show examples** - Paste existing code for consistency
- **Ask for explanations** - "Explain why you did X"
- **Iterate** - "This is close, but can you adjust Y?"
- **Request TypeScript types** - Always ask for proper typing

### ❌ Don't:
- Ask vague questions without context
- Expect Claude to remember previous conversations
- Paste huge files (break into smaller chunks)
- Ask for "the best way" without constraints

### Improve Responses:
- "Make it more [specific quality]"
- "Simplify this"
- "Add more error handling"
- "Make it production-ready"
- "Follow Next.js 14 best practices"

---

## Partner Coordination Prompt

When taking over work from your partner:

```
My partner built [feature] for the TigerHawk TMS. I need to integrate with it.

Context: [Paste project context]

Their code:
[Paste partner's code]

I'm building [your feature] that needs to:
- [Describe integration points]

How should I:
1. Connect to their API/component?
2. Handle data flow between our features?
3. Maintain consistency with their approach?

Show me the code for my part.
```

---

## Quick Reference

**Start new conversation:**
→ Paste project context

**Build UI:**
→ Use "Creating a Page" or "Creating a Component" template

**Build API:**
→ Use "Creating an API Route" template

**Having issues:**
→ Use "Debugging Errors" or "Fixing a Bug" template

**Need to match existing code:**
→ Paste existing code and ask to "create similar code for [new feature]"

**Continuing from partner's work:**
→ Use "Partner Coordination Prompt"

---

## Example: Complete Feature Request

Here's an example of a complete, well-structured prompt:

```
Create a complete container tracking feature for the TigerHawk TMS.

CONTEXT:
I'm building a custom TMS for TigerHawk Logistics using Next.js 14, Supabase, and Tailwind CSS.
We track drayage operations in Houston with Port Houston integration.

Database schema:
- containers: id, container_number, vessel_id, bol_number, size, type, status, available_date,
  last_free_day, appointment_id
- vessels: id, name, voyage_number, terminal, eta
- shipments: id, container_id, customer_id, reference_number, status

REQUIREMENTS:
1. Page at /dashboard/containers
2. Table showing: container #, BOL, vessel name, status, available date, days until demurrage
3. Search by container # or BOL
4. Filter by status: All, On Vessel, Available, Released, Picked Up
5. Click row to see details
6. Button to create gate appointment (calls Port Houston API)
7. Mobile-responsive
8. Use shadcn/ui Table, Input, Select, Button components

DELIVERABLES:
Show me:
1. app/dashboard/containers/page.tsx - The main containers list page
2. components/ContainerDetailsModal.tsx - Modal for container details
3. app/api/containers/route.ts - API to fetch containers with vessel data
4. app/api/containers/[id]/appointment/route.ts - API to create gate appointment

Include proper TypeScript types, error handling, and loading states.
```

---

**Remember:** The more context and detail you provide, the better Claude can help you build exactly what you need!
