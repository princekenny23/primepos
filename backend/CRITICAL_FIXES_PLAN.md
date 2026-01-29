# Inventory & Products - Prioritized Fix Plan

**Status:** 🔴 3 CRITICAL issues must be fixed  
**Target:** All CRITICAL fixes deployed before production  
**Estimated Time:** 6-8 hours  

---

## CRITICAL PATH (FIX TODAY)

### Fix #1: mark_expired_batches() Missing @transaction.atomic (30 min)

**Severity:** 🔴 CRITICAL  
**Impact:** Race condition, incomplete expiry marking, duplicate movements  
**Effort:** 30 minutes

**Changes:**
1. Add `@transaction.atomic` decorator to function
2. Test with concurrent calls
3. Verify test passes

**File:** `apps/inventory/stock_helpers.py`

**Before:**
```python
def mark_expired_batches(variation=None, outlet=None):
    today = timezone.now().date()
    # ...
```

**After:**
```python
@transaction.atomic
def mark_expired_batches(variation=None, outlet=None):
    today = timezone.now().date()
    # ...
```

**Testing:**
```python
def test_mark_expired_batches_atomic(self):
    """Verify expired marking is atomic and can't be interrupted"""
    # Test passes without error
    mark_expired_batches()
```

---

### Fix #2: LocationStock.get_available_quantity() Memory Optimization (1 hour)

**Severity:** 🔴 CRITICAL  
**Impact:** Memory bloat, performance degradation at scale  
**Effort:** 1 hour

**File:** `apps/inventory/models.py`

**Changes:**
1. Replace Python `sum()` with database `.aggregate(Sum())`
2. Remove unused `get_total_quantity_including_expired()`
3. Update dependent code
4. Test with 1000+ batches

**Before:**
```python
def get_available_quantity(self):
    today = timezone.now().date()
    batches = Batch.objects.filter(
        variation=self.variation,
        outlet=self.outlet,
        expiry_date__gt=today,
        quantity__gt=0
    )
    return sum(batch.quantity for batch in batches)  # ❌ Memory issue
```

**After:**
```python
def get_available_quantity(self):
    from django.db.models import Sum
    today = timezone.now().date()
    result = Batch.objects.filter(
        variation=self.variation,
        outlet=self.outlet,
        expiry_date__gt=today,
        quantity__gt=0
    ).aggregate(total=Sum('quantity'))
    return result['total'] or 0  # ✅ O(1) database aggregation
```

**Testing:**
```python
def test_get_available_quantity_1000_batches(self):
    """Performance test with 1000 batches"""
    # Create 1000 batches
    start = time.time()
    qty = location_stock.get_available_quantity()
    elapsed = time.time() - start
    self.assertLess(elapsed, 0.05)  # Should be <50ms
    self.assertEqual(qty, sum_of_all_quantities)
```

---

### Fix #3: deduct_stock() Query Optimization (4-6 hours)

**Severity:** 🔴 CRITICAL  
**Impact:** N+1 queries (100 batches = 101 queries), slow sales  
**Effort:** 4-6 hours (refactoring + testing)

**File:** `apps/inventory/stock_helpers.py`

**Current Problem:**
```python
for batch in batches:  # Fetches all
    batch.quantity -= deduct_qty
    batch.save()  # ❌ 1 query per batch
```

**Solution: Batch Updates Inside Transaction**

```python
@transaction.atomic
def deduct_stock(variation, outlet, quantity, user, reference_id, reason=''):
    """
    Deduct stock from batches using FIFO expiry logic
    Optimized for bulk operations
    """
    today = timezone.now().date()
    remaining = quantity
    deductions = []
    
    # Get and lock all applicable batches
    batches = list(Batch.objects.select_for_update().filter(
        variation=variation,
        outlet=outlet,
        expiry_date__gt=today,
        quantity__gt=0
    ).order_by('expiry_date', 'created_at'))
    
    # Calculate total available
    total_available = sum(b.quantity for b in batches)
    if total_available < quantity:
        raise ValueError(
            f"Insufficient stock for {variation.product.name} - {variation.name}. "
            f"Available: {total_available}, Requested: {quantity}"
        )
    
    # Process each batch and deduct
    batch_updates = []  # Collect updates
    for batch in batches:
        if remaining <= 0:
            break
        
        deduct_qty = min(batch.quantity, remaining)
        batch.quantity -= deduct_qty
        batch_updates.append(batch)
        
        deductions.append((batch, deduct_qty))
        remaining -= deduct_qty
    
    # Bulk save (still O(N) but cleaner and safer)
    for batch in batch_updates:
        batch.save(update_fields=['quantity', 'updated_at'])
        
        # Create movement immediately after
        StockMovement.objects.create(
            tenant=variation.product.tenant,
            batch=batch,
            variation=variation,
            product=variation.product,
            outlet=outlet,
            user=user,
            movement_type='sale',
            quantity=batch.quantity + (batch.quantity - batch.quantity),  # Track deducted
            reference_id=reference_id,
            reason=reason or f"Sale {reference_id}"
        )
    
    # Update LocationStock once at the end
    location_stock, _ = LocationStock.objects.get_or_create(
        variation=variation,
        outlet=outlet,
        tenant=variation.product.tenant,
        defaults={'quantity': 0}
    )
    location_stock.sync_quantity_from_batches()
    
    logger.info(
        f"Deducted {quantity} from {len(deductions)} batch(es) "
        f"({variation.product.name} - {variation.name}) at {outlet.name}"
    )
    
    return deductions
```

