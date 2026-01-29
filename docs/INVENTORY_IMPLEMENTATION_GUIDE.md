# Inventory Management - Professional Implementation Guide

**Status**: Production-Ready Implementation  
**Version**: 2.0  
**Date**: January 2026  
**Objective**: Fix current inventory errors + implement perpetual inventory system with optional product images

---

## Executive Summary

This guide consolidates all inventory requirements into a single implementation strategy. The system will:
- ✅ Fix existing inventory inconsistencies
- ✅ Implement perpetual inventory tracking (real-time, batch-based)
- ✅ Make product images optional (remove hard dependency)
- ✅ Ensure data integrity through immutable ledger system
- ✅ Enable outlet-level stock management with FIFO deduction

---

## Part 1: Current Inventory Errors & Fixes

### 1.1 Identified Issues

| Issue | Current State | Fix |
|-------|---------------|-----|
| **Inconsistent stock deduction** | Multiple paths to deduct stock (not atomic) | Implement single `deduct_stock()` via StockMovement |
| **Product image dependency** | Images are required in Product model | Change `image` field: `blank=True, null=True` |
| **Orphaned stock records** | Batch deletion doesn't clean movements | Add cascading cleanup via Signal handlers |
| **FIFO tracking ambiguity** | Unclear which batch is sold first | Implement `get_fifo_batches()` utility with sorting |
| **No batch expiry handling** | Expired batches sold without warning | Automatic expiry exclusion in sellable_quantity() |
| **Outlet stock reconciliation** | No way to verify stock vs. actual counts | Implement StockTake model for physical audits |

### 1.2 Root Causes

1. **No immutable audit trail**: StockMovement exists but not always used
2. **Mixed responsibility**: Both Product.stock and Batch.quantity track inventory
3. **Race conditions**: No @transaction.atomic wrapping stock operations
4. **Missing validation**: No check for image before upload requirement

---

## Part 2: Perpetual Inventory System Architecture

### 2.1 Core Models (Already in Place - Optimizations Only)

```
Batch (Single source of truth for stock)
├── Contains quantity per batch
├── Tracks expiry date (auto-excludes expired)
├── Supports FIFO deduction via sort order
└── One per variation per outlet per batch_number

StockMovement (Immutable ledger)
├── Records every stock change (sale, purchase, adjustment, damage, expiry)
├── Links to specific batch for traceability
├── Timestamps all operations
└── Read-only after creation (audit trail)

Product (Simplified)
├── Retail/wholesale pricing
├── Category & barcodes
├── Image OPTIONAL (new!)
└── No quantity field (use Batch instead)

ItemVariation (Size/color variants)
├── Has multiple Batches (per outlet)
├── Each Batch is sellable independently
└── Deduction prioritizes FIFO (oldest expiry first)
```

### 2.2 Perpetual Inventory Flow

```
SALE → CREATE STOCKMOVEMENT → FIND FIFO BATCH → REDUCE BATCH QTY
  ↓        (audit trail)        ↓               ↓
"Order placed"  "What happened"  "Which stock"   "Real-time update"

PURCHASE → CREATE STOCKMOVEMENT → CREATE/UPDATE BATCH → INCREASE QTY
  ↓         (audit trail)         ↓                     ↓
"Stock received"  "Track source"   "New or existing"   "Live tracking"
```

### 2.3 Key Features

| Feature | Implementation |
|---------|-----------------|
| **Real-time stock** | Batch.quantity decreases immediately on sale |
| **FIFO deduction** | get_fifo_batches(variation, outlet) sorts by expiry_date |
| **Batch-level costing** | Batch.cost_price tracks historical costs |
| **Expiry management** | Batch.sellable_quantity() returns 0 if expired |
| **Audit trail** | StockMovement logs every change with reason |
| **Outlet isolation** | Each outlet has independent stock (multi-outlet support) |
| **Inventory variance** | StockTake model compares physical count vs. system |

---

## Part 3: Code Changes Required

### 3.1 Change #1: Make Product Images Optional

**File**: [backend/apps/products/models.py](backend/apps/products/models.py)

```python
# BEFORE:
image = models.ImageField(upload_to='products/', blank=True, null=True)

# AFTER: Already correct! Just ensure serializer handles it
```

**Status**: ✅ Already implemented correctly

### 3.2 Change #2: Implement FIFO Batch Deduction

**File**: [backend/apps/inventory/stock_helpers.py](backend/apps/inventory/stock_helpers.py)

Add utility function:

```python
def get_fifo_batches(variation, outlet):
    """
    Get batches for a variation at an outlet, ordered FIFO
    (oldest expiry date first, non-expired only)
    
    Returns: QuerySet ordered for deduction
    """
    from django.utils import timezone
    from apps.inventory.models import Batch
    
    today = timezone.now().date()
    return Batch.objects.filter(
        variation=variation,
        outlet=outlet,
        expiry_date__gte=today,  # Not expired
        quantity__gt=0            # Has stock
    ).order_by('expiry_date', 'created_at')  # Oldest first
```

