# KPI Cards - Complete Data Flow & Formulas

## Overview
The KPI cards get their data from the `generateKPIData()` function in `frontend/lib/utils/dashboard-stats.ts`. This function fetches data from multiple backend APIs and calculates metrics with trend analysis.

---

## 🔄 Data Flow Architecture

```
Dashboard Page (page.tsx)
    ↓
generateKPIData(businessId, business, outletId)
    ↓
Multiple API Calls (in parallel):
├── saleService.getStats() → Sales/Revenue
├── saleService.list() → Transactions
├── productService.count() → Products/Staff
├── customerService.list() → Customers
├── expenseService.stats() → Expenses
├── returnService.list() → Returns
└── productService.getLowStock() → Low Stock Items
    ↓
Process & Calculate Metrics
    ↓
Return DashboardKPI Object
    ↓
KPICards Component (displays in 2 groups of 4)
```

---

## 📊 KPI CARD DATA & FORMULAS

### GROUP 1: SALES & FINANCIAL METRICS

#### 1️⃣ **TODAY'S SALES**
- **Data Source**: `saleService.getStats()` for today
- **Field**: `today_revenue` or `total_revenue`
- **Calculation**:
```
Today's Sales = Sum of all completed sale transactions today
API Call: saleService.getStats({ 
  start_date: TODAY, 
  end_date: TODAY, 
  outlet: outletId, 
  status: "completed" 
})
```
- **Change Percentage** (vs Yesterday):
```
Sales Change = ((Today Revenue - Yesterday Revenue) / Yesterday Revenue) × 100

If Yesterday Revenue = 0 and Today Revenue > 0: Change = 100%
If both are 0: Change = 0%
```
- **Icon**: DollarSign 💰

---

#### 2️⃣ **TRANSACTIONS**
- **Data Source**: `saleService.list()` for today
- **Calculation**:
```
Transactions = Count of all completed sales/transactions today

API Call: saleService.list({ 
  outlet: outletId, 
  status: "completed", 
  start_date: TODAY, 
  end_date: TODAY 
})

Count = response.count OR response.results.length
```
- **Change Percentage** (vs Yesterday):
```
Transactions Change = ((Today Count - Yesterday Count) / Yesterday Count) × 100
```
- **Icon**: ShoppingCart 🛒

---

#### 3️⃣ **EXPENSES**
- **Data Source**: `expenseService.stats()` for this month
- **Field**: `total_expenses`
- **Calculation**:
```
Expenses = Sum of all expenses from Month Start to Today

API Call: expenseService.stats({ 
  outlet: outletId, 
  start_date: MONTH_START, 
  end_date: TODAY 
})
```
- **Change Percentage** (vs Last Month):
```
Expenses Change = ((This Month Expenses - Last Month Expenses) / Last Month Expenses) × 100
```
- **Icon**: ArrowDownRight (↘️)

---

#### 4️⃣ **PROFIT**
- **Data Source**: Calculated from Sales - Expenses
- **Formula**:
```
Today's Profit = Today's Revenue - Today's Expenses

Where:
  Today's Revenue = saleService.getStats(today).total_revenue
  Today's Expenses = expenseService.stats(today).today_expenses
```
- **Change Percentage** (vs Yesterday):
```
Profit Change = ((Today Profit - Yesterday Profit) / Yesterday Profit) × 100

Where:
  Today Profit = Today Revenue - Today Expenses
  Yesterday Profit = Yesterday Revenue - Yesterday Expenses
```
- **Icon**: ArrowUpRight (↗️)

---

### GROUP 2: BUSINESS OPERATIONS METRICS

#### 5️⃣ **CUSTOMERS**
- **Data Source**: `customerService.list()` (paginated, all pages)
- **Field**: Count of all customer records
- **Calculation**:
```
Customers = Total count of all active customers in system

API Call: customerService.list({ 
  outlet: outletId, 
  page: 1, 2, 3, ... (loops through all pages)
})

Customers = Sum of all pages returned
```
- **Change Percentage**: Currently 0% (TODO: Implement new customers this month tracking)
- **Icon**: Users 👥

---

#### 6️⃣ **OUTSTANDING CREDIT**
- **Data Source**: `customerService.list()` - filtered by credit enabled
- **Formula**:
```
Outstanding Credit = Sum of all customer outstanding_balance values
  WHERE credit_enabled = true AND outstanding_balance > 0

Calculation:
  1. Fetch all customers
  2. Filter: customers with credit_enabled AND outstanding_balance > 0
  3. Sum all outstanding_balance values
  
Outstanding Credit = Σ(customer.outstanding_balance)
```
- **Change Percentage**: 0% (not compared with previous period)
- **Icon**: CreditCard 💳

---

#### 7️⃣ **STAFF**
- **Data Source**: `productService.count()` (currently repurposed for staff)
- **Field**: `productCount` (should be refactored to actual staff count)
- **Calculation**:
```
Staff = Count of active products (NOTE: This should be replaced with actual staff count)

API Call: productService.count({ 
  is_active: true, 
  outlet: outletId 
})
```
- **Change Percentage**: 0%
- **Icon**: Users 👥

**⚠️ NOTE**: The "Staff" card currently uses product count data. This should be updated to use actual staff/employee data from a staffService or employees table once available.

---

