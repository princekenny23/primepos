# KPI CARDS - FIXES APPLIED & REMAINING WORK

## ✅ FIXES APPLIED

### 1. ✅ **PURCHASES CARD - CURRENCY FORMATTING FIXED**
**Status**: FIXED  
**File**: [kpi-cards.tsx](frontend/components/dashboard/kpi-cards.tsx#L129)  
**Change**: 
```tsx
// ❌ BEFORE
value={data.avgOrderValue.value.toLocaleString('en-US')}

// ✅ AFTER  
value={formatCurrency(data.avgOrderValue.value, business)}
```
**Impact**: Now correctly displays average order value as currency (e.g., "$45.50" instead of "45.5")

---

### 2. ✅ **PROFIT CALCULATION - EXPENSE INCONSISTENCY FIXED**
**Status**: FIXED  
**File**: [dashboard-stats.ts](frontend/lib/utils/dashboard-stats.ts#L176)  
**Change**:
```typescript
// ❌ BEFORE - Comparing different metrics
const yesterdayExpenses = yesterdayExpenseStats.total_expenses || 0

// ✅ AFTER - Comparing same metric  
const yesterdayExpenses = yesterdayExpenseStats.today_expenses || 0
```
**Impact**: Profit change calculation now compares TODAY's profit vs YESTERDAY's profit consistently

---

### 3. ✅ **STAFF CARD - MISMATCHED DATA FIXED**
**Status**: FIXED (Renamed Card)  
**File**: [kpi-cards.tsx](frontend/components/dashboard/kpi-cards.tsx#L119)  
**Change**:
```tsx
// ❌ BEFORE - Wrong naming (showed products as staff)
title="Staff"
icon={<Users className="h-6 w-6" />}

// ✅ AFTER - Correct naming matches data source
title="Products"
icon={<ShoppingCart className="h-6 w-6" />}
```
**Impact**: Card now correctly identifies what it displays (product count, not staff count)

---

## ⚠️ REMAINING ISSUES (Need Backend Work)

### 1. 🟠 **CUSTOMERS CHANGE - NOT TRACKED**
**Status**: ⏳ PENDING  
**Current**: Hardcoded to `change: 0`  
**Needed**: Track new customers per month/period  
**File**: [dashboard-stats.ts](frontend/lib/utils/dashboard-stats.ts#L162)  

**Backend API Required**:
```typescript
// Option 1: Get new customers count
customerService.getNewCustomersCount({ 
  outlet: outletId, 
  start_date: periodStart, 
  end_date: periodEnd 
})

// Option 2: Enhance customer list with created_at filtering
// Query customers created in current month vs previous month
```

**Implementation Steps**:
1. Check if `created_at` field exists on customer model
2. Add backend endpoint to filter customers by creation date
3. Compare new customers: this month vs last month
4. Replace hardcoded `customersChange = 0` with actual calculation

---

### 2. 🟠 **OUTSTANDING CREDIT CHANGE - NOT TRACKED**
**Status**: ⏳ PENDING  
**Current**: Hardcoded to `change: 0`  
**Needed**: Compare credit amounts between periods  
**File**: [dashboard-stats.ts](frontend/lib/utils/dashboard-stats.ts#L185)  

**Backend API Required**:
```typescript
// Get outstanding credit for different periods
expenseService.getOutstandingCredit({
  outlet: outletId,
  start_date: thisMonthStart,
  end_date: today
})

expenseService.getOutstandingCredit({
  outlet: outletId,
  start_date: lastMonthStart,
  end_date: lastMonthEnd
})
```

**Implementation Steps**:
1. Fetch outstanding credit for this month
2. Fetch outstanding credit for last month
3. Calculate percentage change
4. Update return object

---

### 3. 🟡 **STAFF COUNT - NO BACKEND DATA SOURCE**
**Status**: ⏳ NEEDS DESIGN  
**Current**: Using product count as workaround  
**Options**:
- **Option A**: Add staff/employee management feature to backend
- **Option B**: Keep as "Products" card permanently
- **Option C**: Remove from dashboard, add dedicated staff module

**Recommended**: Option A (if staff management is in roadmap) or Option B (if not)

---

## Current KPI Card Status

| # | Card | Data Source | Calculation | Trend | Status |
|---|------|-------------|-------------|-------|--------|
| 1 | Today's Sales | saleService.getStats() | Revenue Today | Yesterday | ✅ GOOD |
| 2 | Transactions | saleService.list() | Count Today | Yesterday | ✅ GOOD |
| 3 | Expenses | expenseService.stats() | Month Total | Last Month | ✅ GOOD |
| 4 | Profit | (Sales - Expenses) | Today's Calc | Yesterday | ✅ **FIXED** |
| 5 | Customers | customerService.list() | Total Count | Not Tracked | ⚠️ PENDING |
| 6 | Outstanding Credit | Sum of balances | Month Total | Not Tracked | ⚠️ PENDING |
| 7 | Products | productService.count() | Active Count | Not Tracked | ✅ **FIXED** (renamed) |
| 8 | Purchases (AOV) | Revenue / Transactions | Daily Calc | Yesterday | ✅ **FIXED** |

---

## Data Flow Diagram

```
API Calls (Parallel)
├── saleService.getStats(today) ────→ Today's Sales ✅
├── saleService.getStats(yesterday) ┐
│                                    └→ Profit Change ✅
├── expenseService.stats(today) ────┘
├── saleService.list(today) ────→ Transactions ✅
├── saleService.list(yesterday) → Transactions Change ✅
├── expenseService.stats(thisMonth) ──→ Expenses ✅
├── expenseService.stats(lastMonth) ──→ Expenses Change ✅
├── customerService.list() ──→ Customers ✅ (change: ⏳ pending)
├── productService.count() ──→ Products ✅
└── productService.getLowStock() → Low Stock Count ✅

Calculations:
├── Profit = Today Revenue - Today Expenses ✅
├── AOV = Today Revenue / Today Transactions ✅
└── Outstanding Credit = Σ(balance) where credit_enabled ✅
```

---

## Next Steps

**Priority 1 (Backend Enhancement)**:
1. Verify customer `created_at` field exists
2. Add endpoint to get customer count by creation date range
3. Update `generateKPIData()` to calculate customer change

**Priority 2 (Backend Enhancement)**:
1. Add historical tracking for outstanding credit by period
2. Update `generateKPIData()` to fetch and compare periods

**Priority 3 (Product Decision)**:
1. Decide on Staff feature implementation
2. Update card accordingly or add staff management module

---

## Testing Checklist

- [ ] Purchases card shows currency format (e.g., "$45.50")
- [ ] Profit change compares correctly with yesterday
- [ ] All 8 cards show data aligned with their descriptions
- [ ] No console errors during dashboard load
- [ ] Outlet filtering works (only shows outlet's data)
- [ ] Data refreshes on new sales completion
