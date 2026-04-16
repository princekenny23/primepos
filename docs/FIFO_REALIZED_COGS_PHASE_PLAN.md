# PrimePOS FIFO / Realized COGS Phase Plan

Date: 2026-04-12
Status: Design-ready, no runtime behavior changes

## 1. Current State

PrimePOS already contains part of the required inventory costing foundation:

- Product master cost exists on `Product.cost`
- Sale-time snapshot cost now exists on `SaleItem.cost`
- Inventory batches already exist on `Batch`
- Batch cost exists on `Batch.cost_price`
- Stock deduction already returns per-batch deductions from `deduct_stock(...)`

Relevant code:

- `backend/apps/products/models.py`
- `backend/apps/sales/models.py`
- `backend/apps/inventory/models.py`
- `backend/apps/inventory/stock_helpers.py`

## 2. Important Clarification

The current inventory deduction logic is not true accounting FIFO by receipt date.

It currently behaves as FEFO-style stock issue logic:

- batches are ordered by `expiry_date`, then `created_at`
- earliest-expiring stock is consumed first

This is good operational logic for perishables, but it is not a full accounting-costing engine yet.

## 3. Gap To Close

Right now, stock moves through batches, but accounting does not know exactly which batch cost was consumed by each `SaleItem`.

That means:

- stock quantity is batch-aware
- COGS reporting is sale-line snapshot based
- realized COGS is not yet batch-allocation based

To become Odoo-like, each sale line must store or reference the exact batch allocations consumed.

## 4. Recommended Next Model

Add a new allocation ledger model.

Suggested model name:

- `SaleItemBatchAllocation`

Suggested fields:

- `sale_item` -> FK to `SaleItem`
- `batch` -> FK to `Batch`
- `quantity` -> quantity consumed from that batch
- `unit_cost` -> batch cost used at time of allocation
- `total_cost` -> `quantity * unit_cost`
- `created_at`

Purpose:

- preserve exact realized COGS per sale line
- support multi-batch deductions for one sale line
- allow future audit and gross margin traceability

## 5. Recommended Posting Flow

### For completed cash / immediate sales

When stock is deducted:

1. call `deduct_stock(...)`
2. receive returned `(batch, deducted_qty)` tuples
3. create one `SaleItemBatchAllocation` row per tuple
4. calculate sale line realized cost from allocations

### For initiated / pending / delivery-required sales

Do not allocate batches at initial draft creation.

Allocate only at the inventory commitment point:

- `finalize_payment`
- or delivery confirmation
- or sale completion event

This avoids reserving historical cost too early and keeps batch depletion aligned with real stock movement.

## 6. Profit Logic For Phase 2

After allocations exist, profit calculations should use this priority:

1. sum `SaleItemBatchAllocation.total_cost`
2. fallback to `SaleItem.cost`
3. fallback to `Product.cost` only for legacy rows

That gives a clean migration path:

- old data still reports
- new sales become realized-cost accurate
- no hard break in production

## 7. Recommended Reporting Hierarchy

### Profit & Loss

Use:

- revenue = sum completed sales
- cogs = sum allocation totals
- gross profit = revenue - cogs
- net profit = gross profit - approved expenses

### Daily Chart

Use:

- daily revenue from completed sales
- daily cogs from allocation totals
- daily profit = daily revenue - daily cogs

### Margin By Product

Possible later KPI:

- product revenue
- product realized cogs
- product gross margin

## 8. Why This Fits PrimePOS

This approach is low-risk because it builds on inventory structures already present:

- `Batch`
- `Batch.cost_price`
- `deduct_stock(...)`
- sale completion flows

It does not require replacing the existing stock engine.

It only adds accounting traceability on top of it.

## 9. Recommended Rollout Order

### Phase 2A

- add `SaleItemBatchAllocation`
- persist allocations for completed sales
- do not change current P&L yet

### Phase 2B

- switch reports to prefer allocation totals
- keep fallback to `SaleItem.cost`

### Phase 2C

- backfill if possible for future reporting windows
- add audit report showing batch-to-sale cost trace

## 10. Design Decision

Do not replace `SaleItem.cost`.

Keep it as a stable sale-time snapshot because:

- it is simple
- it supports legacy and quick reporting
- it remains useful even after batch allocations exist

Treat `SaleItem.cost` as the fast snapshot layer.

Treat `SaleItemBatchAllocation` as the accounting-grade realized-cost layer.

## 11. Final Recommendation

PrimePOS does not need a new inventory architecture.

It already has enough structure to support the next accounting upgrade.

The correct next move is:

- keep current runtime logic stable
- add batch-to-sale allocation ledger
- upgrade reports to realized COGS in a second controlled rollout
