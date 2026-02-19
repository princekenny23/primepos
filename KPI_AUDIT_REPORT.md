# KPI CARDS AUDIT REPORT - Data Calculation Issues

## 🔴 CRITICAL ERRORS FOUND

---

## 1. ❌ **STAFF CARD** - WRONG DATA SOURCE
**Issue**: Uses product count instead of actual staff data  
**File**: [kpi-cards.tsx](frontend/components/dashboard/kpi-cards.tsx#L121)  
**Code**:
```tsx
<KPICard
  title="Staff"
  value={data.products.value.toLocaleString('en-US')}  // ❌ THIS IS PRODUCT COUNT!
  ...
/>
```
**Problem**: 
- `data.products.value` = Count of active products
- Should be = Count of active staff/employees
- Currently showing PRODUCTS as STAFF numbers

**Impact**: Staff count is completely incorrect  
**Fix Priority**: 🔴 CRITICAL

---

## 2. ❌ **PURCHASES CARD** - WRONG FORMATTING
**Issue**: Shows numeric count instead of currency amount  
**File**: [kpi-cards.tsx](frontend/components/dashboard/kpi-cards.tsx#L129)  
**Code**:
```tsx
<KPICard
  title="Purchases"
  value={data.avgOrderValue.value.toLocaleString('en-US')}  // ❌ SHOULD USE formatCurrency()
  ...
/>
```
**Problem**:
- `data.avgOrderValue.value` = Average Order Value (should be in currency format)
- Currently using `.toLocaleString()` like it's a count
- Should use `formatCurrency(data.avgOrderValue.value, business)`

**Impact**: Shows "1,500" instead of "$1,500.00"  
**Example**: If AOV is 1500, shows "1500" not "$1,500"  
**Fix Priority**: 🔴 CRITICAL

---

## 3. ❌ **PROFIT CALCULATION** - INCONSISTENT COMPARISON
**Issue**: Comparing TODAY vs YESTERDAY profit uses different metrics  
**File**: [dashboard-stats.ts](frontend/lib/utils/dashboard-stats.ts#L176)  
**Code**:
```typescript
// TODAY's profit
const todayExpenses = thisMonthExpenseStats.today_expenses || 0       // ⚠️ TODAY's expenses
const todayProfit = todayRevenue - todayExpenses

// YESTERDAY's profit
const yesterdayExpenses = yesterdayExpenseStats.total_expenses || 0   // ⚠️ TOTAL from yesterday
const yesterdayProfit = yesterdayRevenue - yesterdayExpenses
```

**Problem**:
- `todayExpenses` = today_expenses (correct)
- `yesterdayExpenses` = total_expenses (from yesterday's stats)
- Not comparing same metrics!

**Fix**: Should be:
```typescript
// YESTERDAY's profit - use today_expenses from yesterday
const yesterdayExpenses = yesterdayExpenseStats.today_expenses || 0   // ✓ CORRECT
```

**Fix Priority**: 🟠 HIGH

---

## 4. ❌ **CUSTOMERS CHANGE** - HARDCODED TO 0
**Issue**: No actual calculation, always shows 0% change  
**File**: [dashboard-stats.ts](frontend/lib/utils/dashboard-stats.ts#L162)  
**Code**:
```typescript
// Calculate customer metrics
const customersCount = extractResults(customersList).length
const customersChange = 0 // TODO: Implement proper customer growth tracking
```

**Problem**: 
- Change metric is hardcoded to 0
- No year-over-year or month-over-month comparison

**Fix**: Should compare new customers this month vs last month  
**Fix Priority**: 🟠 HIGH

---

## 5. ❌ **OUTSTANDING CREDIT CHANGE** - HARDCODED TO 0
**Issue**: No change calculation, always shows 0%  
**File**: [dashboard-stats.ts](frontend/lib/utils/dashboard-stats.ts#L185)  
**Code**:
```typescript
const totalOutstandingCredit = customersWithCredit.reduce((sum: number, c: any) => sum + (c.outstanding_balance || 0), 0)

return {
  // ...
  outstandingCredit: { value: totalOutstandingCredit, change: 0 },  // ❌ Always 0
}
```

**Fix Priority**: 🟡 MEDIUM

---

## 6. ⚠️ **PRODUCTS/STAFF CHANGE** - HARDCODED TO 0
**Issue**: Staff card shows no change tracking  
**File**: [dashboard-stats.ts](frontend/lib/utils/dashboard-stats.ts#L216)  
**Code**:
```typescript
return {
  // ...
  products: { value: productCount, change: 0 },  // ❌ Always 0 change
  // ...
}
```

**Fix Priority**: 🟡 MEDIUM

---

## 7. ⚠️ **PURCHASES (AVG ORDER VALUE)** - DISPLAYING AS COUNT
**Issue**: Average Order Value shown as plain number, not currency  
**Display**: Should show "$45.50", shows "45.5" or "45" with toLocaleString  
**File**: [kpi-cards.tsx](frontend/components/dashboard/kpi-cards.tsx#L129)  
**Fix Priority**: 🔴 CRITICAL

---

| Card | Issue | Severity | Status |
|------|-------|----------|--------|
| Today's Sales | ✅ Correct | - | GOOD |
| Transactions | ✅ Correct | - | GOOD |
| Expenses | ✅ Correct | - | GOOD |
| Profit | Inconsistent expense comparison | 🟠 HIGH | BROKEN |
| Customers | Change hardcoded to 0 | 🟠 HIGH | PARTIAL |
| Outstanding Credit | Change hardcoded to 0 | 🟡 MEDIUM | PARTIAL |
| **Staff** | **Uses product count** | 🔴 **CRITICAL** | **WRONG** |
| **Purchases** | **Wrong currency format** | 🔴 **CRITICAL** | **WRONG** |

---

## Summary

### ✅ Working Correctly (2):
- Today's Sales
- Transactions
- Expenses

### ⚠️ Partially Working (3):
- Profit (inconsistent expense calculation)
- Customers (change not tracked)
- Outstanding Credit (change not tracked)

### 🔴 Completely Broken (2):
- **Staff** - Shows product count instead of staff count
- **Purchases** - Shows as number instead of currency

---

## Root Causes

1. **Staff Card**: No actual staff/employee data source in system
2. **Purchases Card**: Wrong formatter used (toLocaleString vs formatCurrency)
3. **Profit Calculation**: Mixed use of today_expenses vs total_expenses
4. **Customer/Credit Change**: TODO items never implemented
5. **Data Mismatch**: Using product count for staff count

---

## Required Fixes

1. Create staff/employee data source (or rename Staff to Products)
2. Fix Purchases card to use `formatCurrency()`
3. Fix profit calculation to use consistent expense metrics
4. Implement customer change tracking
5. Implement outstanding credit change tracking
