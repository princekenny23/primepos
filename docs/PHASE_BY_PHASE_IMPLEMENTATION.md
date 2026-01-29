# Inventory System - Phase by Phase Implementation Plan

**Project**: PrimePOS Inventory Modernization  
**Start Date**: January 26, 2026  
**Target Completion**: February 28, 2026 (5 weeks)  
**Status**: Ready to Begin  
**Priority**: CRITICAL

---

## Executive Summary

This document provides a detailed phase-by-phase execution plan for modernizing the PrimePOS inventory system. Each phase builds upon the previous, ensuring a stable foundation before adding complexity.

**Goals:**
1. Fix current inventory inconsistencies
2. Implement perpetual inventory tracking (real-time, batch-based)
3. Make product images optional
4. Ensure data integrity through immutable audit trail
5. Enable accurate physical inventory counts

**Success Criteria:**
- 99.5%+ stock accuracy
- <100ms stock deduction time
- Zero expired products sold
- 100% audit trail coverage

---

## Phase 1: Foundation & Cleanup (Week 1)

### Overview
Establish the technical foundation for perpetual inventory. Fix immediate issues, implement core utilities, and ensure the system can handle FIFO deduction atomically.

### Phase Objectives
- ✅ Verify all database models are in place
- ✅ Make product images truly optional
- ✅ Implement FIFO batch selection logic
- ✅ Create atomic stock deduction function
- ✅ Establish testing framework

### Timeline
**Duration**: 5 days  
**Team Size**: 2 developers  
**Effort**: 80 hours

---

### Day 1-2: Setup & Verification

#### Tasks
1. **Environment Setup**
   ```bash
   # Ensure development environment is ready
   cd backend
   source env/bin/activate  # or env\Scripts\activate on Windows
   python manage.py showmigrations inventory
   python manage.py showmigrations products
   ```

2. **Code Review Session**
   - Review [INVENTORY_IMPLEMENTATION_GUIDE.md](INVENTORY_IMPLEMENTATION_GUIDE.md)
   - Review current `inventory/models.py`
   - Review current `products/models.py`
   - Identify all stock deduction points in codebase

3. **Database Model Verification**
   - Confirm `Batch` model structure
   - Confirm `StockMovement` model structure
   - Confirm `LocationStock` model structure
   - Confirm `StockTake` + `StockTakeItem` models
   - Run any pending migrations

4. **Product Image Testing**
   ```bash
   # Test API endpoints
   POST /api/v1/products/ 
   {
     "name": "Test Product",
     "sku": "TEST-001",
     "retail_price": 10.00
     # NO image field
   }
   ```
   - Verify 201 Created response
   - Verify image field returns null
   - Test product update without image
   - Test product list view displays correctly

#### Deliverables
- ✅ Migration status report
- ✅ API test results (products without images)
- ✅ List of all stock deduction code locations
- ✅ Development environment ready

#### Acceptance Criteria
- [ ] All migrations applied successfully
- [ ] Products can be created without images
- [ ] No API errors related to missing images
- [ ] All developers have working environment

---

### Day 3-4: FIFO Implementation

#### Tasks

