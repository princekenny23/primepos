# PrimePOS Module Risk Assessment & Refactor Strategy

**Last Updated:** February 2026  
**Architecture Status:** UNITS ONLY ARCHITECTURE (ItemVariation model removed in migration 0016)  
**Critical Modals:** 20+ modal components managing sales, inventory, shifts, and payments

---

## Executive Summary

The codebase has evolved significantly from the original risk assessment:

✅ **Implemented & Stable:**
- Batch-based inventory system with FEFO logic
- Product+Unit architecture (no ItemVariation complexity)
- KitchenOrderTicket system for restaurant operations
- TransactionSafe stock helpers with atomic operations

⚠️ **Still at Risk:**
- Dual stock state (Product.stock field exists alongside batch-based system)
- Complex Sales transaction orchestration (20+ transaction types)
- 80+ critical UI modals managing business-critical workflows

🔴 **Current Focus Areas:**
- Resolve legacy Product.stock field deprecation
- Stabilize Sales transaction integrity under concurrent load
- Audit critical modal data flows for consistency

---

## Module Risk Ranking (Updated)

| Priority | Module | Risk Level | Coupling Score | Data Integrity Impact | Implementation Status | Critical Modals |
|----------|--------|------------|----------------|------------------------|----------------------|-----------------|
| 1 | Sales | CRITICAL | 8/10 | CATASTROPHIC | IMPLEMENTED | `quick-add-sale`, `payment-method`, `refund-confirmation`, `close-shift` |
| 2 | Inventory | HIGH | 9/10 | HIGH | IMPLEMENTED (Dual State) | `receive-stock`, `stock-adjustment`, `transfer-stock`, `low-stock-confirmation` |
| 3 | Shifts | HIGH | 6/10 | SEVERE | IMPLEMENTED | `close-shift`, `opening-cash`, `floating-cash`, `close-register` |
| 4 | Tenants + Outlets | HIGH | 9/10 | CATASTROPHIC | STABLE | `create-business`, `edit-tenant`, `outlet-selection` |
| 5 | Products | MEDIUM | 7/10 | MEDIUM | SIMPLIFIED | `product-modal-tabs` (4-tab editor), `order-product`, `product-selection` |
| 6 | Restaurant | MEDIUM | 6/10 | MEDIUM | IMPLEMENTED | `kitchen-order-ticket`, `hold-recall-sale`, `table-finder` |
| 7 | Bar | MEDIUM | 6/10 | MEDIUM | IMPLEMENTED | `open-tab`, `close-tab`, `merge-split-tables` |
| 8 | Customers | MEDIUM | 5/10 | MEDIUM | IMPLEMENTED | `add-edit-customer`, `merge-customer`, `loyalty-points-adjust` |
| 9 | Suppliers | LOW | 4/10 | MEDIUM | PARTIAL | `add-supplier`, `assign-supplier` |
| 10 | Reports | LOW | 5/10 | LOW | IMPLEMENTED | `print-report`, `report-settings`, `data-exchange` |
| 11 | Staff + Accounts | LOW | 5/10 | MEDIUM | STABLE | `add-edit-staff`, `add-edit-user`, `reset-password` |
| 12 | Notifications | LOW | 2/10 | LOW | POLLING-BASED | `notifications`, `view-notification-details` |

---

## Architecture Status: UNITS ONLY SYSTEM

**CRITICAL CHANGE FROM ORIGINAL ASSESSMENT:** ItemVariation model has been REMOVED.

### Database Schema
```
Product (id, name, category_id, stock, retail_price, wholesale_price)
  └── ProductUnit (id, product_id, name, conversion_factor, retail_price, wholesale_price)
  
Batch (id, product_id, outlet_id, batch_number, quantity, expiry_date)
  ├── LocationStock (product_id, outlet_id, quantity) [Redundant with Batch system]
  └── StockMovement (batch_id, movement_type, quantity, reference_id)

Sale (id, receipt_number, status, payment_status, total, payment_method)
  ├── SaleItem (sale_id, product_id, quantity, unit_id, price)
  └── KitchenOrderTicket (sale_id, table_id, status)
```

### What Changed
- **Before:** Product → ItemVariation → Batch (complex multi-level hierarchy)
- **After:** Product → Batch directly; ProductUnit for multi-unit pricing

