# Internal Architecture Overview

## System Summary
PrimePOS is a multi-tenant ERP with modular domains:
- POS and Sales
- Inventory and Products
- CRM Customers
- E-commerce Storefront
- Fleet Management

## High-Level Components
- Frontend: Next.js web application (dashboard + public storefront)
- Backend: Django + DRF API services
- Database: relational database (tenant-scoped records)
- Media/Assets: cloud/local storage depending on environment

## Multi-Tenant Model
- Tenant is the top isolation boundary.
- Outlets belong to tenant.
- Sales, inventory, customers, and storefronts are tenant-scoped.
- Public storefront resolves tenant by slug/domain, not by user-supplied tenant ID.

## Storefront Architecture
- Admin management under dashboard storefront routes.
- Public storefront under slug routes.
- Catalog rules control product visibility.
- Checkout creates backend order and then opens WhatsApp handoff.

## Data Flow Example: Storefront Order
1. Customer selects products.
2. Frontend calls `checkout/create-order`.
3. Backend validates products and stock.
4. Backend creates sale + storefront order record.
5. Frontend opens WhatsApp URL.
6. Admin sees order in dashboard orders list.

## Observability Recommendations
- Log all create-order failures with request context.
- Track checkout success/failure events.
- Add dashboard metrics for order funnel conversion.
