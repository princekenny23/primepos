# PrimePOS Critical Modals Deep Dive

**Purpose:** Detailed inventory and risk analysis of 80+ modal components managing business-critical workflows.

**Scope:** Focus on transaction-initiating modals that impact revenue, inventory, and compliance.

---

## Critical Modals Summary

### TIER 1: Revenue & Compliance Critical (6 Modals)

#### 1. QuickAddSaleModal / POS Sale Creation
**Location:** `frontend/components/pos/restaurant-pos.tsx` (embedded)  
**Complexity:** Very High  
**Volume:** 100-500 transactions/day per outlet  
**Data Criticality:** CATASTROPHIC

**Responsibilities:**
- Accept cart items with product_id, quantity, unit_id, price
- Apply discount (amount or percentage)
- Calculate subtotal, tax, total
- Select payment method
- Bind to active shift
- Trigger atomic inventory deduction

**Current Implementation:**
```javascript
const sale = await saleService.create(salePayload)
// Backend: @transaction.atomic deduction with select_for_update()
// Inventory: Uses stock_helpers.deduct_stock() for FEFO
```

**Identified Risks:**
- ❌ **No Pre-check:** Doesn't verify stock available before submit
  - User adds 10x items, submits, gets "insufficient stock" error mid-transaction
  - **Fix:** Add real-time stock check on item add
  
- ❌ **No Idempotency:** Network retry = duplicate sale
  - Customer charged twice if network drops during submit
  - **Fix:** Add idempotency_key to sale creation request
  
- ⚠️ **Race Condition:** Multiple concurrent tills at same outlet
  - Till A & B both sell last item from same batch
  - Only 1 succeeds, other fails with no graceful recovery
  - **Fix:** Return available quantity on deduction failure
  
- ⚠️ **Discount Before Validation:** Discount applied before stock check
  - User gets discount on sale that fails due to low stock
  - **Mitigation:** Validate all before ANY changes

**Testing Gaps:**
- [ ] Concurrent sale creation from same till (>1 request in flight)
- [ ] Sale with mixed expired/non-expired batches (FEFO test)
- [ ] Discount edge case: 100% discount on high-value item
- [ ] Payment method NOT in configured methods (validation missing?)
- [ ] Table_id not bound to outlet (restaurant only)

---

#### 2. CloseShiftModal
**Location:** `frontend/components/modals/close-shift-modal.tsx` (268 lines)  
**Complexity:** Medium-High  
**Volume:** 1-10 per outlet per day  
**Data Criticality:** HIGH (Financial reconciliation)

**Responsibilities:**
- Accept closing cash count (manual entry, currency parsing)
- Calculate variance: counted_cash - expected_cash
- Submit with optional variance reason
- Block if pending/unpaid sales exist
- Mark shift as closed → enable next shift

**Current Implementation:**
```tsx
const formatCurrency = (value: string) => value.replace(/[^\d.]/g, "")
// Allows: "1,250.50" → 1250.50
const variance = parseFloat(closingCash) - shift.expected_cash
await shiftService.closeShift({ closing_cash, variance_reason })
```

**Identified Risks:**
- ⚠️ **Typo-Prone:** No confirmation if variance > threshold
  - User enters 250.50 instead of 1250.50 → $1000 variance
  - **Fix:** Add confirmation: "Variance is -$990. Confirm closure?"
  
- ⚠️ **Currency Parsing Fragile:** Regex allows "12..50" → "1250"
  - **Fix:** Use proper currency input component with locale awareness
  
- ❌ **Expected Cash Calculation:** What if sale added AFTER shift started?
  - Expected_cash = shift.sales_sum (at open time)
  - New sale created after shift.opened_at but before shift.closed_at
  - Variance becomes invalid
  - **Fix:** Recalculate expected as sum of sales WHERE created_at within shift time window
  
- ⚠️ **Race Condition:** User submits while payment is processing
  - Shift closure says $500, but $50 payment completes after closure
  - **Fix:** Add 30-second hold after closing (collect any pending payments)

**Testing Gaps:**
- [ ] Variance = 0 (expected vs counted match)
- [ ] Variance = -50 (user under-counted)
- [ ] Variance = +100 (user over-counted or added cash)
- [ ] Concurrent shift closure (multi-till scenario)
- [ ] Sale created during close process (race condition)
- [ ] Negative cash scenario (till goes red)