### What's Working
✅ FEFO deduction logic with expired batch filtering
✅ Transaction-safe `deduct_stock()` using `select_for_update()`
✅ Immutable StockMovement audit trail with `reference_id`
✅ Per-outlet stock tracking via LocationStock
✅ Sales module correctly uses `stock_helpers` API

### What Needs Work
⚠️ Legacy `Product.stock` field still exists (created in migration, never cleared)
⚠️ No deprecation warning or migration path to batch-only system
⚠️ `LocationStock.quantity` may be redundant with batch calculations
⚠️ No comprehensive test suite for concurrent stock operations

---

## Critical Modals Inventory

### TIER 1: Business-Critical Transaction Modals (Highest Risk)

| Modal | Location | Purpose | Business Impact | Data Complexity |
|-------|----------|---------|-----------------|-----------------|
| `close-shift-modal.tsx` | Shifts UI | Cash reconciliation & shift closure | Prevents next shift opening | Complex: manual count entry, variance calculation |
| `quick-add-sale-modal.tsx` | POS | Direct transaction creation | Core revenue capture | High: payment method routing, inventory deduction |
| `payment-method-modal.tsx` | Sales flow | Payment type selection | Transaction completion | Medium: tender types, card processing integration |
| `refund-confirmation-modal.tsx` | Sales return | Process refunds atomically | Financial accuracy & audit trail | High: reverse stock, payment reversal, reason tracking |
| `receive-stock-modal.tsx` | Inventory | Add purchased stock as batches | Inventory accuracy | High: batch creation, expiry date, cost tracking |
| `kitchen-order-ticket-modal.tsx` | Restaurant | Send order to kitchen | Order fulfillment | Medium: KOT generation, priority flags, time tracking |

### TIER 2: Operational Modals (Medium Risk)

| Modal | Purpose | Risk | Notes |
|-------|---------|------|-------|
| `stock-adjustment-modal.tsx` | Manual stock corrections | Inventory integrity | Requires reason & approval |
| `transfer-stock-modal.tsx` | Move stock between outlets | Multi-location consistency | Bidirectional movement tracking |
| `low-stock-confirmation-modal.tsx` | Alert on low inventory | Risk mitigation | Prevents stockouts |
| `opening-cash-modal.tsx` | Register opening cash | Shift opening validation | Float tracking |
| `product-modal-tabs.tsx` | Product CRUD (4 tabs) | Product catalog accuracy | Basic/Units/Pricing/Stock tabs |
| `hold-recall-sale-modal.tsx` | Suspend/resume sales | Table management | For restaurant multi-item orders |
| `close-tab-modal.tsx` | Finalize customer tab | Tab settlement | Payment before closure |
| `expense-approval-modal.tsx` | Approve business expenses | Cost tracking | Workflow integration |

### TIER 3: Configuration Modals (Lower Risk)

| Modal | Purpose | Volume | Stability |
|-------|---------|--------|-----------|
| `add-edit-customer-modal.tsx` | Customer CRUD | Low | Stable |
| `add-edit-outlet-modal.tsx` | Outlet configuration | Low | Stable |
| `add-edit-staff-modal.tsx` | Staff management | Low | Stable |
| `create-business-modal.tsx` | Tenant onboarding | Very Low | Stable |
| `payment-method-modal.tsx` | Payment config | Low | Stable |
| `add-supplier-modal.tsx` | Supplier setup | Low | Partial implementation |

---

## Dependency Graph: Critical Modal Flows

### Sales Completion Flow
```
quick-add-sale-modal
  ↓ (Create Sale transaction)
  ├─→ inventory.deduct_stock() [CRITICAL]
  ├─→ shift.verify_open() [BLOCKING]
  └─→ payment-method-modal
        ↓ (Process Payment)
        └─→ Sale.payment_status = 'paid'
```

### Restaurant Order Flow
```
quick-add-sale-modal (with table_id)
  ↓
  ├─→ inventory.deduct_stock()
  └─→ kitchen-order-ticket-modal
        ↓ (Create KOT)
        └─→ KitchenOrderTicket.status = 'pending'
```

### Shift Closure Flow
```
close-shift-modal
  ↓ (Submit cash count)
  ├─→ Shift.verify_no_pending_sales() [BLOCKING]
  ├─→ Shift.calculate_variance() [variance = counted_cash - expected_cash]
  └─→ Shift.mark_closed()
```

