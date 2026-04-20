# IMPLEMENTATION GUIDE - MVP LAUNCH BLOCKING TASKS

**Priority Order**: 1 → 7 (highest impact first)  
**Estimated Total Time**: 13 hours (1-2 days with parallelization)  
**Owner**: Frontend & Backend team  

---

## TASK 1: HIDE CARD PAYMENT (Priority: 🔴 P0 | ~2 hrs)

**Files to Update**:
- `frontend/components/modals/payment-modal.tsx` (show/hide payment method buttons)
- `frontend/components/pos/retail-pos.tsx` (disable card payment flow)

**What to Do**:
1. In payment modal, find button for "Card"
2. Replace with disabled button or hide completely
3. Show tooltip: "Card payments available in Q2 2026"
4. Test: payment modal shows cash only

**Implementation Steps**:
```typescript
// In payment-modal.tsx or similar:
// BEFORE:
<button onClick={() => handlePaymentMethod('card')}>Card Payment</button>

// AFTER:
<button disabled title="Card payments coming in next update">Card Payment</button>
// OR
{/* Card payment hidden for MVP */}
```

**Verification**:
- [ ] Payment modal shows only Cash option
- [ ] Card button is disabled or hidden
- [ ] Tooltip appears on hover (if disabled)

---

## TASK 2: HIDE MOBILE MONEY PAYMENT (Priority: 🔴 P0 | ~2 hrs)

**Files to Update**:
- `frontend/components/modals/payment-modal.tsx`
- `frontend/components/pos/retail-pos.tsx`

**What to Do**:
1. Find "Mobile Money" / "M-Pesa" button
2. Hide or disable similar to Task 1
3. Tooltip: "Mobile money payments available in Q2 2026"

**Verification**:
- [ ] Mobile Money button hidden or disabled
- [ ] Cash is the only visible payment option

---

## TASK 3: REMOVE TAX UI FROM CHECKOUT (Priority: 🔴 P0 | ~3 hrs)

**Files to Update**:
- `frontend/lib/hooks/usePosCart.ts` (line 33)
- `frontend/lib/utils/salePayloadBuilder.ts` (line 66)
- `frontend/components/pos/retail-pos.tsx` (line 767)
- `frontend/components/pos/restaurant-pos.tsx` (verify tax handling)
- `frontend/components/pos/bar-pos.tsx` (verify tax handling)
- `frontend/app/dashboard/office/quotations/new/page.tsx` (line 62)

**What to Do**:
1. In each POS screen, remove tax calculation display
2. Keep `tax: 0` hardcoded (no UI for it)
3. Remove tax line from receipt display
4. Verify all sales save with `tax: 0`

**Current Code to Clean Up**:
```typescript
// REMOVE THESE LINES:
const tax = 0 // TODO: implement tax logic
const paymentTax = 0 // TODO: Calculate tax if needed

// VERIFY THIS (should stay as 0):
const total = subtotal - discount + 0  // 0 = tax
```

**Verification**:
- [ ] Tax input field removed from all POS screens
- [ ] Receipt shows: Subtotal - Discount = Total (no tax line)
- [ ] All sales saved with tax=0
- [ ] Backend rejects non-zero tax in requests (validation added)

---

## TASK 4: REMOVE "COMING SOON" ACTIONS FROM POS (Priority: 🔴 P0 | ~2 hrs)

**Files to Update**:
- `frontend/components/pos/retail-pos.tsx` (lines 938, 946)
- `frontend/components/pos/restaurant-pos.tsx`
- `frontend/components/pos/bar-pos.tsx`

**Current Code**:
```typescript
// Line 938-950 in retail-pos.tsx:
const handleReturn = () => {
  // TODO: Implement return functionality
  toast({ title: "Return", description: "Return functionality coming soon." })
}

const handleRefund = () => {
  // TODO: Implement refund functionality
  toast({ title: "Refund", description: "Refund functionality coming soon." })
}

const handleOpenDrawer = () => {
  toast({ title: "Drawer", description: "Cash drawer functionality coming soon." })
}
```

**Decision**: 
- **Return/Refund**: KEEP these (already implemented, just verify they work)
- **Cash Drawer**: REMOVE or DISABLE (not in MVP scope)

