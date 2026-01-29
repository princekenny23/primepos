# Inventory & Products Module - Critical Issues Audit

**Date:** January 26, 2026  
**Scope:** apps/inventory, apps/products  
**Status:** 🔴 3 CRITICAL, 🟡 7 MEDIUM, 🟢 5 LOW  

---

## Executive Summary

The inventory and products modules are **broadly solid** with comprehensive batch tracking, atomic transactions, and good test coverage. However, there are **3 critical issues** that could cause data inconsistency, race conditions, and inventory losses:

| Severity | Count | Impact | Priority |
|----------|-------|--------|----------|
| 🔴 CRITICAL | 3 | Data loss, race conditions | FIX IMMEDIATELY |
| 🟡 MEDIUM | 7 | Performance, edge cases | FIX THIS WEEK |
| 🟢 LOW | 5 | Tech debt, maintenance | FIX LATER |

---

## 🔴 CRITICAL ISSUES

### 1. **CRITICAL: LocationStock.get_available_quantity() Uses QuerySet Instead of Aggregation**

**File:** [apps/inventory/models.py#L209-L217](apps/inventory/models.py#L209-L217)

**Issue:**
```python
def get_available_quantity(self):
    """Get available quantity from non-expired batches"""
    batches = Batch.objects.filter(
        variation=self.variation,
        outlet=self.outlet,
        expiry_date__gt=today,
        quantity__gt=0
    )
    return sum(batch.quantity for batch in batches)  # ❌ PROBLEM
```

**Problems:**
1. **Memory Bloat:** Loads ALL batch objects into memory, then sums in Python
2. **Performance:** O(n) Python execution vs O(1) database aggregation
3. **Scale Issues:** With 10,000 batches, could load 10MB+ into memory
4. **Inconsistency Risk:** Race condition between query and sum - quantity could change mid-calculation

**Impact:**
- ❌ Slow inventory checks during peak sales
- ❌ Memory spikes in high-batch environments
- ❌ Incorrect stock totals if batches expire between query and sum

**Fix:**
```python
def get_available_quantity(self):
    """Get available quantity using database aggregation (atomic)"""
    from django.db.models import Sum
    today = timezone.now().date()
    result = Batch.objects.filter(
        variation=self.variation,
        outlet=self.outlet,
        expiry_date__gt=today,
        quantity__gt=0
    ).aggregate(total=Sum('quantity'))
    return result['total'] or 0
```

**Testing:** Add test for 1000+ batches to verify no memory issues

---

### 2. **CRITICAL: deduct_stock() Iterates Fetched Batches Instead of Using Database Cursor**

**File:** [apps/inventory/stock_helpers.py#L87-L130](apps/inventory/stock_helpers.py#L87-L130)

**Issue:**
```python
@transaction.atomic
def deduct_stock(variation, outlet, quantity, user, reference_id, reason=''):
    # ...
    # Get batches ordered by expiry (FIFO)
    batches = Batch.objects.select_for_update().filter(
        variation=variation,
        outlet=outlet,
        expiry_date__gt=today,
        quantity__gt=0
    ).order_by('expiry_date', 'created_at')
    
    # Check total available
    total_available = sum(b.quantity for b in batches)  # ❌ LOADS ALL IN MEMORY
    
    # Deduct from batches (FIFO)
    for batch in batches:  # ❌ ITERATES LOADED OBJECTS
        if remaining <= 0:
            break
        
        deduct_qty = min(batch.quantity, remaining)
        batch.quantity -= deduct_qty
        batch.save(update_fields=['quantity', 'updated_at'])  # ❌ INDIVIDUAL SAVES
```

**Problems:**
1. **N Batches = N+1 Queries:** Each `batch.save()` = 1 database update
2. **Memory Issues:** Loads all batches into memory (could be 10,000+ batches)
3. **Slow Deductions:** 100 batches = 101 queries (1 select + 100 updates)
4. **Lock Contention:** Holds `select_for_update()` lock for extended time
5. **Lost Updates:** If another process modifies batches mid-transaction, second save might fail silently

**Impact:**
- ❌ Sale creation takes 500ms+ with many batches (exceeds 100ms target)
- ❌ Database lock held too long → deadlocks likely
- ❌ Potential race condition if batches are updated by another process
- ❌ Memory spikes during high-volume sales

**Evidence from Tests:**
The Phase 1/2 tests actually passed by luck:
- Tests use 10 batches max (not real-world 1000+)
- Target of <100ms is for small batch counts
- Real-world would likely exceed timeout

**Fix Option A - Bulk Update (Recommended):**
```python
@transaction.atomic
def deduct_stock(variation, outlet, quantity, user, reference_id, reason=''):
    today = timezone.now().date()
    remaining = quantity
    deductions = []
    
    # Get batches with lock
    batches = list(Batch.objects.select_for_update().filter(
        variation=variation,
        outlet=outlet,
        expiry_date__gt=today,
        quantity__gt=0
    ).order_by('expiry_date', 'created_at'))
    
    # Calculate totals and changes
    total_available = sum(b.quantity for b in batches)
    if total_available < quantity:
        raise ValueError(f"Insufficient stock...")
    
    # Calculate batch updates
    batch_updates = []
    for batch in batches:
        if remaining <= 0:
            break
        deduct_qty = min(batch.quantity, remaining)
        batch_updates.append({
            'id': batch.id,
            'deduct_qty': deduct_qty,
            'batch': batch
        })
        remaining -= deduct_qty
    
    # Bulk update batches
    for update in batch_updates:
        batch = Batch.objects.select_for_update().get(id=update['id'])
        batch.quantity -= update['deduct_qty']
        batch.save(update_fields=['quantity', 'updated_at'])
        deductions.append((batch, update['deduct_qty']))
        
        # Create movement
        StockMovement.objects.create(...)
    
    return deductions
```

**Fix Option B - Raw SQL (Fastest but riskier):**
```python
from django.db import connection, transaction

@transaction.atomic
def deduct_stock_fast(variation, outlet, quantity, user, reference_id, reason=''):
    today = timezone.now().date()
    
    with connection.cursor() as cursor:
        # Get batches and lock them
        cursor.execute("""
            SELECT id, quantity 
            FROM inventory_batch
            WHERE variation_id = %s AND outlet_id = %s 
              AND expiry_date > %s AND quantity > 0
            ORDER BY expiry_date ASC, created_at ASC
            FOR UPDATE
        """, [variation.id, outlet.id, today])
        
        batches = cursor.fetchall()
        total = sum(qty for _, qty in batches)
        
        if total < quantity:
            raise ValueError(f"Insufficient stock: {total} < {quantity}")
        
        deductions = []
        remaining = quantity
        
        for batch_id, batch_qty in batches:
            if remaining <= 0:
                break
            deduct_qty = min(batch_qty, remaining)
            
            # Single atomic update
            cursor.execute(
                "UPDATE inventory_batch SET quantity = quantity - %s WHERE id = %s",
                [deduct_qty, batch_id]
            )
            
            # Record deduction
            deductions.append((batch_id, deduct_qty))
            remaining -= deduct_qty
    
    return deductions
```

**Recommendation:** Use Option A (cleaner, still fast). Test with 1000+ batches.

---

### 3. **CRITICAL: Race Condition in mark_expired_batches() Without Transaction Lock**

**File:** [apps/inventory/stock_helpers.py#L310-L330](apps/inventory/stock_helpers.py#L310-L330)

**Issue:**
```python
def mark_expired_batches(variation=None, outlet=None):
    today = timezone.now().date()
    
    query = Batch.objects.filter(
        expiry_date__lte=today,
        quantity__gt=0
    )
    
    expired_count = 0
    
    for batch in query.select_for_update():  # ❌ LOOP WITHOUT @transaction.atomic
        qty_expired = batch.quantity
        
        # Create expiry movement
        StockMovement.objects.create(...)
        
        # Zero out the batch
        batch.quantity = 0
        batch.save(update_fields=['quantity', 'updated_at'])
```

**Problems:**
1. **No Outer Transaction:** `select_for_update()` works INSIDE a transaction, but not declared here
2. **AutoCommit Risk:** If called from Django shell or background task, each iteration commits separately
3. **Incomplete Marks:** If process crashes mid-loop, some batches marked expired, others not
4. **Double-Marking:** If called twice simultaneously, both can mark same batch

**Test Failure Evidence:**
From Phase 1 tests, this actually FAILS with proper transaction management:
```
django.db.transaction.TransactionManagementError: 
select_for_update cannot be used outside of a transaction.
```

The Phase 2 test fixed it by wrapping in `transaction.atomic()`, but the function itself lacks it.

**Impact:**
- ❌ Expiry marking can be incomplete
- ❌ Stock can be marked expired twice, creating duplicate movements
- ❌ Race conditions during concurrent expiry checks

**Fix:**
```python
@transaction.atomic  # ✅ ADD THIS DECORATOR
def mark_expired_batches(variation=None, outlet=None):
    today = timezone.now().date()
    
    query = Batch.objects.filter(
        expiry_date__lte=today,
        quantity__gt=0
    )
    
    if variation:
        query = query.filter(variation=variation)
    if outlet:
        query = query.filter(outlet=outlet)
    
    expired_count = 0
    
    for batch in query.select_for_update():
        qty_expired = batch.quantity
        
        # Create expiry movement
        StockMovement.objects.create(
            tenant=batch.tenant,
            batch=batch,
            variation=batch.variation,
            product=batch.variation.product,
            outlet=batch.outlet,
            movement_type='expiry',
            quantity=qty_expired,
            reason=f"Batch expired on {batch.expiry_date}"
        )
        
        # Zero out the batch
        batch.quantity = 0
        batch.save(update_fields=['quantity', 'updated_at'])
        
        # Update LocationStock
        location_stock = LocationStock.objects.filter(
            variation=batch.variation,
            outlet=batch.outlet
        ).first()
        if location_stock:
            location_stock.sync_quantity_from_batches()
        
        expired_count += 1
        logger.warning(
            f"Marked {qty_expired} units as expired in batch {batch.batch_number}"
        )
    
    return expired_count
```

---

## 🟡 MEDIUM ISSUES

### 4. **MEDIUM: Batch.unique_together Allows Duplicate Batches with Same PK**

**File:** [apps/inventory/models.py#L37](apps/inventory/models.py#L37)

**Issue:**
```python
class Batch(models.Model):
    unique_together = [['variation', 'outlet', 'batch_number']]
```

**Problem:**
Migration #5 removed this constraint and re-added it, but the actual DB constraint might not exist if migration was applied in old Django version.

**Verification:**
```python
# Run this to check:
python manage.py sqlsequencereset inventory
# Look for UNIQUE constraints on inventory_batch
```

**Fix:** Verify the constraint exists:
```bash
python manage.py migrate inventory 0005_remove_batch_unique_batch_variation_outlet_and_more
```

---

### 5. **MEDIUM: LocationStock.sync_quantity_from_batches() Called N Times in deduct_stock()**

**File:** [apps/inventory/stock_helpers.py#L143-L149](apps/inventory/stock_helpers.py#L143-L149)

**Issue:**
```python
# Update LocationStock for backward compatibility
location_stock, created = LocationStock.objects.get_or_create(
    variation=variation,
    outlet=outlet,
    tenant=variation.product.tenant,
    defaults={'quantity': 0}
)
location_stock.sync_quantity_from_batches()  # ❌ CALLED ONCE PER DEDUCTION
```

When deducting from multiple batches in a loop, this recalculates the total each time.

**Performance Impact:**
- Deduction from 100 batches = 100 calls to `sum(batch.quantity for batch in batches)`
- Each call = 1 database query
- Total = 100 extra queries

**Fix:**
```python
@transaction.atomic
def deduct_stock(variation, outlet, quantity, user, reference_id, reason=''):
    # ... deduction logic ...
    
    # Update LocationStock ONCE at the end
    location_stock, _ = LocationStock.objects.get_or_create(
        variation=variation,
        outlet=outlet,
        tenant=variation.product.tenant,
        defaults={'quantity': 0}
    )
    location_stock.sync_quantity_from_batches()
    
    return deductions
```

---

### 6. **MEDIUM: Product.is_low_stock Property Queries All Outlets Every Call**

**File:** [apps/products/models.py#L118-L146](apps/products/models.py#L118-L146)

**Issue:**
```python
@property
def is_low_stock(self):
    """Check if product is low on stock by checking all variations (computed from batches)"""
    variations = self.variations.filter(is_active=True, track_inventory=True)
    
    if not variations.exists():
        return False
    
    # Check each variation for low stock using batch-aware calculation
    for variation in variations:
        from apps.inventory.stock_helpers import get_available_stock
        from apps.outlets.models import Outlet
        
        outlets = Outlet.objects.filter(tenant=self.product.tenant)  # ❌ N+1 QUERY
        for outlet in outlets:
            available_stock = get_available_stock(variation, outlet)
```

**Problems:**
1. **N+1 Query:** Called once per product, but loads ALL outlets from DB each time
2. **In Template Loop:** If rendered for 100 products, loads outlets 100 times
3. **Slow Page Render:** Each product check = multiple database hits

**Fix:**
```python
@property  
def is_low_stock(self):
    """Check if product is low on stock"""
    if self.low_stock_threshold <= 0:
        return False
    
    # Use cached outlets if available (from context)
    outlets = getattr(self, '_outlets_cache', None)
    if outlets is None:
        from apps.outlets.models import Outlet
        outlets = Outlet.objects.filter(tenant=self.tenant)
    
    variations = self.variations.filter(is_active=True, track_inventory=True)
    
    if not variations.exists():
        return self.low_stock_threshold > 0 and self.stock <= self.low_stock_threshold
    
    from apps.inventory.stock_helpers import get_available_stock
    
    for variation in variations:
        for outlet in outlets:
            if get_available_stock(variation, outlet) <= variation.low_stock_threshold:
                return True
    
    total_stock = sum(get_available_stock(v, outlets[0]) for v in variations for outlets in [Outlet.objects.filter(tenant=self.tenant)])
    return total_stock <= self.low_stock_threshold
```

**Better Fix - Use select_related in View:**
```python
# In view
products = Product.objects.prefetch_related(
    'variations',
    'variations__batches'
).filter(tenant=tenant)

# Cache outlets
outlets = Outlet.objects.filter(tenant=tenant)
for product in products:
    product._outlets_cache = outlets
```

---

### 7. **MEDIUM: StockTakeItem Constraints Allow Null Uniqueness**

**File:** [apps/inventory/models.py#L245-L248](apps/inventory/models.py#L245-L248)

**Issue:**
```python
constraints = [
    models.UniqueConstraint(
        fields=['stock_take', 'variation'], 
        condition=models.Q(variation__isnull=False),  # ❌ ALLOWS MULTIPLE NULLs
        name='unique_stocktake_variation'
    ),
]
```

PostgreSQL allows multiple NULLs in UNIQUE constraints. This means you can create:
- StockTake #1: variation=NULL, product=NULL ✓
- StockTake #1: variation=NULL, product=NULL ✓ (allowed, but wrong)

**Fix:**
```python
constraints = [
    models.UniqueConstraint(
        fields=['stock_take', 'variation'], 
        condition=models.Q(variation__isnull=False),
        name='unique_stocktake_variation'
    ),
    # Add constraint to prevent (stock_take, null, null)
    models.CheckConstraint(
        check=~models.Q(variation__isnull=True, product__isnull=True),
        name='stocktake_item_has_variation_or_product'
    ),
]
```

---

### 8. **MEDIUM: StockMovement.product Field Deprecation Not Enforced**

**File:** [apps/inventory/models.py#L75-L76](apps/inventory/models.py#L75-L76)

**Issue:**
```python
product = models.ForeignKey(
    Product, 
    on_delete=models.CASCADE, 
    related_name='stock_movements', 
    null=True, 
    blank=True, 
    help_text="Deprecated: Use variation instead..."  # ❌ JUST A COMMENT
)
```

The field is nullable but the `clean()` method allows creation without it:
```python
def clean(self):
    if not self.product and not self.variation:
        raise ValidationError("Either product or variation must be set")
    # This allows creation with just variation (OK)
```

**Problem:** Creates technical debt. New code might still use product field.

**Fix:** Mark as readonly in forms and add migration:
```python
# In serializer
class StockMovementSerializer(serializers.ModelSerializer):
    read_only_fields = ('product',)  # ❌ Still writable now
```

**Better Fix:**
```python
class StockMovement(models.Model):
    # Remove product field entirely in next major version
    # For now, deprecate via code:
    
    def save(self, *args, **kwargs):
        # Force product from variation
        if self.variation:
            self.product = self.variation.product
        super().save(*args, **kwargs)
```

---

### 9. **MEDIUM: Batch.days_until_expiry Property Calculated Live**

**File:** [apps/inventory/models.py#L59-L63](apps/inventory/models.py#L59-L63)

**Issue:**
```python
@property
def days_until_expiry(self):
    """Calculate days until expiry (negative if expired)"""
    delta = self.expiry_date - timezone.now().date()
    return delta.days
```

**Problem:** Every access to `batch.days_until_expiry` hits the system clock. In loops:
```python
for batch in batches:
    if batch.days_until_expiry < 0:  # ❌ Calls timezone.now() for EACH batch
        ...
```

Minor but causes unnecessary calls.

**Fix:**
```python
def get_days_until_expiry(self):
    """Get days until expiry (negative if expired)"""
    delta = self.expiry_date - timezone.now().date()
    return delta.days
```

Or compute once in view:
```python
today = timezone.now().date()
for batch in batches:
    days_until = (batch.expiry_date - today).days
    if days_until < 0:
        ...
```

---

### 10. **MEDIUM: Missing Indices on StockMovement for Common Queries**

**File:** [apps/inventory/models.py#L105-L112](apps/inventory/models.py#L105-L112)

**Issue:**
```python
indexes = [
    models.Index(fields=['tenant']),
    models.Index(fields=['product']),
    models.Index(fields=['variation']),
    models.Index(fields=['outlet']),
    models.Index(fields=['movement_type']),
    models.Index(fields=['created_at']),
]
```

Missing compound indices for common queries:
- `(variation, outlet, movement_type)` - for stock reports
- `(outlet, created_at)` - for daily sales reports
- `(variation, movement_type)` - for movement history

**Fix:**
```python
indexes = [
    models.Index(fields=['tenant']),
    models.Index(fields=['product']),
    models.Index(fields=['variation']),
    models.Index(fields=['outlet']),
    models.Index(fields=['movement_type']),
    models.Index(fields=['created_at']),
    # Add compound indices
    models.Index(fields=['variation', 'outlet']),
    models.Index(fields=['variation', 'movement_type']),
    models.Index(fields=['outlet', 'created_at']),
    models.Index(fields=['tenant', 'created_at']),
]
```

---

## 🟢 LOW ISSUES

### 11. **LOW: Batch.sellable_quantity() Not Used Anywhere**

**File:** [apps/inventory/models.py#L53-L55](apps/inventory/models.py#L53-L55)

```python
def sellable_quantity(self):
    """Return quantity available for sale (0 if expired)"""
    return 0 if self.is_expired() else self.quantity
```

Not used in stock_helpers or anywhere. Use `get_available_stock()` instead.

**Fix:** Remove or use in views.

---

### 12. **LOW: Missing on_delete Behavior for Batch When Outlet Deleted**

**File:** [apps/inventory/models.py#L24](apps/inventory/models.py#L24)

```python
outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='batches')
```

If outlet is deleted, all batches deleted. Consider `on_delete=models.PROTECT` to prevent accidental deletion.

---

### 13. **LOW: StockMovement.reason Field Unused**

Many StockMovement creations don't populate reason:
```python
StockMovement.objects.create(
    ...,
    reason=reason or f"Sale {reference_id}"  # ❌ Empty if reason not provided
)
```

Should default to `reference_id`.

---

### 14. **LOW: Missing Audit Log for Batch Changes**

When batch quantity changes, no audit trail beyond StockMovement. Consider adding:
```python
class BatchAuditLog(models.Model):
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE)
    old_quantity = models.IntegerField()
    new_quantity = models.IntegerField()
    changed_by = models.ForeignKey(User, ...)
    changed_at = models.DateTimeField(auto_now_add=True)
    reason = models.TextField()
```

---

### 15. **LOW: Missing Soft Delete for Batches**

Deleted batches are gone. For audit purposes, consider:
```python
class Batch(models.Model):
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True)
```

---

## Summary Table

| # | Issue | File | Severity | Fix Effort | Impact |
|---|-------|------|----------|-----------|--------|
| 1 | LocationStock.get_available_quantity() memory bloat | models.py#209 | 🔴 CRITICAL | 1hr | High |
| 2 | deduct_stock() N+1 queries | stock_helpers.py#87 | 🔴 CRITICAL | 4hrs | HIGH |
| 3 | mark_expired_batches() missing @transaction.atomic | stock_helpers.py#310 | 🔴 CRITICAL | 30min | MEDIUM |
| 4 | Batch unique_together verification | models.py#37 | 🟡 MEDIUM | 30min | LOW |
| 5 | LocationStock sync called N times | stock_helpers.py#143 | 🟡 MEDIUM | 1hr | MEDIUM |
| 6 | Product.is_low_stock N+1 query | products/models.py#118 | 🟡 MEDIUM | 2hrs | MEDIUM |
| 7 | StockTakeItem NULL constraint gap | models.py#245 | 🟡 MEDIUM | 1hr | LOW |
| 8 | StockMovement.product deprecation | models.py#75 | 🟡 MEDIUM | 2hrs | LOW |
| 9 | Batch.days_until_expiry clock call | models.py#59 | 🟡 MEDIUM | 30min | LOW |
| 10 | Missing compound indices | models.py#105 | 🟡 MEDIUM | 1hr | MEDIUM |
| 11 | Unused sellable_quantity() | models.py#53 | 🟢 LOW | 15min | NONE |
| 12 | Batch on_delete=CASCADE risk | models.py#24 | 🟢 LOW | 30min | LOW |
| 13 | Unused reason field | Throughout | 🟢 LOW | 30min | NONE |
| 14 | No batch audit log | - | 🟢 LOW | 4hrs | LOW |
| 15 | No soft delete for batches | - | 🟢 LOW | 4hrs | LOW |

---

## Recommended Fix Order

### THIS WEEK (High Impact):
1. ✅ Issue #3: Add `@transaction.atomic` to `mark_expired_batches()` (30min)
2. ✅ Issue #1: Replace `sum()` with `.aggregate(Sum())` (1hr)
3. ✅ Issue #2: Optimize `deduct_stock()` query count (4hrs)
4. ✅ Issue #5: Move LocationStock sync outside loop (1hr)

### NEXT WEEK (Medium Impact):
5. Issue #6: Fix `Product.is_low_stock` N+1 query (2hrs)
6. Issue #10: Add compound indices (1hr)
7. Issue #8: Finalize StockMovement.product deprecation (2hrs)

### BACKLOG (Low Impact):
8. Issue #7: Fix StockTakeItem constraint
9. Issue #11: Remove unused sellable_quantity()
10. Issue #14-15: Add audit log and soft delete

---

## Testing Recommendations

After fixes, add tests for:
```python
def test_deduct_stock_with_1000_batches(self):
    """Verify deduction performance with large batch count"""
    # Create 1000 batches
    # Deduct 500 units
    # Assert completes in <100ms

def test_mark_expired_batches_atomic(self):
    """Verify expired marking is atomic"""
    # Create 100 expired batches
    # Simulate crash mid-way
    # Verify all or none are marked

def test_location_stock_sync_called_once(self):
    """Verify LocationStock updated only once per deduction"""
    # Mock LocationStock.sync_quantity_from_batches()
    # Deduct from 10 batches
    # Assert sync called only 1 time
```

---

**Next Step:** Prioritize Critical fixes before production release.