### Stock Receive Flow
```
receive-stock-modal
  ↓ (Submit batch details)
  ├─→ Batch.create(product, quantity, expiry_date)
  ├─→ LocationStock.sync_quantity_from_batches()
  └─→ StockMovement.create(reference_id=PO_number)
```

---

## Risk Assessment: Why Sales is Now #1

**Changed from Original:** Inventory was #1; now Sales is #1 because:

1. **Higher transaction throughput**: Multiple concurrent transactions per shift
2. **More failure modes**: Payment integration, customer credit, discount logic, tax calculation
3. **Inventory is now stable**: Core FEFO + deduction logic tested and working
4. **Modal complexity**: 20+ transaction-initiating modals vs 12+ configuration modals
5. **State machine risk**: Sale status transitions (pending → completed → refunded) with no idempotency guarantees

### Specific Sales Risks
- ❌ No idempotency key on sale creation (retry = duplicate transaction)
- ❌ Race condition if two payments attempt same sale concurrently
- ❌ Payment reversal logic not fully tested with concurrent refunds
- ⚠️ Discount calculation not validated before stock deduction
- ⚠️ Customer credit system not transactionally protected with inventory

---

## Refactoring Sequence (Revised)

### Phase 1: Sales Stabilization (IMMEDIATE)
**Focus:** Atomic transactions, idempotency, concurrent payment safety

Tasks:
1. Add idempotency key to SaleViewSet.create() → prevents duplicate transactions on network retry
2. Add `select_for_update()` to Payment processing → prevents concurrent payment attempts
3. Validate all discounts BEFORE inventory deduction → prevents negative stock edge case
4. Add comprehensive sale status transition tests (pending → completed, pending → refunded)
5. Audit `quick-add-sale-modal.tsx` data validation before API call

**Why First:** Sales transactions are the core revenue flow; any data loss or duplication is catastrophic.

### Phase 2: Inventory Dual-State Resolution (PARALLEL)
**Focus:** Deprecate Product.stock; migrate to batch-only system

Tasks:
1. Mark `Product.stock` field as `deprecated=True` in model
2. Create data migration to backfill final `Product.stock` → Batch equivalents
3. Update `Product.get_total_stock()` to warn if direct field accessed
4. Remove all direct `Product.stock` mutations (all paths should use `stock_helpers`)
5. Evaluate `LocationStock.quantity` redundancy; consider making it a calculated property

**Why Parallel:** Can be done without blocking Sales phase; actually unblocks downstream modules.

### Phase 3: Shift & Cash Reconciliation (AFTER Phase 1)
**Focus:** Robust variance tracking, cash float management

Tasks:
1. Harden `close-shift-modal.tsx` cash count validation
2. Ensure variance calculation is immutable after shift closure
3. Add detailed cash movement audit trail
4. Test edge cases: multiple shifts, same-day re-open, negative variance

**Why After Phase 1:** Shift closure depends on Sales transaction completion; needs stable sales first.

### Phase 4: Modal Data Flow Audit (CONTINUOUS)
**Focus:** Ensure all modals validate data before API submission

Audit checklist:
- ✓ `ProductModalTabs.tsx` — 4-tab form validation complete before submit
- ✓ `ReceiveStockModal.tsx` — batch details (expiry date, quantity) validated
- ✓ `QuickAddSaleModal.tsx` — cart items, discounts, payment method before deduction
- ✓ `CloseShiftModal.tsx` — cash count parseable as number
- ✓ `RefundConfirmationModal.tsx` — refund reason required, reason code valid

---

## Success Criteria for Risk Reduction

### Sales (Phase 1)
- [ ] All transactions are idempotent (can be safely retried)
- [ ] Concurrent payment attempts blocked (no duplicate charges)
- [ ] Discount validation prevents negative stock edge case
- [ ] Sale status transitions are consistent (no orphaned statuses)
- [ ] Performance test: 50 concurrent sales/second with <500ms latency

### Inventory (Phase 2)
- [ ] All stock reads route through `stock_helpers` (no direct field access)
- [ ] Product.stock field is marked deprecated with migration path
- [ ] LocationStock quantity is either immutable or cached property
- [ ] Batch expiry filtering works correctly (no expired stock in available)
- [ ] FEFO deduction works with mixed expiry scenarios (some null, some past-date)

