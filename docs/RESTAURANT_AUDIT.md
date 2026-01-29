# Restaurant Module - Full Stack Audit & Tenant/Outlet Isolation Analysis

**Date:** January 24, 2026  
**Status:** Critical Issues Found  
**Impact:** Data Isolation, Till/Outlet Management

---

## Executive Summary

The restaurant module has **proper tenant/outlet architecture at the database and backend levels**, but faces **critical issues in the frontend outlet management and till (POS terminal) tracking**.

### Critical Issues:
1. ❌ **Outlet Selection Not Persisted** - `currentOutlet` may be null when navigating
2. ❌ **Till Association Missing** - No till/terminal tracking in orders/tables
3. ❌ **Outlet Data Confusion** - Backend returns nested outlet objects causing transformation issues
4. ⚠️ **Missing Outlet Filtering** - Some API calls don't pass outlet filter

---

## Backend Architecture (✅ SOLID)

### Database Level
- **Models:** `Table`, `KitchenOrderTicket` both have:
  - `tenant` ForeignKey (required)
  - `outlet` ForeignKey (nullable but recommended)
  - Unique constraints: `unique_together=['tenant', 'number']` for tables

### API Layer
- **ViewSets:** `TableViewSet`, `KitchenOrderTicketViewSet`
- **Security:** Both use `TenantFilterMixin`
- **Queryset Filtering:**
  ```python
  # In get_queryset():
  if not is_saas_admin:
      queryset = queryset.filter(tenant=tenant)  # ✅ Enforced
  ```
- **Serialization:** Validates outlet belongs to tenant before create/update

### Endpoints
- `/api/v1/restaurant/tables/` - List/Create tables
- `/api/v1/restaurant/kitchen-orders/` - List/Create KOTs
- Both support outlet filtering: `?outlet=<id>`

---

## Frontend Architecture (⚠️ ISSUES FOUND)

### 1. Outlet Selection & Persistence
**File:** `stores/businessStore.ts`

**Current Flow:**
```typescript
setCurrentBusiness(businessId) {
  // ✅ Loads business
  // ✅ Calls loadOutlets(businessId)
  // ✅ Auto-selects first outlet if !currentOutlet
}

loadOutlets(businessId) {
  // 🔴 ISSUE: Outlet service returns ALL outlets (backend filters by tenant)
  // ✅ Frontend filters by businessId for extra safety
  // ✅ Auto-selects if currentOutlet is null
}
```

**Problems:**
- `currentOutlet` is stored in localStorage via `persist()`
- If outlet is deleted or user switches business without clearing outlet, data mismatch occurs
- No validation that `currentOutlet` actually belongs to `currentBusiness`

**Fix Needed:**
```typescript
// Add validation in setCurrentBusiness
setCurrentBusiness: async (businessId: string) => {
  // ... existing code ...
  const outlets = get().outlets
  const currentOutlet = get().currentOutlet
  
  // Validate current outlet belongs to new business
  if (currentOutlet && !outlets.find(o => o.id === currentOutlet.id)) {
    // Clear invalid outlet
    set({ currentOutlet: null })
  }
  
  // Set first outlet
  if (outlets.length > 0 && !get().currentOutlet) {
    set({ currentOutlet: outlets[0] })
  }
}
```

---

### 2. Till/Terminal Not Tracked
**Issue:** Restaurant orders don't track which till/terminal placed the order.

**Current Data Flow:**
- Order (KOT) has: `sale_id`, `table_id`, `priority`, `notes`
- Sale has: `user`, `outlet`, `payment_method`
- **Missing:** Till/Terminal ID

**Why This Matters for Malawi MVP:**
- Multi-till restaurants need to track which terminal served which table
- Till reconciliation requires per-terminal sales
- Staff accountability (which till had issues)

**Backend Missing:**
```python
# In KitchenOrderTicket model - ADD:
till = models.ForeignKey('outlets.Till', on_delete=models.SET_NULL, null=True, blank=True)

# In Sale model - already has user, but should have:
till = models.ForeignKey('outlets.Till', on_delete=models.SET_NULL, null=True, blank=True)
```