### 3.3 Change #3: Atomic Stock Deduction

**File**: [backend/apps/inventory/views.py](backend/apps/inventory/views.py)

```python
from django.db import transaction

@transaction.atomic
def deduct_stock(variation, quantity, outlet, movement_type, reason=""):
    """
    Deduct stock atomically from batches using FIFO
    - Finds non-expired batches for this variation at outlet
    - Reduces quantities in order (oldest expiry first)
    - Creates StockMovement for each batch deducted
    
    Returns: List of deductions made or raises InsufficientStockError
    """
    from apps.inventory.models import StockMovement, Batch
    from apps.inventory.stock_helpers import get_fifo_batches
    
    remaining = quantity
    deductions = []
    
    batches = get_fifo_batches(variation, outlet)
    
    for batch in batches:
        if remaining <= 0:
            break
            
        amount_to_deduct = min(remaining, batch.quantity)
        batch.quantity -= amount_to_deduct
        batch.save()
        
        # Create immutable movement record
        StockMovement.objects.create(
            tenant=variation.tenant,
            batch=batch,
            variation=variation,
            outlet=outlet,
            movement_type=movement_type,
            quantity=amount_to_deduct,
            reason=reason,
            user=None  # Set by API caller
        )
        
        deductions.append({
            'batch': batch.batch_number,
            'quantity': amount_to_deduct,
            'expiry': batch.expiry_date
        })
        remaining -= amount_to_deduct
    
    if remaining > 0:
        raise InsufficientStockError(
            f"Insufficient stock. Needed {quantity}, only {quantity - remaining} available"
        )
    
    return deductions
```

### 3.4 Change #4: Add StockTake Model (Physical Inventory Count)

**File**: [backend/apps/inventory/models.py](backend/apps/inventory/models.py)

Add after StockMovement model:

```python
class StockTake(models.Model):
    """
    Physical inventory count for variance detection
    Compares actual count vs. system count to find discrepancies
    """
    STATUS_CHOICES = [
        ('draft', 'Draft - In Progress'),
        ('completed', 'Completed - Counted'),
        ('reconciled', 'Reconciled - Variances Fixed'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='stock_takes')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='stock_takes')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='stock_takes')
    
    date = models.DateField(auto_now_add=True, help_text="Date of count")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    notes = models.TextField(blank=True, help_text="Discrepancies or observations")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'inventory_stocktake'
        verbose_name = 'Stock Take'
        verbose_name_plural = 'Stock Takes'
        ordering = ['-date']
        indexes = [
            models.Index(fields=['tenant', 'outlet']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"StockTake {self.outlet.name} - {self.date}"


class StockTakeItem(models.Model):
    """
    Individual line items in a stock take
    Compares physical count vs. system count
    """
    stock_take = models.ForeignKey(StockTake, on_delete=models.CASCADE, related_name='items')
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name='stock_take_items')
    
    physical_count = models.IntegerField(help_text="Actual count during physical inventory")
    system_count = models.IntegerField(help_text="Count in system before adjustment")
    variance = models.IntegerField(help_text="Difference (positive=overage, negative=shortage)")
    
    variance_reason = models.CharField(max_length=100, blank=True, help_text="Why variance occurred")
    
    class Meta:
        db_table = 'inventory_stocktakeitem'
        verbose_name = 'Stock Take Item'
        verbose_name_plural = 'Stock Take Items'
        unique_together = [['stock_take', 'batch']]
    
    def save(self, *args, **kwargs):
        """Auto-calculate variance"""
        self.variance = self.physical_count - self.system_count
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.batch} - Variance: {self.variance}"
```

### 3.5 Change #5: Update Batch Model with sellable_quantity Optimization

**File**: [backend/apps/inventory/models.py](backend/apps/inventory/models.py)

Verify/update Batch.sellable_quantity():

```python
def sellable_quantity(self):
    """Return quantity available for sale (0 if expired)"""
    return 0 if self.is_expired() else self.quantity
```

This already exists - ensure it's used in all deduction queries.

### 3.6 Change #6: Implement Stock Take Endpoint

**File**: [backend/apps/inventory/views.py](backend/apps/inventory/views.py)

Add ViewSet for stock takes:

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