#### 8️⃣ **PURCHASES**
- **Data Source**: Calculated from Total Sales / Number of Transactions (Average Order Value)
- **Formula**:
```
Purchases (Avg Order Value) = Today's Revenue / Number of Transactions

API Calls:
  Revenue: saleService.getStats(today)
  Transactions: saleService.list(today).count

Calculation:
  Today AOV = Today Revenue / Today Transaction Count
  Yesterday AOV = Yesterday Revenue / Yesterday Transaction Count (if > 0, else 0)
```
- **Change Percentage** (vs Yesterday):
```
Purchases Change = ((Today AOV - Yesterday AOV) / Yesterday AOV) × 100
```
- **Icon**: ShoppingCart 🛒

---

## 📅 Time Periods Used

| Metric | Comparison Period |
|--------|-------------------|
| Today's Sales | Today vs Yesterday |
| Transactions | Today vs Yesterday |
| Expenses | This Month vs Last Month |
| Profit | Today vs Yesterday |
| Customers | No comparison |
| Outstanding Credit | No comparison |
| Staff | No comparison |
| Purchases (AOV) | Today vs Yesterday |

---

## 🔗 API Services Used

### 1. **saleService**
```typescript
// Get sales statistics
saleService.getStats({ 
  start_date: string, 
  end_date: string, 
  outlet?: string,
  status?: "completed" | "pending" | "cancelled"
})

// List sales transactions
saleService.list({ 
  outlet?: string,
  status?: string,
  start_date?: string,
  end_date?: string,
  page?: number
})

// Get chart data for last 7 days
saleService.getChartData(outletId, status)
```

### 2. **expenseService**
```typescript
// Get expense statistics
expenseService.stats({ 
  outlet?: string,
  start_date: string,
  end_date: string
})
// Returns: { total_expenses, today_expenses, pending_count, category_breakdown, status_breakdown }
```

### 3. **customerService**
```typescript
// List all customers (paginated)
customerService.list({ 
  outlet?: string,
  page: number
})
// Returns: List with customer.outstanding_balance, customer.credit_enabled
```

### 4. **productService**
```typescript
// Count products
productService.count({ 
  is_active: boolean,
  outlet?: string
})

// Get low stock products
productService.getLowStock(outletId)
```

### 5. **returnService**
```typescript
// List returns
returnService.list({ 
  outlet?: string,
  start_date: string,
  end_date: string
})
```

---

## 💾 Caching Strategy

All API calls use a request cache to avoid redundant calls:

```typescript
requestCache.getOrSet(`cache-key-${businessId}-${date}`, () => 
  apiCall()
)
```

This means if the same data is requested within the session, it returns cached data instead of making another API call.

---

## 🔄 Real-time Updates

The dashboard refreshes data when:
1. User clicks "Refresh Dashboard" button
2. A sale is completed (via `sale-completed` event)
3. User manually navigates to the page

---

## 📝 Data Types & Formats

```typescript
interface DashboardKPI {
  sales: { value: number; change: number }           // Revenue in currency units
  customers: { value: number; change: number }       // Count of customers
  products: { value: number; change: number }        // Count of products
  expenses: { value: number; change: number }        // Amount in currency
  profit: { value: number; change: number }          // Amount in currency
  transactions: { value: number; change: number }    // Count of transactions
  avgOrderValue: { value: number; change: number }   // Amount in currency
  lowStockItems: { value: number; change: number }   // Count of items
  outstandingCredit: { value: number; change: number } // Amount in currency
  returns: { value: number; change: number }         // Count of returns
}
```

---

## 🎯 Summary Table

| Card | Raw Value | Compare With | Formula | Status |
|------|-----------|--------------|---------|--------|
| Today's Sales | Revenue Sum | Yesterday | (Today - Yesterday) / Yesterday × 100 | ✅ Working |
| Transactions | Count | Yesterday Count | (Today - Yesterday) / Yesterday × 100 | ✅ Working |
| Expenses | Month Sum | Last Month Sum | (This - Last) / Last × 100 | ✅ Working |
| Profit | Revenue - Expenses | Yesterday Profit | (Today - Yesterday) / Yesterday × 100 | ✅ Working |
| Customers | Total Count | N/A | Sum of all customers | ✅ Working |
| Outstanding Credit | Sum of Balances | N/A | Σ balance WHERE credit_enabled | ✅ Working |
| Staff | Product Count | N/A | Count of products | ⚠️ Needs Fix |
| Purchases (AOV) | Revenue / Count | Yesterday AOV | (Today - Yesterday) / Yesterday × 100 | ✅ Working |

---

## ⚠️ Known Issues & Improvements Needed

1. **Staff Card**: Currently uses product count. Should use actual employee/staff data.
2. **Customer Growth**: No customer growth comparison implemented (currently hardcoded to 0%).
3. **Outstanding Credit Change**: Not compared with previous period.
4. **Low Stock Items Change**: Not compared with previous period.

---

## 🚀 Backend Response Examples

### Sales Stats Response
```json
{
  "total_revenue": 5000,
  "today_revenue": 5000,
  "total_sales": 25,
  "today_sales": 25
}
```

### Expense Stats Response
```json
{
  "total_expenses": 1500,
  "today_expenses": 200,
  "pending_count": 2,
  "category_breakdown": [],
  "status_breakdown": []
}
```

### Customer List Response
```json
{
  "count": 150,
  "next": null,
  "results": [
    { "id": 1, "name": "John", "outstanding_balance": 500, "credit_enabled": true },
    { "id": 2, "name": "Jane", "outstanding_balance": 0, "credit_enabled": false }
  ]
}
```

---

## 📌 Key Takeaways

✅ All 8 KPI cards are data-driven from backend APIs
✅ Each metric has a clear calculation formula
✅ Trend comparisons help show performance changes
✅ Data is cached to improve performance
✅ Real-time updates trigger on sales/events
✅ Multi-outlet support with outlet filtering