**Frontend Missing:**
```typescript
// orders/page.tsx - loadOrders should extract:
till: kot.sale?.till?.name || "Unknown Till",
tillId: kot.sale?.till?.id || null,
```

---

### 3. Outlet Data Transformation Issues
**File:** `lib/services/outletService.ts`

**Current Problem:**
Backend returns nested outlet in KOT:
```json
{
  "id": "kot-123",
  "outlet": {
    "id": "outlet-456",
    "name": "Main Branch"
  }
}
```

Frontend sometimes receives:
- `outlet: { id, name }` (object)
- `outlet: "outlet-id"` (string)
- `outlet_id: 123` (number)

**Current Code Handles It:**
```typescript
// orders/page.tsx
table: kot.table?.number || "N/A",
outlet: kot.outlet?.name || "N/A",  // ✅ Null-safe
```

**But Serialization is Brittle:**
```typescript
// outletService.ts - lines 17-34
const tenantIdValue = outlet.tenant 
  ? (typeof outlet.tenant === 'object' ? String(outlet.tenant.id) : String(outlet.tenant))
  : String(outlet.businessId || "")
```

This works but is fragile. Backend should return consistent format.

---

### 4. Missing Outlet Validation in Create Operations
**File:** `app/dashboard/restaurant/orders/page.tsx`

```typescript
const response = await kitchenService.list(filters)
// ✅ Good: passes outlet filter

// But when CREATING orders from another page (menu, etc.):
// Need to validate outlet is set:
if (!currentOutlet?.id) {
  toast({ title: "Error", description: "Please select an outlet first" })
  return
}
```

---

### 5. Till Selection UI Missing
**Current Scenario:**
User selects Business → Outlet → But NO Till/Terminal selection

**Frontend Missing:**
```typescript
// In layouts or dashboard:
interface BusinessState {
  currentBusiness: Business | null
  currentOutlet: Outlet | null
  currentTill: Till | null  // 🔴 MISSING
  // ...
  setCurrentTill: (tillId: string) => void  // 🔴 MISSING
}
```

---

## Data Flow Diagram - Current vs Needed

### Current (Problematic)
```
User Login
  └─ Load Business (tenantId)
       └─ Load Outlets (filtered by tenant)
            └─ Auto-select Outlet
                 └─ Load Tables (filtered by outlet) ✅
                 └─ Load KOTs (filtered by outlet) ✅
                 └─ Create Sales (outlet set in backend) ✅
```

### Needed (MVP for Malawi)
```
User Login
  └─ Load Business (tenantId)
       └─ Load Outlets (filtered by tenant)
            └─ VALIDATE & SELECT Outlet
                 └─ Load Tills (filtered by outlet) ⬅️ ADD THIS
                      └─ SELECT Till (for POS terminal)
                           └─ Load Tables (filtered by outlet)
                           └─ Load KOTs (filtered by outlet, till)
                           └─ Create Sales (outlet, till set in backend)
```

---

## Recommendations (Priority Order)

### 🔴 CRITICAL - Do Before MVP Launch
1. **Add Till Tracking to Sales/KOT**
   - Backend: Add `till` FK to `Sale` and `KitchenOrderTicket`
   - Frontend: Add till selection to businessStore
   - UI: Add till dropdown in outlet selector

2. **Validate Outlet on Every Page Load**
   - Check `currentOutlet` belongs to `currentBusiness`
   - Redirect to outlet selector if invalid
   
3. **Fix Outlet Serialization**
   - Backend: Return consistent outlet format (always nested object)
   - Frontend: Simplify outletService transformation

### 🟡 IMPORTANT - Do in Phase 1
4. **Add Till Reconciliation**
   - Filter orders/sales by selected till
   - Till opening/closing balance
   
5. **Implement Outlet Selector UI**
   - Add dropdown to topbar after Business selector
   - Show current outlet name/address
   - Allow outlet switching