---

#### 3. ReceiveStockModal
**Location:** `frontend/components/modals/receive-stock-modal.tsx` (379 lines)  
**Complexity:** High  
**Volume:** 1-20 per outlet per day  
**Data Criticality:** HIGH (Inventory accuracy)

**Responsibilities:**
- Select outlet (which location to receive stock at)
- Add 1..N line items (product_id, quantity, cost)
- Optionally set expiry_date per item
- Create Batch records with stock movement audit trail
- Update LocationStock summary

**Current Implementation:**
```tsx
interface ReceiveItem {
  product_id: string
  quantity: string    // Decimal
  cost: string       // Unit cost
  // MISSING: expiry_date is NOT required
}

await inventoryService.create({ outlet_id, items: receiveItems })
// Backend creates: Batch(product, outlet, quantity, expiry_date=None)
//                  StockMovement(batch, reference_id=receipt_number)
```

**Identified Risks:**
- 🔴 **CRITICAL: Expiry Date Missing Handling**
  - expiry_date=None → is_expired() always returns False
  - Stock with no expiry can be held indefinitely
  - Violates FEFO assumption (expired batches are skipped)
  - **Fix:** Make expiry_date MANDATORY or auto-set (e.g., +180 days)
  
- ⚠️ **Cost Field Not Validated:** Could be 0, negative, or non-numeric
  - Affects profit margin calculations in reports
  - **Fix:** Validate cost > 0 before submit
  
- ⚠️ **No PO/Receipt Number Binding:** reference_id is auto-generated
  - Hard to trace stock back to original purchase order
  - **Fix:** Add optional PO_number field; use as reference_id
  
- ⚠️ **Bulk Add Without Conflict Check:** 2 users receive same PO simultaneously
  - Both create Batch records for same product
  - LocationStock.sync_quantity_from_batches() may over-count
  - **Fix:** Add unique constraint on (outlet, product, batch_number, date)

**Testing Gaps:**
- [ ] Batch with expiry_date = today (edge case for FEFO)
- [ ] Batch with expiry_date = None (should reject or set default)
- [ ] Concurrent receipts for same product (uniqueness check)
- [ ] Cost field: 0, negative, very large (>$10,000)
- [ ] Outlet not in user's assigned outlets (authorization)
- [ ] Product not active/available for receipt

---

#### 4. RefundConfirmationModal
**Location:** `frontend/components/modals/refund-confirmation-modal.tsx`  
**Complexity:** High  
**Volume:** 5-50 per outlet per day (10% of sales)  
**Data Criticality:** CATASTROPHIC (Financial & inventory reversal)

**Responsibilities:**
- Accept sale_id to refund
- Verify sale is eligible (not already refunded, not expired)
- Select refund reason (required)
- Calculate refund amount (full or partial)
- Trigger atomic reversal: deduct stock → reverse payment → record movement
- Audit trail for compliance

**Current Implementation:**
```tsx
const handleRefund = async (saleId, reason, amount) => {
  const response = await saleService.refund({
    sale_id: saleId,
    amount: amount,
    reason: reason
  })
  // Backend: @transaction.atomic
  //   1. Verify sale exists and is refundable
  //   2. Reverse StockMovement (add_stock)
  //   3. Reverse Payment
  //   4. Update Sale.status = 'refunded'
}
```

**Identified Risks:**
- 🔴 **Stock Reversal Without Batch Match:** Refund adds stock but doesn't match original batches
  - Example: Refund item that was from expired batch
  - Stock re-added to new batch (FIFO instead of original LIFO)
  - Creates inconsistent cost-of-goods accounting
  - **Fix:** Store batch_id on SaleItem; reverse to exact batch
  
- ⚠️ **Partial Refund Ambiguity:** If sale has 2x same item, refund 1 — which one?
  - **Fix:** Track unit-level refunds; deduct from specific unit in batch
  
- ⚠️ **Reason Required But Not Validated:** Reason can be "test" or "xyz"
  - Compliance/audit trail is compromised
  - **Fix:** Enum: CUSTOMER_REQUEST, DAMAGE, WRONG_ITEM, EXPIRED, etc.
  
- ❌ **No Race Condition Protection:** 2 refund attempts on same sale
  - Both see sale.status='completed' → both process refund
  - Stock gets added twice
  - Customer payment reversed twice
  - **Fix:** Use select_for_update on Sale; check refund_status before processing