1. **Create `stock_helpers.py`**
   
   Location: `backend/apps/inventory/stock_helpers.py`

   ```python
   """
   Inventory stock helper functions
   Centralized logic for FIFO deduction, batch management
   """
   from django.utils import timezone
   from django.db import transaction
   from apps.inventory.models import Batch, StockMovement
   
   
   class InsufficientStockError(Exception):
       """Raised when trying to deduct more stock than available"""
       pass
   
   
   def get_fifo_batches(variation, outlet):
       """
       Get batches for a variation at an outlet, ordered FIFO
       (oldest expiry date first, non-expired only)
       
       Args:
           variation: ItemVariation instance
           outlet: Outlet instance
           
       Returns:
           QuerySet of Batch objects ordered for FIFO deduction
       """
       today = timezone.now().date()
       
       return Batch.objects.filter(
           variation=variation,
           outlet=outlet,
           expiry_date__gt=today,  # Not expired
           quantity__gt=0          # Has stock
       ).select_related(
           'variation',
           'variation__product',
           'outlet'
       ).order_by('expiry_date', 'created_at')
   
   
   @transaction.atomic
   def deduct_stock(variation, quantity, outlet, movement_type, reason="", 
                   reference_id=None, user=None):
       """
       Deduct stock atomically from batches using FIFO
       
       Args:
           variation: ItemVariation instance to deduct from
           quantity: int - amount to deduct
           outlet: Outlet instance
           movement_type: str - type of movement (sale, damage, etc.)
           reason: str - reason for deduction
           reference_id: str - reference to source transaction (sale ID, etc.)
           user: User instance who initiated the deduction
           
       Returns:
           list of dicts: [{"batch": batch_number, "quantity": qty, "expiry": date}]
           
       Raises:
           InsufficientStockError: If not enough stock available
       """
       if quantity <= 0:
           raise ValueError("Quantity must be positive")
       
       remaining = quantity
       deductions = []
       
       # Get batches in FIFO order
       batches = get_fifo_batches(variation, outlet)
       
       # Deduct from each batch until satisfied
       for batch in batches:
           if remaining <= 0:
               break
           
           # Determine how much to deduct from this batch
           amount_to_deduct = min(remaining, batch.quantity)
           
           # Update batch quantity
           batch.quantity -= amount_to_deduct
           batch.save(update_fields=['quantity', 'updated_at'])
           
           # Create immutable movement record
           StockMovement.objects.create(
               tenant=variation.tenant,
               batch=batch,
               variation=variation,
               product=variation.product,  # Backward compat
               outlet=outlet,
               user=user,
               movement_type=movement_type,
               quantity=amount_to_deduct,
               reason=reason,
               reference_id=reference_id or ""
           )
           
           # Track what was deducted
           deductions.append({
               'batch': batch.batch_number,
               'quantity': amount_to_deduct,
               'expiry': batch.expiry_date,
               'cost': float(batch.cost_price) if batch.cost_price else None
           })
           
           remaining -= amount_to_deduct
       
       # Check if we satisfied the full quantity
       if remaining > 0:
           raise InsufficientStockError(
               f"Insufficient stock for {variation.product.name} - "
               f"{variation.name}. Needed {quantity}, only "
               f"{quantity - remaining} available at {outlet.name}"
           )
       
       return deductions
   
   
   def get_available_stock(variation, outlet):
       """
       Get total available (non-expired) stock for a variation at outlet
       
       Args:
           variation: ItemVariation instance
           outlet: Outlet instance
           
       Returns:
           int: Total available quantity
       """
       batches = get_fifo_batches(variation, outlet)
       return sum(batch.quantity for batch in batches)
   ```

2. **Write Unit Tests**
   
   Location: `backend/apps/inventory/tests/test_stock_helpers.py`

   ```python
   from django.test import TestCase
   from django.utils import timezone
   from datetime import timedelta
   from apps.inventory.models import Batch
   from apps.inventory.stock_helpers import (
       get_fifo_batches, 
       deduct_stock, 
       InsufficientStockError,
       get_available_stock
   )
   from apps.products.models import Product, ItemVariation
   from apps.outlets.models import Outlet
   from apps.tenants.models import Tenant
   from apps.accounts.models import User
   
   
   class FIFOLogicTestCase(TestCase):
       def setUp(self):
           """Create test data"""
           self.tenant = Tenant.objects.create(name="Test Tenant")
           self.outlet = Outlet.objects.create(
               tenant=self.tenant,
               name="Test Outlet"
           )
           self.user = User.objects.create_user(
               username="testuser",
               tenant=self.tenant
           )
           
           self.product = Product.objects.create(
               tenant=self.tenant,
               outlet=self.outlet,
               name="Test Product",
               retail_price=10.00
           )
           
           self.variation = ItemVariation.objects.create(
               product=self.product,
               name="Default",
               price=10.00
           )
           
           # Create batches with different expiry dates
           today = timezone.now().date()
           
           self.batch1 = Batch.objects.create(
               tenant=self.tenant,
               variation=self.variation,
               outlet=self.outlet,
               batch_number="BATCH-001",
               expiry_date=today + timedelta(days=10),
               quantity=20,
               cost_price=5.00
           )
           
           self.batch2 = Batch.objects.create(
               tenant=self.tenant,
               variation=self.variation,
               outlet=self.outlet,
               batch_number="BATCH-002",
               expiry_date=today + timedelta(days=30),
               quantity=30,
               cost_price=5.50
           )
           
           self.batch3 = Batch.objects.create(
               tenant=self.tenant,
               variation=self.variation,
               outlet=self.outlet,
               batch_number="BATCH-003",
               expiry_date=today - timedelta(days=5),  # Expired
               quantity=15,
               cost_price=4.50
           )
       
       def test_get_fifo_batches_excludes_expired(self):
           """FIFO query should exclude expired batches"""
           batches = get_fifo_batches(self.variation, self.outlet)
           
           self.assertEqual(batches.count(), 2)
           self.assertNotIn(self.batch3, batches)
       
       def test_get_fifo_batches_orders_by_expiry(self):
           """FIFO query should order by expiry date (oldest first)"""
           batches = list(get_fifo_batches(self.variation, self.outlet))
           
           self.assertEqual(batches[0].batch_number, "BATCH-001")
           self.assertEqual(batches[1].batch_number, "BATCH-002")
       
       def test_deduct_stock_single_batch(self):
           """Deduct quantity from single batch"""
           deductions = deduct_stock(
               variation=self.variation,
               quantity=10,
               outlet=self.outlet,
               movement_type='sale',
               reason="Test sale",
               user=self.user
           )
           
           self.assertEqual(len(deductions), 1)
           self.assertEqual(deductions[0]['batch'], "BATCH-001")
           self.assertEqual(deductions[0]['quantity'], 10)
           
           # Check batch quantity updated
           self.batch1.refresh_from_db()
           self.assertEqual(self.batch1.quantity, 10)
       
       def test_deduct_stock_multiple_batches(self):
           """Deduct quantity spanning multiple batches"""
           deductions = deduct_stock(
               variation=self.variation,
               quantity=35,  # More than batch1
               outlet=self.outlet,
               movement_type='sale',
               reason="Large order",
               user=self.user
           )
           
           self.assertEqual(len(deductions), 2)
           
           # Should take all 20 from batch1, then 15 from batch2
           self.assertEqual(deductions[0]['quantity'], 20)
           self.assertEqual(deductions[1]['quantity'], 15)
           
           self.batch1.refresh_from_db()
           self.batch2.refresh_from_db()
           
           self.assertEqual(self.batch1.quantity, 0)
           self.assertEqual(self.batch2.quantity, 15)
       
       def test_deduct_stock_insufficient(self):
           """Should raise error when insufficient stock"""
           with self.assertRaises(InsufficientStockError):
               deduct_stock(
                   variation=self.variation,
                   quantity=100,  # More than available (20+30)
                   outlet=self.outlet,
                   movement_type='sale',
                   reason="Too much",
                   user=self.user
               )
       
       def test_get_available_stock(self):
           """Should return correct available quantity"""
           available = get_available_stock(self.variation, self.outlet)
           
           # Should be 20 + 30, excluding expired batch
           self.assertEqual(available, 50)
   ```