### Shifts (Phase 3)
- [ ] Cash variance calculation is immutable post-closure
- [ ] Variance audit trail tracks all adjustments
- [ ] Float management prevents negative cash states
- [ ] Concurrent shift operations don't conflict

### Modals (Phase 4)
- [ ] All transaction modals validate before submit
- [ ] 100% test coverage for validation logic
- [ ] Error messages are user-friendly and actionable
- [ ] Retry/cancel handling is safe (no partial updates)

---

## Critical Modal Details

### ProductModalTabs (4 Tabs, High Complexity)
**File:** `frontend/components/modals/product-modal-tabs.tsx` (834 lines)

**Tabs:**
1. **Basic** — Name, category, barcode
2. **Units** — ProductUnit CRUD with conversion factors
3. **Pricing** — Retail/wholesale price per unit
4. **Stock** — Initial stock, expiry date (batch info)

**Risk:** Multi-step form state; units can be added/edited/removed before final save
```tsx
const handleSubmit = async (e: React.FormEvent) => {
  // Validation: name required, retail_price > 0, units.length > 0
  // API: POST /api/v1/products with nested units array
  // Error handling: Toast on validation or API failure
}
```

**Data Flow:** Form state → Validation → API call → Clear state → Toast success

**Issues:**
- No debounce on field changes (could cause lag with large units list)
- Units are stored in client state; no real-time conflict detection

---

### CloseShiftModal (Cash Counting, Critical Path)
**File:** `frontend/components/modals/close-shift-modal.tsx` (268 lines)

**Workflow:**
```
User enters closing cash amount
  ↓ (Real-time formatting to currency)
  ↓ System calculates: variance = closing_cash - expected_cash
  ↓ (Display: expected vs actual with variance color-coded)
  ↓ User clicks Close
  ↓ API: PUT /shifts/{id}/close with { closing_cash, variance_reason? }
  ↓ Response: { status: 'closed' } or error
```

**Data Validation:**
- Closing cash must be numeric (regex: `/[^\d.]/g` replaced)
- Allows decimal values (e.g., 1250.50)
- Variance auto-calculated; optional reason for variances > $1

**Risk:** Cash counting is sensitive; typos cause variance disputes
- Suggestion: Add confirmation dialog if variance > $5
- Suggestion: Hide reason field unless variance is non-zero

---

### ReceiveStockModal (Batch Creation, Expiry Critical)
**File:** `frontend/components/modals/receive-stock-modal.tsx` (379 lines)

**Workflow:**
```
Select outlet → Select product → Enter quantity & cost
  ↓ Can add multiple products in one receipt
  ↓ Each line: product, quantity, cost, optional expiry_date
  ↓ Click receive → API: POST /inventory/batches (array)
  ↓ Backend creates Batch records with expiry tracking
```

**Data Model:**
```typescript
interface ReceiveItem {
  product_id: string
  quantity: string // Decimal input
  cost: string    // Unit cost
  // Optional: expiry_date, batch_number
}
```

**Critical Issue:** If expiry_date is missing, batch never expires (is_expired() returns False)
- **Risk:** Old stock could be sold indefinitely
- **Fix:** Make expiry_date mandatory or set default (e.g., 6 months out)

---

### QuickAddSaleModal (Core POS, Highest Volume)
**Referenced in:** `frontend/components/pos/restaurant-pos.tsx` (line ~650)

**Workflow:**
```
POS Interface (cart)
  ├─ Add items (product_id, quantity, unit_id)
  ├─ Apply discount (amount or percentage)
  ├─ Select payment method
  └─ Click Complete Sale
      ↓ Modal: Review subtotal, tax, discount, total
      ↓ Select: customer (optional), payment method, tender amount
      ↓ Click Submit
      ↓ API: POST /sales with atomic inventory deduction
      ↓ Response: { id, receipt_number, status } or error
      ↓ On success: Print receipt, clear cart, show confirmation
```

**Data Payload:**
```json
{
  "outlet_id": "uuid",
  "items": [
    { "product_id": "uuid", "quantity": 2, "unit_id": "uuid", "price": 150.00 }
  ],
  "subtotal": 300.00,
  "tax": 30.00,
  "discount": 0,
  "total": 330.00,
  "payment_method": "cash",
  "customer_id": "uuid or null",
  "status": "completed",
  "table_id": "uuid or null" // Restaurant only
}
```