**Testing Gaps:**
- [ ] Refund with partial amount vs full refund
- [ ] Refund on expired batch (should still reverse)
- [ ] Concurrent refund attempts on same sale (race condition)
- [ ] Refund after shift closure (should still work for audit)
- [ ] Refund > original sale amount (validation)
- [ ] Refund with customer credit vs payment reversal

---

#### 5. PaymentMethodModal / Payment Processing
**Location:** `frontend/components/modals/payment-method-modal.tsx`  
**Complexity:** High  
**Volume:** 100-500 per day (every sale)  
**Data Criticality:** CATASTROPHIC

**Responsibilities:**
- Select payment method (cash, card, credit, cheque, mobile)
- Enter tender amount (for cash)
- Route to payment gateway if card/mobile
- Verify total ≤ sale amount (no overpayment unless change)
- Atomic payment recording with idempotency

**Current Implementation:**
```tsx
const handlePayment = async (method, amount, cardDetails?) => {
  if (method === 'card') {
    const response = await paymentGateway.charge({
      amount: sale.total,
      token: cardDetails.token
    })
    // Risk: If charge succeeds but DB update fails → ghost charge
  }
  
  await saleService.updatePayment({
    sale_id: sale.id,
    payment_method: method,
    amount: amount,
    status: 'paid'
  })
}
```

**Identified Risks:**
- 🔴 **Payment Gateway Race Condition:** Card charged; DB update fails; no payment record
  - Customer charged but sale shows unpaid
  - Money lost, customer unhappy
  - **Fix:** Store transaction ID from gateway FIRST before updating sale
  
- ⚠️ **No Idempotency for Card Payments:** Network retry = 2 charges
  - **Fix:** Send idempotency_key to payment gateway + store token
  
- ⚠️ **Tender Amount Validation:** Allows tender < total (require change entry)
  - User enters 100 for 150 total → system accepts
  - **Fix:** Validate tender ≥ total; calculate change; record change given
  
- ⚠️ **Card Details in Frontend:** PCI compliance risk
  - Stripe tokenization should be server-side
  - **Fix:** Use Stripe Elements (client-side token generation) only

**Testing Gaps:**
- [ ] Card declined (3D Secure, insufficient funds)
- [ ] Payment timeout (network drops mid-transaction)
- [ ] Multi-payment (e.g., $50 cash + $50 card for $100 sale)
- [ ] Change calculation accuracy
- [ ] Refund to original payment method (for card refunds)

---

#### 6. KitchenOrderTicketModal
**Location:** `frontend/components/modals/kitchen-order-ticket-modal.tsx`  
**Complexity:** Medium  
**Volume:** 50-200 per day (restaurant only)  
**Data Criticality:** HIGH (Order fulfillment)

**Responsibilities:**
- Create KitchenOrderTicket after table sale
- Assign priority (normal, high, urgent)
- Track KOT status: pending → preparing → ready → served
- Print ticket for kitchen
- Link to Sale for order correlation

**Current Implementation:**
```tsx
const sale = await saleService.create(salePayload)
const kot = await kitchenService.create({
  sale_id: sale.id,
  table_id: table.id,
  priority: priority,
  items: sale.items
})
```

**Identified Risks:**
- ⚠️ **KOT Creation Decoupled from Sale:** If KOT fails, sale exists but no kitchen visibility
  - Food not prepared; customer has no food; revenue but no delivery
  - **Fix:** Make KOT creation atomic with sale creation
  
- ⚠️ **Status Stuck in "Pending":** No timeout if KOT never transitions
  - Kitchen closes; pending orders never marked served
  - Affects closing shift reconciliation
  - **Fix:** Add auto-status transition on shift close
  
- ⚠️ **No Notification to Kitchen:** KOT created but kitchen doesn't see it (WebSocket removed)
  - Polling-based notifications every 30 seconds (stale)
  - **Mitigation:** Desktop notification or audible alert at terminal
  
- ⚠️ **Items Modification After KOT:** Sale items can be modified post-KOT
  - Kitchen preparing 2 items; POS adds 3rd item to sale
  - Kitchen doesn't know about new item
  - **Fix:** Make sale items immutable after KOT creation

**Testing Gaps:**
- [ ] KOT creation with multi-item order
- [ ] KOT with split items (multiple orders)
- [ ] Priority change during preparation (unlikely but possible)
- [ ] KOT cancellation (customer cancels before service)
- [ ] Print test: KOT ticket format and printer integration

