# Reporting Implementation Overview

## Scope
This document describes how reporting is currently implemented across the backend APIs and the frontend UI in PrimePOS. It reflects the code as of Feb 9, 2026.

## Backend (Django/DRF)
### Routing
Reporting endpoints are registered in [backend/apps/reports/urls.py](backend/apps/reports/urls.py). The endpoints are REST-style function views that return JSON.

### Data Sources
Reporting views aggregate data from the following models:
- Sales and items: `Sale`, `SaleItem`
- Products and categories: `Product`, `Category`
- Customers: `Customer`
- Inventory: `StockMovement`, `StockTake`, `StockTakeItem`
- Shifts: `Shift`

These are implemented in [backend/apps/reports/views.py](backend/apps/reports/views.py).

### Common Filters & Tenancy
- Tenant is resolved from `request.tenant` or `request.user.tenant`.
- Outlet scoping is enforced using `X-Outlet-ID` or `?outlet`/`?outlet_id` query params.
- Date range filters use `start_date` and `end_date` when applicable.
- Most endpoints require an outlet; if missing, a 400 is returned (or empty for sales report).

### Endpoint Details
1) Sales Report
- URL: `/reports/sales/`
- Filters: `start_date`, `end_date`, `outlet`, `payment_method`
- Aggregates:
  - `total_sales`, `total_revenue`, `total_tax`, `total_discount`
  - Top products by revenue from `SaleItem`
- Implementation: [backend/apps/reports/views.py](backend/apps/reports/views.py)

2) Products Report
- URL: `/reports/products/`
- Filters: `start_date`, `end_date`, `outlet`
- Behavior: outlet-scoped product list + sales totals per product
- Implementation: [backend/apps/reports/views.py](backend/apps/reports/views.py)

3) Customers Report
- URL: `/reports/customers/`
- Filters: none (tenant scoped)
- Aggregates: total customers, points, total spent, average points, top customers
- Implementation: [backend/apps/reports/views.py](backend/apps/reports/views.py)

4) Profit & Loss
- URL: `/reports/profit-loss/`
- Filters: `start_date`, `end_date`, `outlet`
- Aggregates: total revenue, cost (from product cost), gross profit, margin
- Implementation: [backend/apps/reports/views.py](backend/apps/reports/views.py)

5) Stock Movement
- URL: `/reports/stock-movement/`
- Filters: `start_date`, `end_date`, `outlet`, `movement_type`
- Aggregates: total quantity by movement type
- Implementation: [backend/apps/reports/views.py](backend/apps/reports/views.py)

6) Daily Sales
- URL: `/reports/daily-sales/`
- Filters: `date`, `outlet`
- Aggregates: totals, by payment method, by shift
- Implementation: [backend/apps/reports/views.py](backend/apps/reports/views.py)

7) Top Products
- URL: `/reports/top-products/`
- Filters: `start_date`, `end_date`, `outlet`, `limit`
- Aggregates: quantity, revenue, sale count per product
- Implementation: [backend/apps/reports/views.py](backend/apps/reports/views.py)

8) Cash Summary
- URL: `/reports/cash-summary/`
- Filters: `date`, `outlet`
- Aggregates: cash totals; shift-level cash summaries for closed shifts
- Implementation: [backend/apps/reports/views.py](backend/apps/reports/views.py)

9) Shift Summary
- URL: `/reports/shift-summary/`
- Filters: `start_date`, `end_date`, `outlet`
- Aggregates: shift-level revenue and cash totals
- Implementation: [backend/apps/reports/views.py](backend/apps/reports/views.py)

10) Inventory Valuation
- URL: `/reports/inventory-valuation/`
- Filters: `start_date`, `end_date`, `outlet`, `category`
- Behavior: builds a stock valuation grid using stock movements and latest stock take
- Implementation: [backend/apps/reports/views.py](backend/apps/reports/views.py)

