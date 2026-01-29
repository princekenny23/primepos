# Phase 2: Sales Integration & Perpetual Inventory

**Status:** READY TO IMPLEMENT  
**Duration:** 1 week (Days 6-10)  
**Prerequisite:** Phase 1 ✅ COMPLETE (13/13 tests passing)

---

## Executive Summary

Phase 2 integrates the new atomic FIFO stock deduction with the Sales system. **Good news:** The sales module is **already using** `deduct_stock()` function from Phase 1! This phase focuses on:

1. ✅ **Verify existing integration** - Sales already calls `deduct_stock()`
2. **Add sales integration tests** - Comprehensive sale→stock deduction scenarios
3. **Add voiding/refund logic** - Reverse stock when sales cancelled/refunded
4. **Implement reconciliation** - Daily batch↔LocationStock verification
5. **Performance validation** - End-to-end sale creation performance

---

## Current Integration Status

### ✅ Already Implemented in sales/views.py

**Location:** [apps/sales/views.py#L298-L310](apps/sales/views.py#L298-L310)

```python
# Check stock availability
if variation and variation.track_inventory:
    # Use batch-aware stock checking for variations
    available_stock = get_available_stock(variation, outlet)
    
    if available_stock < quantity_in_base_units:
        raise serializers.ValidationError(...)
    
    # Deduct from batches (FIFO expiry logic)
    deduct_stock(
        variation=variation,
        outlet=outlet,
        quantity=quantity_in_base_units,
        user=request.user,
        reference_id=str(sale.id),
        reason=f"Sale {sale.receipt_number}"
    )
```

**What this means:**
- ✅ Every sale automatically deducts stock via FIFO logic
- ✅ Stock movements are audit-trailed in StockMovement
- ✅ Transaction is atomic (all-or-nothing)
- ✅ Expired batches are automatically excluded

---

## Phase 2 Tasks

### Task 1: Integration Tests (Day 6-7)

**Goal:** Verify sales→stock deduction works end-to-end

**Test Coverage:**
- ✅ Create sale → verify stock deducted ✓
- ✅ Create sale with multiple variations → each deducted correctly ✓
- ✅ Insufficient stock → sale fails with proper error ✓
- ✅ FIFO ordering respected during sale ✓
- ✅ Expired batches skipped during sale ✓
- ✅ LocationStock stays in sync after sale ✓

**Implementation:**
- File: `apps/sales/tests/test_sale_stock_integration.py` (NEW)
- Test classes:
  - `SaleStockDeductionTests` (8 tests)
  - `SaleRefundTests` (4 tests)

**Expected Results:**
```
Ran 12 tests in X seconds
OK
```

---

### Task 2: Refund/Void Logic (Day 7-8)

**Goal:** When sales are voided/refunded, restore stock

**Changes Required:**

#### In sales/models.py - Add refund method
```python
def void_sale(self, reason=""):
    """Void this sale and restore stock"""
    # Set status to voided
    self.status = 'voided'
    self.save()
    
    # For each item, restore stock
    for item in self.items.all():
        if item.variation and item.variation.track_inventory:
            add_stock(
                variation=item.variation,
                outlet=self.outlet,
                quantity=item.quantity_in_base_units,
                batch_number="REFUND",
                expiry_date=timezone.now().date(),
                user=self.user,
                reason=f"Refund for sale {self.receipt_number}: {reason}"
            )
```

#### In sales/views.py - Add void endpoint
```python
@action(detail=True, methods=['post'])
def void(self, request, pk=None):
    """Void a sale and restore stock"""
    sale = self.get_object()
    reason = request.data.get('reason', 'No reason provided')
    
    sale.void_sale(reason)
    
    return Response(
        {"detail": f"Sale {sale.receipt_number} voided and stock restored"},
        status=status.HTTP_200_OK
    )
```

**Tests (4 scenarios):**
- Void sale → stock restored
- Void sale with multiple items → all items restored
- Void refunded sale → no double restoration
- Voiding creates reverse StockMovement

---

### Task 3: Reconciliation System (Day 8-9)

**Goal:** Daily verification that Batch totals = LocationStock

**Implementation:**

#### Create apps/inventory/reconciliation.py (NEW)

```python
from django.db.models import Sum
from .models import Batch, LocationStock, StockMovement

def reconcile_variation_stock(variation, outlet):
    """
    Reconcile a variation's stock across all batches vs LocationStock
    Returns: {status: 'ok'|'variance', variance_qty: int, variance_pct: float}
    """
    # Sum all batches
    batch_total = Batch.objects.filter(
        variation=variation,
        outlet=outlet
    ).aggregate(total=Sum('quantity'))['total'] or 0
    
    # Get LocationStock
    loc_stock = LocationStock.objects.filter(
        variation=variation,
        outlet=outlet
    ).first()
    
    loc_stock_qty = loc_stock.quantity if loc_stock else 0
    
    variance = abs(batch_total - loc_stock_qty)
    variance_pct = (variance / loc_stock_qty * 100) if loc_stock_qty > 0 else 0
    
    return {
        'batch_total': batch_total,
        'location_stock': loc_stock_qty,
        'variance': variance,
        'variance_pct': variance_pct,
        'status': 'ok' if variance == 0 else 'variance',
    }

def reconcile_outlet(outlet):
    """Reconcile all variations in an outlet"""
    issues = []
    
    for variation in outlet.product.all().values_list('itemvariation', flat=True):
        result = reconcile_variation_stock(variation, outlet)
        if result['variance'] > 0:
            issues.append({
                'variation_id': variation,
                **result
            })
    
    return issues
```

#### Create management command
```python
# apps/inventory/management/commands/reconcile_stock.py

python manage.py reconcile_stock [--outlet <id>] [--fix]

# Outputs reconciliation report
# --fix flag automatically syncs LocationStock to Batch totals
```

**Testing:**
- Normal case: batch_total == location_stock (no variance)
- Variance detected: batch_total != location_stock
- Fix applied: LocationStock synced to Batch

---

### Task 4: Daily Audit Report (Day 9-10)

**Goal:** Daily report of all stock movements

**Implementation:**

#### Create StockAuditLog view

```python
class StockAuditReportView(APIView):
    """Daily stock audit report"""
    
    def get(self, request):
        """Get stock movements for date range"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        movements = StockMovement.objects.filter(
            tenant=request.user.tenant,
            created_at__range=[start_date, end_date]
        ).select_related(
            'variation', 'batch', 'user'
        ).order_by('-created_at')
        
        # Group by variation
        report = {}
        for movement in movements:
            var_key = f"{movement.variation.product.name} - {movement.variation.name}"
            if var_key not in report:
                report[var_key] = {
                    'purchases': 0,
                    'sales': 0,
                    'adjustments': 0,
                    'expired': 0,
                }
            
            if movement.movement_type == 'purchase':
                report[var_key]['purchases'] += movement.quantity
            elif movement.movement_type == 'sale':
                report[var_key]['sales'] += movement.quantity
            elif movement.movement_type == 'adjustment':
                report[var_key]['adjustments'] += movement.quantity
            elif movement.movement_type == 'expiry':
                report[var_key]['expired'] += movement.quantity
        
        return Response(report)
```

**Output Example:**
```json
{
  "Rice - 5kg Bag": {
    "purchases": 100,
    "sales": 45,
    "adjustments": -5,
    "expired": 0,
    "net_change": 50
  },
  "Salt - 1kg": {
    "purchases": 200,
    "sales": 150,
    "adjustments": 0,
    "expired": 10,
    "net_change": 40
  }
}
```

---

## Phase 2 Testing Checklist

### Unit Tests (12 tests, ~2 hours)
- [ ] Sale created → stock deducted ✓
- [ ] Multiple items → each deducted ✓
- [ ] Insufficient stock → error ✓
- [ ] FIFO order maintained ✓
- [ ] Expired excluded ✓
- [ ] LocationStock synced ✓
- [ ] Sale voided → stock restored ✓
- [ ] Refund reverses deduction ✓
- [ ] Reconciliation detects variance ✓
- [ ] Reconciliation fixes sync ✓
- [ ] Audit report groups correctly ✓
- [ ] Performance <200ms per sale ✓

### Integration Tests (Real scenarios)
- [ ] Day 1 sales cycle: PO→Sale→Refund
- [ ] Multiple outlets: Stock isolated properly
- [ ] Concurrent sales: FIFO maintained
- [ ] End-of-day: All movements logged
- [ ] Report generation: Accurate summaries

---

## Phase 2 Metrics

| Metric | Target | Phase 1 | Phase 2 |
|--------|--------|---------|---------|
| Test Pass Rate | 100% | 13/13 ✅ | 25/25 🎯 |
| Stock Deduction Time | <100ms | 29.54ms ✅ | <100ms 🎯 |
| Sale Creation Time | <200ms | TBD | <200ms 🎯 |
| Query N+1 Issues | 0 | 0 ✅ | 0 🎯 |
| Batch↔LocationStock Variance | 0 | N/A | 0 🎯 |

---

## Implementation Order

1. **Day 6-7:** Create integration tests
2. **Day 7-8:** Implement refund/void logic
3. **Day 8-9:** Implement reconciliation
4. **Day 9-10:** Implement audit reporting & performance validation

---

## Code Review Checklist

- [ ] All stock deductions use `deduct_stock()` (atomic)
- [ ] All refunds use `add_stock()` with 'REFUND' batch_number
- [ ] StockMovement created for every deduction
- [ ] LocationStock kept in sync after every operation
- [ ] Expired batches never sold (auto-excluded)
- [ ] No race conditions (select_for_update used)
- [ ] Tests cover happy path + 5+ edge cases
- [ ] Performance <200ms per operation
- [ ] Transactions properly rolled back on error

---

## Success Criteria

✅ **Phase 2 Complete when:**
1. All 25 tests passing (13 Phase 1 + 12 Phase 2)
2. Zero stock deduction failures
3. Reconciliation passes daily checks
4. Sale creation <200ms (99th percentile)
5. Code review approved
6. Documentation complete

---

## Next: Phase 3

After Phase 2 completion, move to:
- **Phase 3 (Week 3-4):** Physical inventory counts (StockTake)
- **Phase 4 (Week 4-5):** Frontend integration
- **Phase 5 (Week 5):** Production monitoring & optimization