class StockTakeViewSet(viewsets.ModelViewSet):
    """
    Physical inventory counts
    POST /api/v1/inventory/stock-takes/ - Create new count
    PATCH /api/v1/inventory/stock-takes/{id}/reconcile/ - Apply adjustments
    """
    serializer_class = StockTakeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return StockTake.objects.filter(
            tenant=self.request.user.tenant,
            outlet=self.request.user.outlets.first()
        )
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reconcile(self, request, pk=None):
        """
        Apply variance adjustments from physical count
        Creates adjustment StockMovements to correct system count
        """
        stock_take = self.get_object()
        
        for item in stock_take.items.all():
            if item.variance != 0:
                movement_type = 'adjustment'
                quantity = abs(item.variance)
                reason = f"Stock take variance: {item.variance_reason}"
                
                if item.variance > 0:
                    # Overage - add stock
                    batch = item.batch
                    batch.quantity += item.variance
                    batch.save()
                else:
                    # Shortage - remove stock (use deduction function)
                    deduct_stock(item.batch.variation, quantity, 
                               item.batch.outlet, 'adjustment', reason)
                
                StockMovement.objects.create(
                    tenant=stock_take.tenant,
                    batch=item.batch,
                    variation=item.batch.variation,
                    outlet=stock_take.outlet,
                    movement_type='adjustment',
                    quantity=abs(item.variance),
                    reason=f"Stock take adjustment: {item.variance_reason}",
                    user=request.user
                )
        
        stock_take.status = 'reconciled'
        stock_take.save()
        
        return Response({'detail': 'Stock take reconciled'})
```

---

## Part 4: Database Migration Strategy

### 4.1 Steps to Apply Changes

```bash
# Step 1: Add StockTake models (if new)
python manage.py makemigrations inventory

# Step 2: Check migration
python manage.py showmigrations inventory

# Step 3: Apply migration
python manage.py migrate inventory

# Step 4: No data reset needed - backward compatible
```

### 4.2 No Breaking Changes

- Batch model: ✅ No changes needed (already optimal)
- StockMovement model: ✅ No changes needed
- Product.image: ✅ Already optional (just verify in serializers)
- New: StockTake + StockTakeItem (new tables, no conflicts)

---

## Part 5: Professional Implementation Roadmap

### Phase 1: Code Cleanup (Week 1)

**Objective**: Fix existing issues without changing flow

```
1.1 - Ensure Product.image handles None gracefully
      └─ Update ProductSerializer to return null for missing images
      
1.2 - Review all stock deduction points
      └─ Sales, adjustments, damage, expiry should use atomic deduct_stock()
      
1.3 - Test FIFO logic with sample data
      └─ Batch ordering, expiry exclusion, quantity reduction
      
1.4 - Add migration for StockTake models
      └─ No data migration needed (new tables)
```

**Testing**: Unit tests for `deduct_stock()`, `get_fifo_batches()`, `sellable_quantity()`

### Phase 2: Perpetual Inventory Enforcement (Week 2)

**Objective**: Make StockMovement the single source of truth

```
2.1 - Replace all stock.quantity -= X with deduct_stock() calls
      └─ Sales, damage, expiry, adjustments
      
2.2 - Implement stock reconciliation report
      └─ Compare Batch.quantity sum vs. Product.stock (should match)
      
2.3 - Add StockMovement indexing
      └─ Speed up audit trail queries (tenant, outlet, movement_type)
      
2.4 - Create stock health dashboard
      └─ Low stock alerts, expiry warnings, variance detection
```

**Testing**: Integration tests for end-to-end sales → stock reduction flow

### Phase 3: Stock Take Implementation (Week 3)

**Objective**: Enable physical inventory counts & variance reconciliation

```
3.1 - Implement StockTakeViewSet
      └─ Create, list, update stock takes
      
3.2 - Add bulk item entry API
      └─ Scan multiple items and quantities quickly
      
3.3 - Auto-calculate variances
      └─ Physical count vs. system count
      
3.4 - Implement reconciliation workflow
      └─ Review variance → apply adjustments → create movements
```

**Testing**: End-to-end stock count with variance adjustment

### Phase 4: Frontend Integration (Week 4)

**Objective**: User interface for inventory operations

```
4.1 - Stock dashboard showing:
      ├─ Real-time stock by outlet
      ├─ FIFO batch details (qty, expiry, cost)
      ├─ Low stock alerts
      └─ Expiry warnings
      
4.2 - Inventory adjustment UI
      ├─ Manual stock corrections
      ├─ Damage/spoilage tracking
      └─ Reason documentation
      
4.3 - Stock take UI
      ├─ Physical count data entry
      ├─ Barcode scanning support
      └─ Variance review & reconciliation
      
4.4 - Product image upload (optional)
      ├─ Skip image if not available
      ├─ Edit existing products without image
      └─ Show placeholder if missing
```

**Testing**: User acceptance testing with staff

### Phase 5: Monitoring & Optimization (Week 5)

**Objective**: Ensure system stability and performance

```
5.1 - Set up stock consistency monitoring
      └─ Daily automated variance checks
      
5.2 - Performance optimization
      ├─ Database indexes (tenant, outlet, variation)
      ├─ Query optimization (bulk deductions)
      └─ Cache frequently accessed counts
      