**Risk Areas:**
- ❌ No check if stock is available BEFORE submitting (optimistic)
- ❌ Discount not validated before deduction (could cause negative stock)
- ❌ No idempotency key on create (network retry = duplicate sale)
- ⚠️ Concurrent cart updates from multiple tills not handled

---

## Key Contradictions Still Present

### 1. Dual Stock State (Inventory)
```python
# Both exist simultaneously:
product.stock = 100  # Legacy field from Product table
batch_total = Batch.objects.filter(product=product).aggregate(Sum('quantity'))['quantity__sum']  # = 100

# Issue: If someone updates product.stock directly, batches become inconsistent
# Solution: Make product.stock a calculated property, not stored field
```

### 2. ItemVariation References in Code (Sales)
Found 13 references to `variation` in sales module:
```python
sale_item.variation_name = ""  # Set to empty string (migration artifact)
sale_item.variation = None     # FK set to null

# Issue: Code still prepared for ItemVariation but model deleted
# Solution: Remove these fields entirely, update migration
```

### 3. LocationStock Redundancy (Inventory)
```python
# Two ways to get outlet stock for a product:
outlet_stock_1 = LocationStock.objects.get(product=p, outlet=o).quantity
outlet_stock_2 = Batch.objects.filter(product=p, outlet=o).aggregate(Sum('quantity'))['quantity__sum']

# They should be equal but if Batch changes, LocationStock doesn't auto-update
# Unless: sync_quantity_from_batches() is called (not guaranteed)
# Solution: Make LocationStock.quantity a calculated property or cached field
```

---

## Recommended Quick Wins (Next 2 Sprints)

1. **Add idempotency to Sales creation** ← Prevents duplicate transactions
2. **Fix ReceiveStockModal expiry_date default** ← Prevents eternal stock
3. **Mark Product.stock as deprecated** ← Signals intention to remove
4. **Add validation to ProductModalTabs** ← Prevents invalid units
5. **Add confirmation to CloseShiftModal** ← Prevents cash count typos
6. **Test QuickAddSaleModal with low stock** ← Verify edge case handling

---

## Deployment Checklist for Phase 1 (Sales)

- [ ] Idempotency key generation & validation tested
- [ ] Concurrent payment tests passing (50+ simultaneous)
- [ ] Discount validation edge cases covered
- [ ] Refund reversal tested with concurrent sales
- [ ] Sales transaction rollback on payment failure works
- [ ] Receipt generation async (doesn't block response)
- [ ] Performance test: 100 sales/min sustainable

---

## Appendix: Modal Dependency Tree

```
POS Layer
├─ quick-add-sale-modal
│  ├─→ payment-method-modal
│  ├─→ customer-select-modal
│  └─→ kitchen-order-ticket-modal (restaurant)
├─ hold-recall-sale-modal (restaurant)
└─ close-tab-modal (bar)

Inventory Layer
├─ receive-stock-modal
│  └─→ product-selection-modal
├─ stock-adjustment-modal
├─ transfer-stock-modal
└─ low-stock-confirmation-modal (auto-triggered)

Shift & Cash Layer
├─ opening-cash-modal
├─ close-shift-modal
├─ floating-cash-modal
└─ close-register-modal

Admin & Config Layer
├─ product-modal-tabs (4 tabs)
├─ add-edit-outlet-modal
├─ add-edit-customer-modal
├─ add-edit-staff-modal
└─ add-supplier-modal
```

---

## References

- **Batch Model:** `backend/apps/inventory/models.py` (Batch, LocationStock, StockMovement)
- **Stock Helpers:** `backend/apps/inventory/stock_helpers.py` (get_available_stock, deduct_stock, add_stock)
- **Sales Views:** `backend/apps/sales/views.py` (SaleViewSet.create with @transaction.atomic)
- **KOT System:** `backend/apps/restaurant/models.py` (KitchenOrderTicket)
- **Modal Components:** `frontend/components/modals/` (80+ modal files)
- **POS Logic:** `frontend/components/pos/restaurant-pos.tsx` (650+ lines)

**Last Reviewed:** February 2026
