# Financial Reports Module - File Structure

## Overview
Complete Financial Reports section for TigerHawk TMS Reports module with 5 interactive financial dashboards.

## Directory Structure
```
mnt/tigerhawk-tms/
├── app/dashboard/reports/financial/
│   ├── page.tsx                           # Landing page with report cards
│   ├── revenue/page.tsx                   # Revenue by Customer report
│   ├── aging/page.tsx                     # A/R Aging report
│   ├── profit/page.tsx                    # Profit Margin report
│   ├── settlements/page.tsx               # Settlement Summary report
│   └── accessorials/page.tsx              # Accessorial Analysis report
│
└── components/reports/financial/
    ├── FinancialLanding.tsx               # Landing page component
    ├── RevenueReport.tsx                  # Revenue by Customer component
    ├── AgingReport.tsx                    # A/R Aging component
    ├── ProfitReport.tsx                   # Profit Margin component
    ├── SettlementReport.tsx               # Settlement Summary component
    └── AccessorialReport.tsx              # Accessorial Analysis component
```

## Files Created (12 Total)

### 1. Server Components (Page Routes)
- `/app/dashboard/reports/financial/page.tsx`
- `/app/dashboard/reports/financial/revenue/page.tsx`
- `/app/dashboard/reports/financial/aging/page.tsx`
- `/app/dashboard/reports/financial/profit/page.tsx`
- `/app/dashboard/reports/financial/settlements/page.tsx`
- `/app/dashboard/reports/financial/accessorials/page.tsx`

### 2. Client Components
- `components/reports/financial/FinancialLanding.tsx`
- `components/reports/financial/RevenueReport.tsx`
- `components/reports/financial/AgingReport.tsx`
- `components/reports/financial/ProfitReport.tsx`
- `components/reports/financial/SettlementReport.tsx`
- `components/reports/financial/AccessorialReport.tsx`

## Report Features

### Financial Landing
- 5 report cards with icons and descriptions
- Links to all sub-reports
- Dark theme styling with hover effects

### 1. Revenue by Customer
- Filters: Date range selector (default 90 days)
- KPIs: Total Revenue, Total Collected, Outstanding
- Chart: Bar chart of top 15 customers by revenue
- Table: Customer-level breakdown with collection %
- Export: CSV download functionality

### 2. A/R Aging Report
- KPIs: Total Outstanding, Total Overdue, Open Invoice Count
- Charts: 
  - Aging bucket summary (Current, 1-30, 31-60, 61-90, 90+)
  - Stacked horizontal bar by customer
- Table: Customer aging breakdown by bucket
- Export: CSV with aging details

### 3. Profit Margin Report
- Filters: Date range selector (default 90 days)
- KPIs: Total Revenue, Total Driver Pay, Gross Profit, Margin %
- Chart: Revenue vs Driver Pay comparison by customer
- Table: Customer profitability with margin %
- Color coding: Margin quality (green >20%, yellow >10%, red <10%)
- Export: CSV with profit analysis

### 4. Settlement Summary
- Filters: Date range selector (default 90 days)
- KPIs: Total Gross Pay, Total Deductions, Total Net Pay
- Chart: Gross Pay & Deductions by driver
- Table: Driver settlement breakdown
- Export: CSV with settlement details

### 5. Accessorial Analysis
- Filters: Date range selector (default 90 days)
- KPIs: Total Charges, Line Items, Category Count
- Charts:
  - Pie chart of charges by category
  - Breakdown list with amounts
- Table: Charge codes reference
- Export: CSV with category analysis

## Database Integration

### Tables Used:
- `ar_invoices`: Accounts Receivable invoices
- `ap_settlements`: Accounts Payable driver settlements
- `ap_driver_pay`: Driver pay records
- `load_billing`: Billing items per load
- `loads`: Load reference data
- `charge_codes`: Charge codes and categories
- `customers`: Customer master data
- `drivers`: Driver master data

## Dependencies
- Recharts (charts and visualizations)
- Lucide React (icons)
- Supabase (data fetching)
- Next.js (routing and server components)
- React (client components)

## Theme Configuration
- Background: #0B1120
- Panels: #111827
- Accent: #E8700A (orange)
- Borders: white/10
- Text: gray-400

## Features Implemented
- Real-time Supabase data integration
- Date range filtering (90-day default)
- KPI cards with contextual styling
- Interactive Recharts visualizations
- Responsive grid layouts
- CSV export functionality
- Dark theme with color-coded metrics
- Proper TypeScript typing
- Accessibility-ready tables
- Hover effects and transitions
- Currency formatting
- Percentage calculations
- Data aggregation and sorting