5.3 - Reporting & auditing
      ├─ Stock movement history per variation
      ├─ Outlet reconciliation reports
      ├─ Expiry tracking & waste analysis
      └─ Cost of goods sold by batch
      
5.4 - Documentation & training
      └─ SOP for physical counts, stock adjustments, variance handling
```

**Testing**: Performance testing with large datasets

---

## Part 6: Technical Specifications

### 6.1 Data Consistency Guarantees

```python
# Rule 1: Every stock change creates a StockMovement
@transaction.atomic
def any_stock_change():
    """Atomically change Batch.quantity and create StockMovement"""
    # If StockMovement fails, Batch.quantity rollsback
    # If Batch.save() fails, StockMovement is never created
    pass

# Rule 2: FIFO is enforced at deduction time
def deduct_stock(...):
    # Always use get_fifo_batches() which sorts by expiry_date
    # Never deduct from arbitrary batch unless specified
    pass

# Rule 3: Expired batches never sell
def sellable_quantity(self):
    # Check expiry_date vs. today
    # Return 0 if expired, regardless of quantity field
    pass

# Rule 4: StockMovement is immutable
# No updates, only creation
# Corrections use new adjustment movements
```

### 6.2 API Contracts

```
POST /api/v1/inventory/deduct/
{
  "variation_id": 421,
  "quantity": 5,
  "outlet_id": 1,
  "movement_type": "sale",
  "reason": "Sale order #12345",
  "reference_id": "order_12345"
}
Response:
{
  "success": true,
  "deductions": [
    {"batch": "BATCH-001", "quantity": 3, "expiry": "2026-02-15"},
    {"batch": "BATCH-002", "quantity": 2, "expiry": "2026-03-01"}
  ]
}

POST /api/v1/inventory/stock-takes/
{
  "outlet_id": 1,
  "items": [
    {"batch_id": 10, "physical_count": 45, "variance_reason": "Found in stockroom"}
  ]
}

POST /api/v1/inventory/stock-takes/{id}/reconcile/
Response: {"detail": "Stock take reconciled", "adjustments": 3}
```

### 6.3 Database Indexes for Performance

```python
# Already in place:
class Batch(models.Meta):
    indexes = [
        models.Index(fields=['tenant']),
        models.Index(fields=['variation', 'outlet']),
        models.Index(fields=['expiry_date']),
        models.Index(fields=['variation', 'outlet', 'expiry_date']),
    ]

# Add for StockMovement:
# - tenant (filter by business)
# - outlet (filter by location)
# - movement_type (filter by operation)
# - created_at (sort by time)
```

---

## Part 7: Risk Mitigation

### 7.1 Data Reconciliation

```python
# Daily check: Sum of all Batch.quantity per variation per outlet
# Should match: StockMovement cumulative total

def reconcile_inventory():
    """Verify system accuracy"""
    for variation in ItemVariation.objects.all():
        for outlet in Outlet.objects.all():
            system_qty = Batch.objects.filter(
                variation=variation, 
                outlet=outlet
            ).aggregate(Sum('quantity'))['quantity__sum'] or 0
            
            # If mismatch found, create StockTake with variance
            # Alert user to investigate
```

### 7.2 Disaster Recovery

```python
# If StockMovement table corrupted:
# - Can rebuild from immutable transaction log
# - All changes audited and timestamped

# If Batch.quantity corrupted:
# - Recalculate from StockMovement total
# - Apply migrations + data restoration
```

### 7.3 Audit Trail

Every inventory change creates immutable StockMovement record:
- What changed (movement_type: sale, purchase, adjustment, etc.)
- When (created_at timestamp)
- How much (quantity)
- Why (reason field)
- Which batch (batch foreign key)
- Who (user field)

---

## Success Criteria

✅ **System considers inventory correct when:**
1. Every stock change has corresponding StockMovement
2. Sum of Batch.quantity = expected stock for each variation/outlet
3. Expired batches are never sold (sellable_quantity() = 0)
4. FIFO deduction is verified in physical counts (no random access)
5. Product images optional - system works with or without them
6. Stock adjustments are audited with reasons
7. Outlet reconciliation shows <1% variance

---

## Rollback Plan

If issues arise:
1. Revert StockTake models (drop tables, remove from admin)
2. Keep all StockMovement data (immutable, always useful)
3. Fix deduction logic, re-migrate
4. Verify with physical counts before production

---

## Next Steps

1. **Review** this document with team
2. **Assign** developer to each phase (or full-time if consolidated)
3. **Start Phase 1** - fix current issues
4. **Test thoroughly** - perpetual inventory is core to business
5. **Go live** - phase by phase with staff training

---

**Document Owner**: Development Team  
**Last Updated**: January 25, 2026  
**Approval Status**: Ready for implementation
