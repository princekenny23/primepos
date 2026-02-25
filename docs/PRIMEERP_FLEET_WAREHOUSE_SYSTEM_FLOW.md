# PrimeERP: Warehouse + Fleet Management System Flow

**Date**: 2026-02-25  
**Context**: Extend current PrimePOS multi-tenant platform into **PrimeERP** for tenants that run warehouses and trucks (import/export logistics), even when they have no retail shops.

---

## 1) Why this should become PrimeERP (not only PrimePOS)

PrimePOS is already multi-tenant and has strong inventory foundations, but your new tenant profile is operationally logistics-first:
- No storefront checkout workflow
- Multiple warehouses and transit locations
- Truck/driver/route execution
- Import/export documents and customs lifecycle
- Delivery proof, fuel, maintenance, trip profitability

That scope is broader than POS. The right product positioning is:
- **PrimeERP Core** (tenant, users, permissions, analytics, billing)
- **Modules enabled per tenant**: POS, Warehouse, Fleet, Trade/Customs, Finance, HR

So POS becomes one module, not the product identity.

---

## 2) Target tenant types and operating modes

Add tenant operational mode (or tenant profile) with examples:
- `pos_retail`: current shop/counter flow
- `warehouse_fleet`: warehouse + trucks only
- `hybrid_distribution`: warehouse + trucks + optional counter/branch sales

This mode drives:
- Navigation/menu visibility
- Required setup wizard steps
- Permission defaults
- Dashboard KPIs
- Billing package/feature flags

---

## 3) PrimeERP module map (for your case)

### Core Platform (shared)
- Tenant isolation and auth
- User/role/permission control
- Outlet/location hierarchy
- Audit logs and notifications
- API gateway + reporting layer

### Warehouse Management (WMS)
- Warehouse master data (zones, bins, docks)
- Inbound: ASN/receiving, putaway
- Inventory ledger + lot/batch + expiry
- Internal transfers and allocation
- Outbound: pick, pack, load, dispatch
- Cycle counts and variance handling

### Fleet Management (TMS-lite)
- Truck/vehicle registry and capacity profiles
- Driver management and compliance docs
- Trip planning, assignment, dispatch
- Live trip status and milestone tracking
- Fuel, tolls, repairs, maintenance plans
- Route performance and cost/km analytics

### Trade & Customs (Import/Export)
- Shipment and container records
- BL/AWB, commercial invoice, packing list linkage
- Customs declaration checkpoints
- Duty/tax/clearance status
- Port-to-warehouse and warehouse-to-border tracking

### Finance Linkage (ERP layer)
- Landed cost allocation to inventory
- Payables (suppliers, transporters, fuel vendors)
- Receivables (delivery billing, freight billing)
- Cost-to-serve and trip profitability

---

## 4) Master data model (conceptual)

### Existing entities to keep
- Tenant
- Outlet (reinterpret as operational location)
- Product
- Batch / StockMovement / LocationStock
- Staff/User roles

### New core entities to introduce

#### Warehouse domain
- `Warehouse` (can be implemented as Outlet subtype or dedicated model)
- `WarehouseZone`
- `WarehouseBin`
- `DockDoor`
- `InventoryHolding` (bin-level on-hand)
- `ReceivingOrder` (inbound)
- `DispatchOrder` (outbound)
- `PickTask` / `LoadTask`

#### Fleet domain
- `Vehicle`
- `VehicleType` (capacity, volume, axle class)
- `Driver`
- `Trip`
- `TripStop`
- `TripAssignment` (driver + vehicle + load)
- `FuelLog`
- `MaintenanceJob`
- `Incident`
- `ProofOfDelivery`

#### Trade domain
- `Shipment`
- `Container`
- `TradeDocument`
- `CustomsEntry`
- `DutyCharge`
- `PortEvent`