**What to Do**:
1. Verify return/refund buttons actually call the backend APIs (not just show toast)
2. Remove "coming soon" toast messages
3. Disable/hide "Cash Drawer" button entirely

**Verification**:
- [ ] Return button works (test: process sale → click Return → gets refunded)
- [ ] Refund button works (test: apply partial refund)
- [ ] Cash Drawer button hidden or disabled
- [ ] No "coming soon" messages appear

---

## TASK 5: FIX KPI DASHBOARD "EMPLOYEES" LABEL (Priority: 🟠 P1 | ~2 hrs)

**Files to Update**:
- `frontend/lib/utils/dashboard-stats.ts` (lines 150-220)
- `frontend/components/dashboard/kpi-cards.tsx` (line ~130)

**Current Issue**:
```typescript
// dashboard-stats.ts:
const employeesCount = filteredStaff.length  // GOOD - uses staff count
// BUT in kpi-cards.tsx:
value={data.products.value}  // BAD - shows product count as employees!
```

**What to Do**:
1. In `dashboard-stats.ts`, verify `products` field now contains `employeesCount`
2. In `kpi-cards.tsx`, verify it displays `data.products.value` as "Employees"
3. Update variable naming if needed for clarity

**Current Code** (kpi-cards.tsx line ~130):
```typescript
<KPICard
  title="Employees"
  value={data.products.value.toLocaleString('en-US')}  // ← Should be staff count
  change={data.products.change}
  // ...
/>
```

**Fix**:
```typescript
// Option 1: Rename in response object
// dashboard-stats.ts returns:
return {
  sales: { value: currentRevenue, change: salesChange },
  employees: { value: employeesCount, change: employeesChange },  // Renamed from 'products'
  // ...
}

// Option 2: Keep 'products' but fix data source (simpler)
// Verify dashboard-stats.ts line ~200 uses filteredStaff, not products
```

**Verification**:
- [ ] KPI "Employees" card shows actual staff count (not product count)
- [ ] Employee change % calculated correctly
- [ ] Dashboard loads without errors

---

## TASK 6: HIDE NON-MVP MENUS (Priority: 🟠 P1 | ~1 hr)

**Files to Update**:
- `frontend/components/layouts/dashboard-layout.tsx`
- `frontend/app/layout.tsx` or main nav component

**Menus to Hide**:
- Distribution
- Storefront
- Loyalty
- Accounting
- Supplier Management
- Purchase Orders

**Implementation**:
```typescript
// Find menu array, add condition:
const menuItems = [
  { label: "Dashboard", href: "/dashboard", show: true },
  { label: "POS", href: "/dashboard/pos", show: true },
  { label: "Inventory", href: "/dashboard/inventory", show: true },
  { label: "Reports", href: "/dashboard/reports", show: true },
  { label: "Staff", href: "/dashboard/staff", show: true },
  { label: "Customers", href: "/dashboard/customers", show: true },
  
  // MVP Phase - HIDE THESE:
  { label: "Distribution", href: "/dashboard/distribution", show: false },
  { label: "Storefront", href: "/dashboard/storefront", show: false },
  { label: "Loyalty", href: "/dashboard/loyalty", show: false },
  { label: "Accounting", href: "/dashboard/accounting", show: false },
]

// Render:
{menuItems.filter(m => m.show).map(item => (...))}
```

**Verification**:
- [ ] Dashboard sidebar shows only: Dashboard, POS, Inventory, Reports, Staff, Customers, Settings
- [ ] Distribution/Storefront/Loyalty/Accounting menus NOT visible
- [ ] Direct URL access to `/dashboard/distribution` returns 404 or redirect

---

## TASK 7: VERIFY DASHBOARD DATE RANGE (Priority: 🟡 P2 | ~1 hr)

**Files to Check**:
- `frontend/lib/utils/dashboard-stats.ts` (line ~1-50)
- `frontend/app/dashboard/page.tsx` (date range picker)