3. **Run Tests**
   ```bash
   python manage.py test apps.inventory.tests.test_stock_helpers
   ```

#### Deliverables
- ✅ `stock_helpers.py` with FIFO functions
- ✅ Unit tests with >90% coverage
- ✅ Test results (all passing)
- ✅ Code review completed

#### Acceptance Criteria
- [ ] `get_fifo_batches()` excludes expired batches
- [ ] `get_fifo_batches()` orders by expiry date ASC
- [ ] `deduct_stock()` uses FIFO logic
- [ ] `deduct_stock()` creates StockMovement records
- [ ] `deduct_stock()` raises error on insufficient stock
- [ ] All unit tests passing

---

### Day 5: Integration Testing & Documentation

#### Tasks

1. **Integration Tests**
   - Test FIFO with 5+ batches
   - Test concurrent deductions (threading)
   - Test transaction rollback on error
   - Test with real product/variation data

2. **Performance Testing**
   ```python
   # Test deduction speed
   import time
   start = time.time()
   deduct_stock(variation, 100, outlet, 'sale', 'perf test')
   elapsed = time.time() - start
   assert elapsed < 0.1  # Must be under 100ms
   ```

3. **Documentation**
   - Add docstrings to all functions
   - Document error cases
   - Create usage examples
   - Update team wiki

#### Deliverables
- ✅ Integration test suite
- ✅ Performance benchmarks
- ✅ Code documentation complete
- ✅ Phase 1 retrospective document

#### Acceptance Criteria
- [ ] FIFO logic verified with complex scenarios
- [ ] Deduction speed <100ms
- [ ] Transaction atomicity verified
- [ ] Team understands new functions

---

### Phase 1 Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Expired batch not excluded | HIGH | LOW | Unit tests verify exclusion |
| Race condition on concurrent deduction | HIGH | MEDIUM | Use `@transaction.atomic` + DB locks |
| Performance degradation | MEDIUM | LOW | Add indexes, benchmark early |
| Insufficient test coverage | MEDIUM | MEDIUM | Mandate 90%+ coverage |

---

## Phase 2: Stock Deduction Integration (Week 2)

### Overview
Replace all existing stock deduction logic with the new atomic FIFO system. Ensure every inventory change creates an immutable audit trail.

### Phase Objectives
- ✅ Replace sales stock deduction with `deduct_stock()`
- ✅ Replace adjustment logic with atomic functions
- ✅ Implement stock reconciliation
- ✅ Optimize database queries
- ✅ Ensure 100% audit trail coverage