### Cross-domain links
- `DispatchOrder` -> `Trip`
- `TripStop` -> warehouse/customer/port location
- `Shipment` -> inbound receiving order
- `LandedCostAllocation` -> inventory batches/products

---

## 5) End-to-end operational flow (full system)

## A. Onboarding + setup
1. Tenant registers and selects `warehouse_fleet` mode.
2. Setup wizard collects:
   - Base company profile
   - Warehouse(s), port/yard addresses, geofences
   - Vehicle and driver master data
   - Product catalog + UOM + batch policy
   - Import/export document templates
3. System auto-creates role packs:
   - Operations Manager
   - Warehouse Supervisor
   - Dispatcher
   - Driver App User
   - Customs/Documentation Officer
   - Finance Officer

Output: tenant is production-ready for logistics operations without POS screens.

## B. Inbound (import purchase to warehouse)
1. Purchase/arrival notice created (`Shipment` + expected SKUs).
2. Truck/container arrives at gate; gate-in event captured.
3. Receiving clerk records actual quantities, damages, expiry/lot.
4. System creates stock ledger movements (inbound) and assigns bins.
5. Quality hold or quarantine logic applied where needed.
6. Landed costs (freight, duty, clearing, port fees) captured.
7. Costs allocated to batches for true inventory valuation.

Output: sellable warehouse stock with auditable landed cost.

## C. Storage + control
1. Inventory is tracked by warehouse/bin/batch.
2. Reorder, expiry, and slow-moving alerts run daily.
3. Cycle counts reconcile physical vs system stock.
4. Variances require approval workflow and reason codes.
5. Audit trail stores who changed what and when.

Output: high-confidence stock integrity and compliance traceability.

## D. Outbound (export/distribution)
1. Sales/export order (or transfer order) enters queue.
2. Allocation engine reserves eligible batches (FIFO/FEFO policy).
3. Picking tasks generated per zone/bin.
4. Packed goods staged at dock with load manifest.
5. Dispatch creates trip linked to vehicle + driver + route.
6. Gate-out event triggers in-transit status.

Output: controlled warehouse-to-truck handoff with full traceability.

## E. Trip execution (fleet lifecycle)
1. Dispatcher confirms departure and planned ETA milestones.
2. Driver app updates stop statuses (departed, arrived, delayed).
3. Exceptions captured (breakdown, border delay, accident, shortage).
4. Fuel/toll/expense records posted to trip cost ledger.
5. Delivery confirmation captures POD (signature/photo/time/location).
6. Trip closes and auto-generates performance + profitability metrics.

Output: complete operational and financial visibility per trip.

## F. Return / reverse logistics
1. Rejected/returned goods recorded from destination.
2. Return trip created (or appended stop to active route).
3. Inbound return inspection categorizes:
   - Resalable
   - Repair/rework
   - Scrap
4. Stock and finance ledgers update accordingly.

Output: controlled reverse flow and accurate valuation.

## G. Trade compliance flow (import/export)
1. Shipment created with required trade documents.
2. Customs milestones tracked (filed, assessed, cleared, released).
3. Duty and clearance fees posted.
4. Non-compliance blocks dispatch until mandatory docs exist.

Output: compliance-by-design with fewer border/port surprises.

## H. Reporting + decision layer
Dashboards for:
- Warehouse occupancy and throughput
- Inventory aging and expiry risk
- Vehicle utilization and on-time delivery
- Fuel efficiency and maintenance downtime
- Trip margin and cost-to-serve by customer/route
- Import/export clearance lead time

Output: management sees operational truth, not only sales numbers.

---

## 6) Permissions and tenant feature control

Use your existing tenant permission pattern and extend with module flags:
- `allow_warehouse`
- `allow_fleet`
- `allow_trade`
- `allow_finance_logistics`

Then granular feature flags, e.g.:
- `allow_warehouse_receiving`
- `allow_warehouse_dispatch`
- `allow_fleet_trip_create`
- `allow_fleet_maintenance`
- `allow_trade_customs`