### 🟢 NICE-TO-HAVE - Phase 2
6. **Multi-outlet Dashboard**
   - Summary view across all outlets
   - Per-outlet KPIs

---

## Code Changes Needed

### Backend Changes

**1. Add Till FK to Sale & KOT**
```python
# apps/sales/models.py - Sale model
till = models.ForeignKey('outlets.Till', on_delete=models.SET_NULL, null=True, blank=True, related_name='sales')

# apps/restaurant/models.py - KitchenOrderTicket model
till = models.ForeignKey('outlets.Till', on_delete=models.SET_NULL, null=True, blank=True, related_name='kitchen_orders')
```

**2. Update Serializers**
```python
# apps/sales/serializers.py
class SaleSerializer(serializers.ModelSerializer):
    till = TillSerializer(read_only=True)
    till_id = serializers.UUIDField(write_only=True, required=False)
    # ...
    
    def create(self, validated_data):
        # Validate till belongs to outlet
        till = validated_data.get('till_id')
        outlet = validated_data.get('outlet')
        if till:
            if till.outlet != outlet:
                raise serializers.ValidationError("Till must belong to selected outlet")
```

**3. Update Views**
```python
# apps/sales/views.py - in perform_create:
def perform_create(self, serializer):
    outlet = self.get_outlet_for_request(self.request)
    till = serializer.validated_data.get('till')
    
    if till and till.outlet != outlet:
        raise ValidationError("Till must belong to selected outlet")
    
    serializer.save(tenant=tenant, outlet=outlet, till=till, user=self.request.user)
```

### Frontend Changes

**1. Update businessStore**
```typescript
interface BusinessState {
  // ... existing ...
  currentTill: Till | null
  setCurrentTill: (tillId: string) => void
  loadTills: (outletId: string) => Promise<void>
}

// In store creation:
setCurrentTill: (tillId: string) => {
  // Validate till belongs to currentOutlet
  // Set till
},

loadTills: async (outletId: string) => {
  // Call outletService.listTills(outletId)
  // Auto-select first till if none selected
}
```

**2. Update Orders Page**
```typescript
// app/dashboard/restaurant/orders/page.tsx
const loadOrders = async () => {
  if (!currentOutlet?.id) {
    toast({ title: "Error", description: "Please select an outlet" })
    return
  }
  
  const filters: any = {
    outlet: currentOutlet.id.toString(),
    // till: currentTill?.id, // Add if filtering by till
  }
  
  const response = await kitchenService.list(filters)
  // ... rest of code ...
}
```

**3. Create Outlet/Till Selector Component**
```typescript
// components/business-selector.tsx - UPDATE
export function BusinessSelector() {
  const { currentBusiness, currentOutlet, currentTill, setCurrentOutlet, setCurrentTill } = useBusinessStore()
  
  return (
    <div className="flex gap-2">
      <BusinessDropdown />
      {currentBusiness && <OutletDropdown />}
      {currentOutlet && <TillDropdown />}
    </div>
  )
}
```

---

## Testing Checklist (MVP Validation)

- [ ] Create sale in outlet A, verify KOT shows outlet A
- [ ] Create sale in outlet B, verify KOT shows outlet B
- [ ] Switch outlets, verify tables filter correctly
- [ ] Switch outlets, verify orders filter correctly
- [ ] Select invalid outlet (from another business), verify system redirects
- [ ] Create sale without selecting outlet, verify error
- [ ] Create sale with till, verify till appears in order details
- [ ] Multi-till scenario: Two tills in same outlet, verify separate tracking
- [ ] Till reconciliation: Sum orders by till ID, verify correct

---

## Summary

**Current State:**
- ✅ Backend: Solid tenant/outlet isolation
- ⚠️ Frontend: Outlet selection fragile, till tracking missing
- 🔴 MVP-Critical: Till support not implemented

**Next Steps:**
1. Add till models/FKs to backend
2. Update businessStore with till management
3. Add till filtering to API calls
4. Create outlet/till selector UI
5. Test multi-outlet/multi-till scenarios