### Timeline
**Duration**: 5 days  
**Team Size**: 2 developers  
**Effort**: 80 hours

---

### Day 1-2: Sales Integration

#### Tasks

1. **Audit Current Sales Flow**
   ```bash
   # Find all stock deduction points
   cd backend
   grep -r "\.stock.*-=" apps/sales/
   grep -r "quantity.*-=" apps/sales/
   grep -r "deduct" apps/sales/
   ```

2. **Update Sale Creation**
   
   Location: `backend/apps/sales/views.py` or `serializers.py`

   ```python
   from apps.inventory.stock_helpers import deduct_stock, InsufficientStockError
   
   @transaction.atomic
   def create_sale(self, validated_data):
       """Create sale with atomic stock deduction"""
       items_data = validated_data.pop('items')
       sale = Sale.objects.create(**validated_data)
       
       try:
           for item_data in items_data:
               variation = item_data['variation']
               quantity = item_data['quantity']
               outlet = sale.outlet
               
               # Deduct stock using FIFO
               deductions = deduct_stock(
                   variation=variation,
                   quantity=quantity,
                   outlet=outlet,
                   movement_type='sale',
                   reason=f"Sale #{sale.id}",
                   reference_id=str(sale.id),
                   user=sale.user
               )
               
               # Create sale item
               SaleItem.objects.create(
                   sale=sale,
                   variation=variation,
                   quantity=quantity,
                   price=item_data['price'],
                   deductions_info=deductions  # Store FIFO info
               )
               
       except InsufficientStockError as e:
           # Transaction will rollback automatically
           raise ValidationError({"items": str(e)})
       
       return sale
   ```

3. **Update Sale Deletion/Void**
   ```python
   def void_sale(sale):
       """Return stock when voiding sale"""
       for item in sale.items.all():
           # Return stock to original batches (if possible)
           # Or create new batch with return movement
           pass
   ```

4. **Test Sales Integration**
   - Create sale with sufficient stock → Success
   - Create sale with insufficient stock → Error (no sale created)
   - Void sale → Stock returned
   - Verify StockMovement records created

#### Deliverables
- ✅ Sales integration complete
- ✅ Sale void/return logic updated
- ✅ Integration tests passing
- ✅ Stock deduction atomic with sale

#### Acceptance Criteria
- [ ] All sales deduct stock via `deduct_stock()`
- [ ] Sale creation + stock deduction is atomic
- [ ] Insufficient stock prevents sale creation
- [ ] StockMovement created for every sale item
- [ ] Sale void returns stock correctly

---

### Day 3: Adjustment & Other Movements

#### Tasks

1. **Inventory Adjustment Endpoint**
   
   Location: `backend/apps/inventory/views.py`

   ```python
   class InventoryAdjustmentViewSet(viewsets.ViewSet):
       """Manual inventory adjustments"""
       
       @transaction.atomic
       def create(self, request):
           """Create adjustment (positive or negative)"""
           variation_id = request.data['variation_id']
           outlet_id = request.data['outlet_id']
           quantity = request.data['quantity']  # Can be negative
           reason = request.data['reason']
           
           variation = ItemVariation.objects.get(id=variation_id)
           outlet = Outlet.objects.get(id=outlet_id)
           
           if quantity > 0:
               # Positive adjustment - add stock
               batch = Batch.objects.create(
                   tenant=request.tenant,
                   variation=variation,
                   outlet=outlet,
                   batch_number=f"ADJ-{timezone.now().strftime('%Y%m%d-%H%M%S')}",
                   expiry_date=timezone.now().date() + timedelta(days=365),
                   quantity=quantity,
                   cost_price=variation.cost or 0
               )
               
               StockMovement.objects.create(
                   tenant=request.tenant,
                   batch=batch,
                   variation=variation,
                   product=variation.product,
                   outlet=outlet,
                   user=request.user,
                   movement_type='adjustment',
                   quantity=quantity,
                   reason=reason
               )
           else:
               # Negative adjustment - deduct stock
               deduct_stock(
                   variation=variation,
                   quantity=abs(quantity),
                   outlet=outlet,
                   movement_type='adjustment',
                   reason=reason,
                   user=request.user
               )
           
           return Response({"detail": "Adjustment created"})
   ```

2. **Damage/Spoilage Handler**
   ```python
   def record_damage(variation, quantity, outlet, reason, user):
       """Record damaged/spoiled stock"""
       return deduct_stock(
           variation=variation,
           quantity=quantity,
           outlet=outlet,
           movement_type='damage',
           reason=reason,
           user=user
       )
   ```