**What to Verify**:
```typescript
// dashboard-stats.ts:
export function buildRange(range?: DashboardDateRange) {
  const end = new Date()
  const start = new Date()
  
  switch (range?.type) {
    case 'this_week':
      // Should default to LAST 7 DAYS, not today only
      start.setDate(end.getDate() - 7)
      break
    // ...
  }
}

// DEFAULT should be:
const defaultRange = { type: 'this_week', days: 7 }
// NOT: { type: 'today' }
```

**Verification Checklist**:
- [ ] Dashboard loads with 7-day range selected by default (not "Today")
- [ ] Date picker shows "Last 7 Days" as default
- [ ] KPI cards show data for full 7 days (not just today)
- [ ] Sales chart shows 7 days of data
- [ ] "Change %" compares last 7 days to previous 7 days

**Testing**:
1. Navigate to dashboard
2. Check date range picker (should show "Last 7 Days")
3. Verify KPI card "Change %" is non-zero (showing week-over-week trend)
4. If it shows "Today" instead, change default to `{ type: 'this_week' }`

---

## BACKEND TASKS (BLOCKING)

### TASK 8: REJECT CARD PAYMENTS (Priority: 🔴 P0 | ~2 hrs)

**File**: `backend/apps/payments/views.py`

**What to Do**:
Add validation in payment processing to reject card requests:

```python
# In payment finalization view:
def finalize_payment(request):
    payment_method = request.data.get('payment_method')
    
    if payment_method == 'card':
        return Response(
            {'error': 'Card payments are not available in this version. '
                      'Cash payments only for MVP. Card payments coming in Q2 2026.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if payment_method == 'mobile_money':
        return Response(
            {'error': 'Mobile money payments are not available in this version. '
                      'Cash payments only for MVP. Mobile money coming in Q2 2026.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Continue with cash payment...
```

**Verification**:
- [ ] POST /api/v1/sales/finalize_payment with `payment_method: 'card'` → 400 error
- [ ] POST /api/v1/sales/finalize_payment with `payment_method: 'cash'` → 200 success

---

### TASK 9: VERIFY RETURN/REFUND IMPLEMENTATION (Priority: 🔴 P0 | ~2 hrs)

**Files to Test**:
- `backend/apps/sales/views.py` (sales return endpoints)
- `frontend/components/pos/retail-pos.tsx` (return button flow)

**What to Verify**:
1. **Test Return Flow**:
   - Create a sale with 3 items (product A, B, C)
   - Click "Return" on that sale
   - System should allow selecting which items to return
   - Refund should be issued for selected items
   - Receipt shows negative amount (refund)

2. **Test Refund Flow**:
   - Create a sale for $100
   - Click "Refund"
   - Option to refund full ($100) or partial ($50)
   - Verify refund recorded in system

3. **Test Edge Cases**:
   - Return same item twice → should fail
   - Return more than purchased → should fail
   - Return with offline mode → should queue for sync

**Verification Checklist**:
- [ ] Full return works (process sale, return all items, get full refund)
- [ ] Partial return works (process sale, return 1 of 3 items)
- [ ] Partial refund works (process sale, refund 50% of total)
- [ ] Receipt shows refund reason
- [ ] Database records return transactions separately
- [ ] Customer credit updated if applicable

---

## PRIORITY EXECUTION PLAN

**Day 1 (4 hrs)**:
- Task 1: Hide Card Payment ✓
- Task 2: Hide Mobile Money ✓

**Day 1 Afternoon (4 hrs)**:
- Task 4: Verify Return/Refund + remove "coming soon" ✓
- Task 6: Hide non-MVP menus ✓

**Day 2 Morning (3 hrs)**:
- Task 3: Remove Tax UI ✓
- Task 5: Fix Employee KPI ✓

**Day 2 Afternoon (2 hrs)**:
- Task 7: Verify Dashboard 7-day range ✓
- Task 8: Backend payment validation ✓
- Task 9: Verify Return/Refund ✓

**Total**: ~13 hours → 1.5-2 days (parallel = 1 day)

---

## SIGN-OFF AFTER COMPLETION

Once all tasks complete:
- [ ] All blocking tasks implemented
- [ ] Frontend `tsc --noEmit` passes with no errors
- [ ] Manual testing of all POS flows completed
- [ ] Client documentation updated with known limitations
- [ ] Ready for launch ✅