### Summary Tables (PostgreSQL)
A materialized view for daily payment summaries is created via migrations and can be refreshed by a management command:
- Migration: [backend/apps/sales/migrations/1007_payment_summary_fix.py](backend/apps/sales/migrations/1007_payment_summary_fix.py)
- Command: [backend/apps/sales/management/commands/refresh_payment_summary.py](backend/apps/sales/management/commands/refresh_payment_summary.py)

This is not currently used by the report views directly but is available for future performance-focused reporting.

## Frontend (Next.js)
### API Endpoints
Client-side endpoint mapping lives in [frontend/lib/api.ts](frontend/lib/api.ts#L550-L590).

### Report Service Layer
The frontend uses `reportService` to call the report endpoints:
- [frontend/lib/services/reportService.ts](frontend/lib/services/reportService.ts)

Functions include:
- `getSalesReport`, `getProductReport`, `getCustomerReport`, `getProfitLoss`
- `getInventoryValuation`, `getDailySales`, `getTopProducts`, `getCashSummary`, `getShiftSummary`

### UI Pages
The reports landing page and report-specific views live here:
- Index: [frontend/app/dashboard/office/reports/page.tsx](frontend/app/dashboard/office/reports/page.tsx)

Sales report page:
- [frontend/app/dashboard/office/reports/sales/page.tsx](frontend/app/dashboard/office/reports/sales/page.tsx)
- Uses `saleService.list` for chart data (grouped by date) and `reportService.getTopProducts` for the top products table.

Products report page:
- [frontend/app/dashboard/office/reports/products/page.tsx](frontend/app/dashboard/office/reports/products/page.tsx)
- Uses `productService.list` and computes display data in the client.

Customers report page:
- [frontend/app/dashboard/office/reports/customers/page.tsx](frontend/app/dashboard/office/reports/customers/page.tsx)
- Uses `customerService.list` and performs client-side ranking and tier labeling.

Profit & Loss report page:
- [frontend/app/dashboard/office/reports/profit-loss/page.tsx](frontend/app/dashboard/office/reports/profit-loss/page.tsx)
- Uses `reportService.getProfitLoss`.
- Expenses are currently set to `0` on the client (placeholder logic).

Stock movement report page:
- [frontend/app/dashboard/office/reports/stock-movement/page.tsx](frontend/app/dashboard/office/reports/stock-movement/page.tsx)
- Uses `inventoryService.getMovements`.
- Date filters exist in UI, but the request only sends `outlet` and `movement_type` (no date filters passed).

Expenses report page:
- [frontend/app/dashboard/office/reports/expenses/page.tsx](frontend/app/dashboard/office/reports/expenses/page.tsx)
- Uses `expenseService.list` with `status: approved`.
- Client-side category breakdown and totals.

### Export/Print/Settings
Most report pages integrate:
- `DataExchangeModal` for export
- `PrintReportModal` for printing
- `ReportSettingsModal` for settings

These are wired in each report page using `dataExchangeConfigs.reports`.

## Current Gaps / Notes
- Profit & Loss page uses backend totals but does not yet integrate real expenses from the API in the calculation (expenses are mocked to 0 in UI).
- Stock movement page shows date filters but does not send `start_date`/`end_date` to the backend.
- Sales report chart uses all completed sales returned by `saleService.list` without applying the date filter to the backend call.
- The daily payment summary materialized view exists but is not yet used by report endpoints.

## Related Files
- Backend endpoints: [backend/apps/reports/views.py](backend/apps/reports/views.py)
- Backend routing: [backend/apps/reports/urls.py](backend/apps/reports/urls.py)
- Frontend API map: [frontend/lib/api.ts](frontend/lib/api.ts#L550-L590)
- Frontend report service: [frontend/lib/services/reportService.ts](frontend/lib/services/reportService.ts)
- Frontend report pages: [frontend/app/dashboard/office/reports](frontend/app/dashboard/office/reports)