3. **Test All Movement Types**
   - Manual adjustment (positive)
   - Manual adjustment (negative)
   - Damage/spoilage
   - Expiry handling
   - Transfer between outlets

#### Deliverables
- ✅ Adjustment endpoint working
- ✅ Damage/spoilage tracking
- ✅ All movement types tested
- ✅ Audit trail complete

#### Acceptance Criteria
- [ ] Positive adjustments create batch + movement
- [ ] Negative adjustments use `deduct_stock()`
- [ ] All adjustments require reason
- [ ] Damage movements tracked separately
- [ ] Every stock change has StockMovement

---

### Day 4: Stock Reconciliation

#### Tasks

1. **Create Reconciliation Utility**
   
   Location: `backend/apps/inventory/reconciliation.py`

   ```python
   def reconcile_stock(variation, outlet):
       """
       Compare Batch sum vs LocationStock for a variation/outlet
       
       Returns:
           dict: {
               'system_quantity': int,
               'batch_quantity': int,
               'variance': int,
               'variance_percent': float
           }
       """
       from django.db.models import Sum
       
       # Get sum of all batches
       batch_total = Batch.objects.filter(
           variation=variation,
           outlet=outlet
       ).aggregate(total=Sum('quantity'))['total'] or 0
       
       # Get LocationStock quantity
       try:
           location_stock = LocationStock.objects.get(
               variation=variation,
               outlet=outlet
           )
           system_quantity = location_stock.quantity
       except LocationStock.DoesNotExist:
           system_quantity = 0
       
       variance = batch_total - system_quantity
       variance_percent = (variance / system_quantity * 100) if system_quantity > 0 else 0
       
       return {
           'variation': variation,
           'outlet': outlet,
           'system_quantity': system_quantity,
           'batch_quantity': batch_total,
           'variance': variance,
           'variance_percent': round(variance_percent, 2)
       }
   
   
   def reconcile_all_stock(outlet=None):
       """Reconcile all variations at an outlet or all outlets"""
       from apps.products.models import ItemVariation
       
       variations = ItemVariation.objects.filter(track_inventory=True)
       if outlet:
           # Filter to variations with stock at this outlet
           variations = variations.filter(
               location_stocks__outlet=outlet
           ).distinct()
       
       results = []
       for variation in variations:
           outlets_to_check = [outlet] if outlet else variation.location_stocks.values_list('outlet', flat=True)
           
           for outlet_id in outlets_to_check:
               outlet_obj = Outlet.objects.get(id=outlet_id)
               result = reconcile_stock(variation, outlet_obj)
               
               if result['variance'] != 0:
                   results.append(result)
       
       return results
   ```

2. **Create Reconciliation API**
   ```python
   @api_view(['GET'])
   def reconciliation_report(request):
       """Get stock reconciliation report"""
       outlet_id = request.query_params.get('outlet_id')
       outlet = Outlet.objects.get(id=outlet_id) if outlet_id else None
       
       variances = reconcile_all_stock(outlet)
       
       return Response({
           'total_variations_checked': len(variances),
           'variances_found': sum(1 for v in variances if v['variance'] != 0),
           'variances': variances
       })
   ```

3. **Create Management Command**
   ```bash
   python manage.py reconcile_inventory --outlet=1
   ```

#### Deliverables
- ✅ Reconciliation utility functions
- ✅ API endpoint for reports
- ✅ Management command
- ✅ Daily scheduled job setup

#### Acceptance Criteria
- [ ] Reconciliation compares Batch vs LocationStock
- [ ] Variances >5% flagged
- [ ] API returns variance report
- [ ] Daily automated check scheduled
- [ ] Email alerts for high variances

---

### Day 5: Performance & Testing

#### Tasks

1. **Add Database Indexes**
   ```python
   # In apps/inventory/models.py
   class Batch(models.Model):
       class Meta:
           indexes = [
               models.Index(fields=['tenant']),
               models.Index(fields=['variation', 'outlet']),
               models.Index(fields=['expiry_date']),
               models.Index(fields=['variation', 'outlet', 'expiry_date']),
               models.Index(fields=['quantity']),  # For stock queries
           ]
   ```

2. **Query Optimization**
   - Use `select_related()` for batch queries
   - Use `prefetch_related()` for variation lists
   - Minimize N+1 queries

3. **Performance Testing**
   ```python
   # Test query count
   from django.test.utils import override_settings
   from django.db import connection
   
   with self.assertNumQueries(5):  # Max 5 queries
       deduct_stock(variation, 10, outlet, 'sale', 'test')
   ```

4. **Integration Testing**
   - Test complete sale flow (100 items)
   - Test concurrent sales (10 simultaneous)
   - Test bulk adjustments
   - Test reconciliation with 1000+ variations