---

### TIER 2: Operational Modals (8 Modals)

#### StockAdjustmentModal
**Purpose:** Manual stock corrections (inventory discrepancies)  
**Risk Level:** MEDIUM  
**Audit Trail:** REQUIRED (reason + approver)

**Identified Risks:**
- ⚠️ Adjustments don't create StockMovement (audit trail missing)
- ⚠️ Can adjust stock to negative (should prevent)
- ⚠️ No approval workflow (anyone can adjust)

**Recommendations:**
- Require reason enum: STOCK_TAKE, DAMAGE, THEFT, MISCOUNTING, etc.
- Require manager approval for adjustments > $100 value
- Always create StockMovement with movement_type='adjustment'

---

#### TransferStockModal
**Purpose:** Move stock between outlets  
**Risk Level:** MEDIUM  
**Audit Trail:** Required

**Identified Risks:**
- ⚠️ Bidirectional transfer: source_outlet, dest_outlet
- ⚠️ Race condition: stock transferred from outlet A while stock is being deducted
- ⚠️ No transit tracking (stock in limbo)

**Recommendations:**
- Create interim "in_transit" status
- Require 2-step: source sends, destination receives
- Add transfer deadline (auto-revert if not received in 24hrs)

---

#### OpeningCashModal
**Purpose:** Register opening float / opening cash entry  
**Risk Level:** MEDIUM  
**Audit Trail:** Required

**Identified Risks:**
- ⚠️ Amount not validated (can be 0, very large, negative)
- ⚠️ No denominations entry (single amount only)
- ⚠️ Opening cash never matches closing cash (drift not tracked)

---

#### ProductModalTabs
**Purpose:** Product CRUD with 4-tab interface  
**Risk Level:** MEDIUM  
**Complexity:** Very High (834 lines)

**Tab Structure:**
1. **Basic** (product name, category, barcode, description)
2. **Units** (ProductUnit management with conversion factors)
3. **Pricing** (retail_price, wholesale_price per unit)
4. **Stock** (initial stock, batch details)

**Identified Risks:**
- ⚠️ Units can be added/removed/edited with no validation
- ⚠️ No check: conversion_factor > 0 (could be 0, negative, or decimal)
- ⚠️ No check: prices > 0 (could be 0 or negative)
- ⚠️ Form state is complex (useCallback, useEffect, multiple useState)
- ⚠️ Barcode not validated for uniqueness (could have duplicates)
- ⚠️ Stock initial value not tied to batch creation (loose coupling)

**Data Flow Issues:**
```tsx
// handleSubmit validation
if (!basicForm.name.trim()) throw "Product name required"
if (parseFloat(pricingForm.retail_price) <= 0) throw "Retail price > 0"

// But units validation is missing:
units.forEach(unit => {
  // No check: unit.conversion_factor > 0
  // No check: unit.retail_price > 0
  // No check: unit.name.trim() required
})
```

---

#### HoldRecallSaleModal (Restaurant)
**Purpose:** Suspend/resume restaurant orders (hold table, recall order)  
**Risk Level:** MEDIUM  
**Audit Trail:** Required

**Identified Risks:**
- ⚠️ Hold state not tracked (no timestamp)
- ⚠️ Unlimited hold duration (table stuck in limbo)
- ⚠️ Auto-recall on shift close (orders lost if shift closes mid-hold)

---

#### CloseTabModal (Bar)
**Purpose:** Finalize customer tab (payment settlement)  
**Risk Level:** MEDIUM