Benefits:
- One codebase, multiple business models
- Package-based SaaS billing
- Clean tenant-specific UX

---

## 7) UX and app navigation model

For warehouse+fleet tenants:
- Hide POS checkout routes by default
- Home dashboard should open in **Operations Control Tower** view
- Main nav should be:
  1. Operations
  2. Warehouses
  3. Fleet
  4. Trade/Customs
  5. Inventory
  6. Finance
  7. Reports
  8. Settings

Driver-facing usage should be minimal UI (mobile-first):
- Assigned trips
- Stop checklist
- Expense capture
- POD capture

---

## 8) Data integrity and architecture guardrails

1. Keep immutable movement ledgers for stock and trip events.
2. Keep summary tables/caches, but never treat them as source of truth.
3. Enforce tenant + location scoping on every query.
4. Use status-driven workflows (draft -> approved -> dispatched -> completed).
5. Use idempotent APIs for device retries (driver mobile network issues).
6. Record all approvals and overrides with audit metadata.

---

## 9) API and integration pattern (high-level)

### Core API groups
- `/api/v1/warehouses/*`
- `/api/v1/fleet/*`
- `/api/v1/trade/*`
- `/api/v1/operations/*`

### Event flow
- Receiving posted -> inventory movement created
- Dispatch posted -> trip created -> movement to in-transit
- POD posted -> trip closed -> order fulfilled -> invoice trigger

### External integrations (phase-based)
- GPS/telematics provider
- Fuel card feeds
- Customs/clearance data source (country-specific)
- Accounting export (or embedded accounting module)

---

## 10) Migration path from PrimePOS to PrimeERP

## Phase 1: Positioning + tenant mode (quickest)
- Rename product umbrella to PrimeERP in UI/marketing/docs.
- Keep PrimePOS as a module label.
- Add tenant operational mode selection and menu gating.

## Phase 2: Warehouse-first MVP
- Receiving, putaway, stock ledger, picking, dispatch.
- Basic operations dashboard and warehouse reports.

## Phase 3: Fleet MVP
- Vehicles, drivers, trips, expenses, POD, maintenance basics.
- Trip performance reports.

## Phase 4: Trade/Customs + financial depth
- Import/export docs and customs milestone workflow.
- Landed cost engine and full profitability analysis.

## Phase 5: Optimization layer
- Route optimization, predictive maintenance, advanced SLA analytics.

---

## 11) KPI framework for warehouse+fleet tenants

Operational KPIs:
- Inbound receiving accuracy %
- Putaway lead time
- Pick accuracy %
- On-time dispatch %
- On-time delivery %

Fleet KPIs:
- Vehicle utilization %
- Cost per km
- Fuel consumption per ton-km
- Breakdown frequency
- Preventive maintenance compliance %

Trade KPIs:
- Customs clearance cycle time
- Document error rate
- Demurrage/port penalty cost

Financial KPIs:
- Landed cost variance %
- Gross margin by route/customer
- Cost-to-serve trend

---

## 12) Recommended final product structure

- **PrimeERP Platform** (core multi-tenant engine)
  - Module: PrimePOS (retail/restaurant/bar)
  - Module: PrimeWMS (warehouse)
  - Module: PrimeFleet (transport)
  - Module: PrimeTrade (import/export)
  - Module: PrimeFinance (optional depth)

This gives you one scalable product family where each tenant only sees and pays for what they use.

---

## 13) Immediate next execution decisions (non-code)

1. Approve naming model: PrimeERP umbrella + PrimePOS module.
2. Approve tenant modes (`pos_retail`, `warehouse_fleet`, `hybrid_distribution`).
3. Approve Phase 2 scope (Warehouse MVP) as first implementation wave.
4. Approve Fleet MVP data ownership (who creates trips, who closes trips, who approves expenses).
5. Approve country-specific customs workflow requirements for your initial market.

Once these are confirmed, implementation can proceed without architecture rework.