#### Deliverables
- ✅ Database indexes created
- ✅ Query optimization complete
- ✅ Performance benchmarks met
- ✅ Integration tests passing

#### Acceptance Criteria
- [ ] Stock deduction <100ms
- [ ] Query count <5 per deduction
- [ ] Concurrent operations work correctly
- [ ] No race conditions detected
- [ ] Phase 2 complete

---

## Phase 3: Physical Inventory Counts (Week 3)

### Overview
Implement physical inventory counting system to validate system accuracy and handle variances.

### Phase Objectives
- ✅ Build StockTake API
- ✅ Implement variance calculation
- ✅ Create reconciliation workflow
- ✅ Enable variance reason tracking
- ✅ Automate adjustment creation

### Timeline
**Duration**: 5 days  
**Team Size**: 2 developers  
**Effort**: 80 hours

---

### Day 1-2: StockTake API

#### Tasks

1. **Create Serializers**
   
   Location: `backend/apps/inventory/serializers.py`

   ```python
   class StockTakeItemSerializer(serializers.ModelSerializer):
       variation_name = serializers.CharField(source='variation.name', read_only=True)
       product_name = serializers.CharField(source='variation.product.name', read_only=True)
       system_quantity = serializers.SerializerMethodField()
       
       class Meta:
           model = StockTakeItem
           fields = [
               'id', 'variation', 'variation_name', 'product_name',
               'expected_quantity', 'counted_quantity', 'system_quantity',
               'difference', 'variance_reason', 'notes'
           ]
           read_only_fields = ['difference', 'expected_quantity']
       
       def get_system_quantity(self, obj):
           """Get current system quantity from batches"""
           from apps.inventory.stock_helpers import get_available_stock
           stock_take = obj.stock_take
           return get_available_stock(obj.variation, stock_take.outlet)
   
   
   class StockTakeSerializer(serializers.ModelSerializer):
       items = StockTakeItemSerializer(many=True, read_only=True)
       variance_summary = serializers.SerializerMethodField()
       
       class Meta:
           model = StockTake
           fields = [
               'id', 'tenant', 'outlet', 'user', 'operating_date',
               'status', 'description', 'items', 'variance_summary',
               'created_at', 'completed_at'
           ]
           read_only_fields = ['tenant', 'user', 'created_at']
       
       def get_variance_summary(self, obj):
           """Calculate total variance"""
           items = obj.items.all()
           return {
               'total_items': items.count(),
               'items_with_variance': items.exclude(difference=0).count(),
               'positive_variance': sum(i.difference for i in items if i.difference > 0),
               'negative_variance': sum(i.difference for i in items if i.difference < 0),
           }
   ```

2. **Create ViewSet**
   ```python
   class StockTakeViewSet(viewsets.ModelViewSet):
       serializer_class = StockTakeSerializer
       permission_classes = [IsAuthenticated]
       
       def get_queryset(self):
           return StockTake.objects.filter(
               tenant=self.request.tenant
           ).prefetch_related('items', 'items__variation')
       
       def perform_create(self, serializer):
           serializer.save(
               tenant=self.request.tenant,
               user=self.request.user
           )
   ```

3. **Bulk Item Entry**
   ```python
   @action(detail=True, methods=['post'])
   def add_items_bulk(self, request, pk=None):
       """Add multiple items to stock take at once"""
       stock_take = self.get_object()
       items_data = request.data.get('items', [])
       
       created_items = []
       for item_data in items_data:
           variation_id = item_data['variation_id']
           counted = item_data['counted_quantity']
           
           variation = ItemVariation.objects.get(id=variation_id)
           system_qty = get_available_stock(variation, stock_take.outlet)
           
           item = StockTakeItem.objects.create(
               stock_take=stock_take,
               variation=variation,
               expected_quantity=system_qty,
               counted_quantity=counted
           )
           created_items.append(item)
       
       serializer = StockTakeItemSerializer(created_items, many=True)
       return Response(serializer.data)
   ```

#### Deliverables
- ✅ Serializers complete
- ✅ ViewSet with CRUD operations
- ✅ Bulk entry endpoint
- ✅ API tests passing

#### Acceptance Criteria
- [ ] Can create stock take session
- [ ] Can add items individually
- [ ] Can add items in bulk
- [ ] System quantity auto-calculated
- [ ] Variance auto-calculated
- [ ] Status workflow enforced

---

### Day 3-4: Reconciliation Workflow

#### Tasks