**Identified Risks:**
- ⚠️ Tab items can be disputed (customer says didn't order)
- ⚠️ Tab total calculation: what if customer ordered during hold?
- ⚠️ Split payment among customers not supported

---

#### ExpenseApprovalModal
**Purpose:** Approve business expenses (e.g., supplies, repairs)  
**Risk Level:** LOW  
**Audit Trail:** Required

---

### TIER 3: Configuration Modals (30+ Modals)

These are lower-risk CRUD interfaces for:
- Customer management
- Staff/User management
- Outlet configuration
- Supplier setup
- Payment method setup
- Discount setup
- etc.

**Common Patterns:**
- Input validation (email, phone, numeric)
- Dropdown selection (categories, outlets)
- Toggle/checkbox for status
- Success/error toast feedback

**Lower Risk Because:**
- No transactional money involved
- No inventory impact
- Auditable via standard CRUD endpoints
- User-initiated (no auto-triggers)

---

## Modal Testing Matrix

| Modal | Unit Tests | Integration Tests | Concurrency Tests | Production Validation |
|-------|------------|-------------------|-------------------|----------------------|
| QuickAddSale | ✓ | ✓ | ❌ (MISSING) | ❌ (MISSING) |
| CloseShift | ✓ | ✓ | ✓ (Partial) | ⚠️ (Typo test) |
| ReceiveStock | ⚠️ (Partial) | ⚠️ (Partial) | ❌ (MISSING) | ❌ (Expiry test) |
| RefundConfirmation | ✓ | ⚠️ (Partial) | ❌ (MISSING) | ❌ (MISSING) |
| PaymentMethod | ✓ | ⚠️ (Partial) | ❌ (MISSING) | ❌ (Gateway test) |
| KitchenOrderTicket | ⚠️ (Partial) | ⚠️ (Partial) | N/A | ✓ |
| ProductModalTabs | ⚠️ (Partial) | ✓ | N/A | ⚠️ (Barcode dup) |
| StockAdjustment | ❌ (MISSING) | ❌ (MISSING) | N/A | ❌ (MISSING) |
| TransferStock | ❌ (MISSING) | ❌ (MISSING) | ❌ (MISSING) | ❌ (MISSING) |

---

## Recommended Modal Fixes (Priority Order)

### CRITICAL (Implement in Next 2 Sprints)

1. **QuickAddSaleModal: Add Pre-stock Check**
   - On item add, check `stock_helpers.get_available_stock()`
   - Show warning if insufficient stock
   - Block submit if any item is out-of-stock

2. **ReceiveStockModal: Mandate Expiry Date**
   - Make expiry_date required
   - Default to +180 days if not entered
   - Validate expiry_date > today

3. **RefundConfirmationModal: Add Race Condition Protection**
   - Lock sale record during refund
   - Prevent concurrent refund attempts
   - Verify refund_status before processing

4. **PaymentMethodModal: Add Idempotency**
   - Generate idempotency_key client-side
   - Send to payment gateway + backend
   - Store transaction ID before updating sale

---

### HIGH (Next 4 Sprints)

5. **CloseShiftModal: Add Confirmation Dialog**
   - If variance > $5, require confirmation
   - Show: "Variance: -$XX.XX. Proceed?"

6. **ProductModalTabs: Add Unit Validation**
   - conversion_factor > 0
   - retail_price > 0
   - wholesale_price > 0
   - name required

7. **StockAdjustmentModal: Add Reason Enum**
   - Require reason selection
   - Enum: STOCK_TAKE, DAMAGE, THEFT, etc.

8. **KitchenOrderTicketModal: Make Atomic**
   - KOT creation part of sale @transaction.atomic
   - If KOT fails, entire sale rollback

---

### MEDIUM (Next 6-8 Sprints)

9. **TransferStockModal: Add 2-Step Workflow**
   - Source: send approval
   - Destination: receive confirmation
   - Track in-transit status

10. **All Modals: Add Comprehensive Unit Tests**
    - 100% test coverage for validation logic
    - Edge cases (zero, negative, very large values)
    - Error scenarios (network, validation, authorization)

---

## Success Criteria for Modal Stability

- [ ] All transaction modals validate data BEFORE submit
- [ ] All modals with concurrent usage have race-condition protection
- [ ] All modals with financial impact have idempotency keys
- [ ] All modals with audit requirements record StockMovement / ActivityLog
- [ ] Error handling: Show actionable user messages (not stack traces)
- [ ] Performance: Modal open/submit < 500ms
- [ ] 100% test coverage for validation logic
- [ ] All edge cases (zero, negative, null, very large) tested

---

## Performance Baseline

**Acceptable Latencies:**
- Modal open: < 200ms (load product list, etc.)
- Form submit: < 500ms (API call + validation)
- Success response: < 100ms (toast, navigate)

**Load Test Targets:**
- 50 concurrent QuickAddSale modals (different tills)
- 10 concurrent ReceiveStock modals (different outlets)
- 100 concurrent CloseShift modals (all outlets)

---

**Last Updated:** February 2026  
**Next Review:** April 2026 (post-Phase 1)