**Testing:**
```python
def test_deduct_stock_performance_100_batches(self):
    """Test deduction doesn't exceed 100ms with 100 batches"""
    # Create 100 batches
    for i in range(100):
        Batch.objects.create(
            variation=variation,
            outlet=outlet,
            batch_number=f"BATCH-{i:03d}",
            expiry_date=today + timedelta(days=30+i),
            quantity=10,
            tenant=tenant
        )
    
    start = time.time()
    deduct_stock(
        variation=variation,
        outlet=outlet,
        quantity=50,
        user=user,
        reference_id="PERF-TEST",
        reason="Performance test"
    )
    elapsed = time.time() - start
    
    self.assertLess(elapsed, 0.1, f"Deduction took {elapsed}s, should be <0.1s")

def test_deduct_stock_correct_order_with_100_batches(self):
    """Verify FIFO order is maintained with many batches"""
    # Create 100 batches with different expiry dates
    batches = []
    for i in range(100):
        batch = Batch.objects.create(
            variation=variation,
            outlet=outlet,
            batch_number=f"BATCH-{i:03d}",
            expiry_date=today + timedelta(days=i),  # Different expiry each
            quantity=5,
            tenant=tenant
        )
        batches.append(batch)
    
    # Deduct 50 units
    deductions = deduct_stock(
        variation=variation,
        outlet=outlet,
        quantity=50,
        user=user,
        reference_id="FIFO-TEST-100",
        reason="Test"
    )
    
    # Verify FIFO order (first 10 batches deducted)
    deducted_batch_numbers = [d[0].batch_number for d in deductions]
    expected = [f"BATCH-{i:03d}" for i in range(10)]
    self.assertEqual(deducted_batch_numbers, expected)
```

**Migration Strategy:**
1. Create new function `deduct_stock_optimized()`
2. Test thoroughly
3. Run both side-by-side on staging
4. Switch over
5. Keep old function for rollback

---

## Medium Priority Fixes

### Fix #4: LocationStock sync_quantity_from_batches Called N Times (1 hour)

**File:** `apps/inventory/stock_helpers.py`

**Problem:** Called once per batch deducted, but only needs once at end

**Solution:** Move outside loop (already described above in Fix #3)

---

### Fix #5: Product.is_low_stock N+1 Query (2 hours)

**File:** `apps/products/models.py`

**Problem:** Loads all outlets for each product check

**Solution:**
```python
@property
def is_low_stock(self):
    """Check if product is low on stock"""
    if self.low_stock_threshold <= 0:
        return False
    
    # Quick check: use cached outlets if available
    if hasattr(self, '_cached_outlets'):
        outlets = self._cached_outlets
    else:
        from apps.outlets.models import Outlet
        outlets = Outlet.objects.filter(tenant=self.tenant)
    
    variations = self.variations.filter(is_active=True, track_inventory=True)
    
    if not variations.exists():
        # Fallback to legacy
        return self.stock <= self.low_stock_threshold
    
    from apps.inventory.stock_helpers import get_available_stock
    
    for variation in variations:
        for outlet in outlets:
            if get_available_stock(variation, outlet) <= variation.low_stock_threshold:
                return True
    
    return False
```

In views:
```python
# Cache outlets
outlets = Outlet.objects.filter(tenant=request.user.tenant)
products = Product.objects.prefetch_related('variations')

for product in products:
    product._cached_outlets = outlets  # Set cache
    print(product.is_low_stock)  # Uses cache
```

---

## Deployment Plan

### Phase 1: Deploy CRITICAL fixes (Today)
1. ✅ Fix #1: Add @transaction.atomic (15 min)
2. ✅ Fix #2: Replace sum() with aggregate() (30 min)
3. ✅ Fix #3: Optimize deduct_stock() (3-4 hours)
4. ✅ Run full test suite
5. ✅ Deploy to staging
6. ✅ Performance test

### Phase 2: Deploy MEDIUM fixes (This week)
1. Fix #4: Move LocationStock sync
2. Fix #5: Fix N+1 query
3. Fix #10: Add indices

### Phase 3: Cleanup (Next week)
1. Fix #8: Deprecate StockMovement.product
2. Fix #7: StockTakeItem constraints
3. Fix #11-15: Cleanup

---

## Testing Checklist

Before each deployment, run:

```bash
# Unit tests
python manage.py test apps.inventory apps.products --verbosity=2

# Specific critical tests
python manage.py test apps.inventory.tests.test_stock_helpers \
  apps.sales.tests.test_sale_stock_integration \
  --verbosity=2

# Performance tests
python manage.py test apps.inventory.tests.test_performance_integration \
  -k "performance" --verbosity=2

# Concurrent access tests
python manage.py test apps.inventory.tests.test_stock_helpers \
  -k "concurrent" --verbosity=2
```

---

## Rollback Plan

If issues arise post-deployment:

```bash
# Restore previous stock_helpers.py from git
git checkout HEAD~1 -- apps/inventory/stock_helpers.py

# Restart all services
systemctl restart primepos-backend
```

Keep Feature flag ready:
```python
# In stock_helpers.py
USE_OPTIMIZED_DEDUCTION = os.environ.get('USE_OPTIMIZED_DEDUCTION', 'false').lower() == 'true'

def deduct_stock(...):
    if USE_OPTIMIZED_DEDUCTION:
        return deduct_stock_optimized(...)
    else:
        return deduct_stock_legacy(...)
```

---

## Sign-off Criteria

✅ Fix is complete when:
- [ ] All new tests passing
- [ ] All existing tests passing
- [ ] No performance regression
- [ ] Code review approved
- [ ] Documented in changelog
- [ ] Deployed to staging
- [ ] Staging tested 2+ hours
- [ ] Ready for production