1. **Reconciliation Endpoint**
   ```python
   @action(detail=True, methods=['post'])
   @transaction.atomic
   def reconcile(self, request, pk=None):
       """Apply variance adjustments from stock take"""
       stock_take = self.get_object()
       
       if stock_take.status != 'completed':
           return Response(
               {"error": "Stock take must be completed before reconciliation"},
               status=400
           )
       
       adjustments_made = 0
       
       for item in stock_take.items.filter(difference__ne=0):
           variation = item.variation
           variance = item.difference
           reason = f"Stock take variance: {item.variance_reason or 'Physical count'}"
           
           if variance > 0:
               # Overage - add stock
               batch = Batch.objects.create(
                   tenant=stock_take.tenant,
                   variation=variation,
                   outlet=stock_take.outlet,
                   batch_number=f"RECON-{stock_take.id}-{item.id}",
                   expiry_date=timezone.now().date() + timedelta(days=365),
                   quantity=variance,
                   cost_price=variation.cost or 0
               )
               
               StockMovement.objects.create(
                   tenant=stock_take.tenant,
                   batch=batch,
                   variation=variation,
                   product=variation.product,
                   outlet=stock_take.outlet,
                   user=request.user,
                   movement_type='adjustment',
                   quantity=variance,
                   reason=reason,
                   reference_id=f"stocktake_{stock_take.id}"
               )
           else:
               # Shortage - deduct stock
               try:
                   deduct_stock(
                       variation=variation,
                       quantity=abs(variance),
                       outlet=stock_take.outlet,
                       movement_type='adjustment',
                       reason=reason,
                       reference_id=f"stocktake_{stock_take.id}",
                       user=request.user
                   )
               except InsufficientStockError:
                   # Log error but continue with other items
                   logger.error(f"Cannot deduct {abs(variance)} from {variation}")
                   continue
           
           adjustments_made += 1
       
       stock_take.status = 'reconciled'
       stock_take.completed_at = timezone.now()
       stock_take.save()
       
       return Response({
           'detail': 'Stock take reconciled',
           'adjustments_made': adjustments_made
       })
   ```

2. **Variance Reports**
   ```python
   @action(detail=True, methods=['get'])
   def variance_report(self, request, pk=None):
       """Get detailed variance report"""
       stock_take = self.get_object()
       items_with_variance = stock_take.items.exclude(difference=0)
       
       return Response({
           'stock_take_id': stock_take.id,
           'date': stock_take.operating_date,
           'outlet': stock_take.outlet.name,
           'total_items_counted': stock_take.items.count(),
           'items_with_variance': items_with_variance.count(),
           'variances': [
               {
                   'product': item.variation.product.name,
                   'variation': item.variation.name,
                   'expected': item.expected_quantity,
                   'counted': item.counted_quantity,
                   'variance': item.difference,
                   'variance_percent': (item.difference / item.expected_quantity * 100) if item.expected_quantity > 0 else 0,
                   'reason': item.variance_reason
               }
               for item in items_with_variance
           ]
       })
   ```

#### Deliverables
- ✅ Reconciliation endpoint
- ✅ Variance report API
- ✅ Adjustment creation logic
- ✅ Email notifications

#### Acceptance Criteria
- [ ] Reconciliation creates adjustments
- [ ] Overage adds stock (new batch)
- [ ] Shortage deducts stock (FIFO)
- [ ] Status changes to 'reconciled'
- [ ] All adjustments logged in StockMovement
- [ ] Variance report available

---

### Day 5: Testing & Documentation

#### Tasks

1. **End-to-End Testing**
   - Create stock take with 50 items
   - Mix of overage and shortage
   - Add variance reasons
   - Reconcile and verify adjustments
   - Check StockMovement records
   - Verify Batch quantities updated

2. **Edge Cases**
   - Item not in system (new product)
   - Zero counted (full loss)
   - Large variance (>50%)
   - Multiple counts same day

3. **Performance Testing**
   - Reconcile 1000 items
   - Measure time (<30 seconds target)

#### Deliverables
- ✅ End-to-end tests passing
- ✅ Edge cases handled
- ✅ Performance benchmarks met
- ✅ Phase 3 complete

---

## Phase 4: Frontend Implementation (Week 4)

### Overview
Build user interfaces for inventory management, physical counts, and reporting.

### Phase Objectives
- ✅ Stock dashboard with real-time data
- ✅ Inventory adjustment UI
- ✅ Physical count interface
- ✅ Barcode scanner integration
- ✅ Product management (optional images)

### Timeline
**Duration**: 5 days  
**Team Size**: 2 developers  
**Effort**: 80 hours

---

### Day 1-2: Stock Dashboard

#### Tasks

1. **Dashboard Page**
   ```typescript
   // frontend/app/dashboard/inventory/page.tsx
   export default function InventoryDashboard() {
     return (
       <div className="container mx-auto p-6">
         <h1 className="text-3xl font-bold mb-6">Inventory Management</h1>
         
         {/* Summary Cards */}
         <div className="grid grid-cols-4 gap-4 mb-6">
           <StockSummaryCard title="Total Items" value={totalItems} />
           <StockSummaryCard title="Low Stock" value={lowStockCount} alert />
           <StockSummaryCard title="Expiring Soon" value={expiringCount} alert />
           <StockSummaryCard title="Total Value" value={totalValue} />
         </div>
         
         {/* Stock Table */}
         <StockTable 
           data={stockData}
           onExpand={handleExpandBatches}
         />
       </div>
     );
   }
   ```

2. **FIFO Batch View**
   - Expandable rows showing batches
   - Batch number, quantity, expiry, cost
   - Color coding for expiry status

3. **Filters & Search**
   - By outlet
   - By category
   - By stock status (low, normal, high)
   - Search by name/SKU/barcode

#### Deliverables
- ✅ Stock dashboard page
- ✅ FIFO batch display
- ✅ Filters and search
- ✅ Real-time updates

---

### Day 3: Adjustment & Count UI

#### Tasks

1. **Adjustment Form**
   - Select variation
   - Current stock display
   - Adjustment type (positive/negative)
   - Reason (required)
   - Submit with confirmation

2. **Physical Count Interface**
   - Start new count button
   - Barcode scanner input
   - Item list with quantities
   - Save progress
   - Complete and reconcile

3. **Variance Review**
   - Show items with variance
   - Add reasons
   - Approve adjustments

#### Deliverables
- ✅ Adjustment UI
- ✅ Count interface
- ✅ Barcode integration
- ✅ Variance workflow

---

### Day 4-5: Testing & Polish

#### User Acceptance Testing
- Staff completes physical count
- Staff makes adjustments
- Verify all workflows
- Collect feedback
- Fix issues

---

## Phase 5: Production Readiness (Week 5)

### Overview
Monitoring, optimization, documentation, and production deployment.

### Phase Objectives
- ✅ Automated health checks
- ✅ Performance optimization
- ✅ Complete reporting suite
- ✅ Staff training
- ✅ Production deployment

### Timeline
**Duration**: 5 days  
**Team Size**: 2 developers + 1 QA  
**Effort**: 100 hours

---

### Day 1: Monitoring Setup

#### Tasks
- Daily reconciliation cron
- Expiry monitoring
- Performance tracking
- Error alerting

---

### Day 2-3: Reporting & Optimization

#### Reports to Build
1. Stock movement history
2. Outlet reconciliation
3. Expiry tracking
4. COGS by batch
5. Variance trends

---

### Day 4-5: Training & Deployment

#### Tasks
- Staff training sessions
- Documentation finalization
- Production deployment
- Post-deployment monitoring
- Success metrics tracking

---

## Success Metrics & KPIs

### System Health
- [ ] Stock accuracy: 99.5%+
- [ ] System availability: 99.9%+
- [ ] Deduction speed: <100ms
- [ ] Zero expired sales

### Business Impact
- [ ] Physical count time reduced 50%
- [ ] Variance reduction 80%
- [ ] Staff confidence improved
- [ ] Financial accuracy validated

---

## Risk Register

| Phase | Risk | Impact | Mitigation |
|-------|------|--------|------------|
| 1 | FIFO logic incorrect | HIGH | Extensive unit tests |
| 2 | Sales integration breaks POS | CRITICAL | Staged rollout with rollback |
| 3 | Reconciliation data loss | HIGH | Backup before every reconcile |
| 4 | Poor UX adoption | MEDIUM | User testing before deployment |
| 5 | Production bugs | HIGH | Canary deployment + monitoring |

---

## Rollback Procedures

### Phase 1-2
- Revert code changes
- Keep StockMovement data
- Manual reconciliation if needed

### Phase 3+
- DO NOT delete StockTake data
- Revert UI changes only
- Backend remains functional

---

## Sign-off & Approvals

| Phase | Completed | Approved By | Date |
|-------|-----------|-------------|------|
| Phase 1 | ⏳ | ___________ | ____ |
| Phase 2 | ⏳ | ___________ | ____ |
| Phase 3 | ⏳ | ___________ | ____ |
| Phase 4 | ⏳ | ___________ | ____ |
| Phase 5 | ⏳ | ___________ | ____ |

---

**Document Owner**: Development Team  
**Created**: January 26, 2026  
**Status**: Ready for Execution  
**Next Review**: End of Phase 1
