"""
Phase 2: Sales Integration Tests
Tests the complete sale → stock deduction flow
"""

from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from django.db import transaction
from decimal import Decimal
from datetime import timedelta

from apps.sales.models import Sale, SaleItem
from apps.inventory.models import Batch, StockMovement, LocationStock
from apps.products.models import Product, ItemVariation
from apps.outlets.models import Outlet
from apps.tenants.models import Tenant
from apps.accounts.models import User
from apps.customers.models import Customer


class SaleStockDeductionTests(TransactionTestCase):
    """Test that sales properly deduct stock"""
    
    def setUp(self):
        """Create test environment"""
        self.tenant = Tenant.objects.create(name="Sale Integration Test")
        self.user = User.objects.create_user(username="seller", tenant=self.tenant)
        self.outlet = Outlet.objects.create(tenant=self.tenant, name="Test Store")
        
        self.product = Product.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            name="Test Product",
            retail_price=Decimal("100.00"),
            cost=Decimal("50.00")
        )
        
        self.variation = ItemVariation.objects.create(
            product=self.product,
            name="Default",
            price=Decimal("100.00"),
            cost=Decimal("50.00"),
            track_inventory=True
        )
        
        # Create batch with stock
        today = timezone.now().date()
        self.batch = Batch.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            batch_number="SALE-TEST-001",
            expiry_date=today + timedelta(days=30),
            quantity=100,
            cost_price=Decimal("50.00")
        )
    
    def test_sale_deducts_stock(self):
        """Creating a sale deducts stock from batch"""
        # Initial stock
        initial_qty = self.batch.quantity
        
        # Create sale with 25 units
        sale = Sale.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            user=self.user,
            receipt_number="RCP-001",
            subtotal=Decimal("2500.00"),
            total=Decimal("2500.00"),
            payment_method='cash'
        )
        
        SaleItem.objects.create(
            sale=sale,
            product=self.product,
            variation=self.variation,
            product_name=self.product.name,
            variation_name=self.variation.name,
            quantity=25,
            quantity_in_base_units=25,
            price=Decimal("100.00"),
            total=Decimal("2500.00")
        )
        
        # Manually deduct (simulating what views.py does)
        from apps.inventory.stock_helpers import deduct_stock
        deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=25,
            user=self.user,
            reference_id=str(sale.id),
            reason=f"Sale {sale.receipt_number}"
        )
        
        # Check batch was updated
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity, initial_qty - 25)
        self.assertEqual(self.batch.quantity, 75)
        
        # Check StockMovement was created
        movement = StockMovement.objects.filter(
            reference_id=str(sale.id)
        ).first()
        
        self.assertIsNotNone(movement)
        self.assertEqual(movement.movement_type, 'sale')
        self.assertEqual(movement.quantity, 25)
    
    def test_sale_deducts_from_fifo_batches(self):
        """Sale deducts from batches in FIFO order (oldest expiry first)"""
        today = timezone.now().date()
        
        # Create 3 batches with different expiry dates
        batch_soon = Batch.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            batch_number="SOON",
            expiry_date=today + timedelta(days=5),
            quantity=20,
            cost_price=Decimal("50.00")
        )
        
        batch_normal = Batch.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            batch_number="NORMAL",
            expiry_date=today + timedelta(days=20),
            quantity=30,
            cost_price=Decimal("50.00")
        )
        
        batch_fresh = Batch.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            batch_number="FRESH",
            expiry_date=today + timedelta(days=60),
            quantity=40,
            cost_price=Decimal("50.00")
        )
        
        # Deduct 35 units - should use SOON (20) + NORMAL (15)
        from apps.inventory.stock_helpers import deduct_stock
        deductions = deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=35,
            user=self.user,
            reference_id="FIFO-TEST",
            reason="FIFO test"
        )
        
        # Verify FIFO order
        self.assertEqual(len(deductions), 2)
        self.assertEqual(deductions[0][0].batch_number, "SOON")
        self.assertEqual(deductions[0][1], 20)
        self.assertEqual(deductions[1][0].batch_number, "NORMAL")
        self.assertEqual(deductions[1][1], 15)
        
        # Verify batches updated correctly
        batch_soon.refresh_from_db()
        batch_normal.refresh_from_db()
        batch_fresh.refresh_from_db()
        
        self.assertEqual(batch_soon.quantity, 0)    # All used
        self.assertEqual(batch_normal.quantity, 15) # 30 - 15
        self.assertEqual(batch_fresh.quantity, 40)  # Untouched
    
    def test_sale_fails_insufficient_stock(self):
        """Sale fails gracefully when stock insufficient"""
        from apps.inventory.stock_helpers import deduct_stock
        
        # Try to deduct more than available
        with self.assertRaises(ValueError) as context:
            deduct_stock(
                variation=self.variation,
                outlet=self.outlet,
                quantity=150,  # More than 100 available
                user=self.user,
                reference_id="FAIL-001",
                reason="Should fail"
            )
        
        self.assertIn("insufficient", str(context.exception).lower())
        
        # Verify batch quantity unchanged (transaction rolled back)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity, 100)
    
    def test_expired_batches_excluded_from_sale(self):
        """Expired batches are never used for sales"""
        today = timezone.now().date()
        
        # Delete the original batch for clean test
        self.batch.delete()
        
        # Create expired batch
        expired_batch = Batch.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            batch_number="EXPIRED",
            expiry_date=today - timedelta(days=5),
            quantity=50,
            cost_price=Decimal("50.00")
        )
        
        # Create fresh batch
        fresh_batch = Batch.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            batch_number="FRESH",
            expiry_date=today + timedelta(days=30),
            quantity=30,
            cost_price=Decimal("50.00")
        )
        
        # Try to deduct 25 units
        from apps.inventory.stock_helpers import deduct_stock
        deductions = deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=25,
            user=self.user,
            reference_id="EXPIRED-TEST",
            reason="Expired test"
        )
        
        # Should deduct only from fresh batch (expired is skipped)
        fresh_batch.refresh_from_db()
        expired_batch.refresh_from_db()
        
        # Expired should be untouched
        self.assertEqual(expired_batch.quantity, 50)
        
        # Fresh batch should be reduced
        self.assertEqual(fresh_batch.quantity, 5)  # 30 - 25
    
    def test_location_stock_stays_in_sync(self):
        """LocationStock quantity syncs with Batch totals after sale"""
        from apps.inventory.stock_helpers import deduct_stock
        
        # Initial: 100 in batch
        initial_total = 100
        
        # Create/get LocationStock
        loc_stock, _ = LocationStock.objects.get_or_create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            defaults={'quantity': initial_total}
        )
        
        # Deduct 30 units
        deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=30,
            user=self.user,
            reference_id="SYNC-TEST",
            reason="Sync test"
        )
        
        # LocationStock should update to 70
        loc_stock.refresh_from_db()
        self.assertEqual(loc_stock.quantity, 70)
        
        # Batch total should also be 70
        batch_total = Batch.objects.filter(
            variation=self.variation,
            outlet=self.outlet
        ).aggregate(total=models.Sum('quantity'))['total'] or 0
        
        # Should be 70 (100 - 30)
        self.assertEqual(batch_total, 70)
    
    def test_sale_with_multiple_variations(self):
        """Sale with multiple product variations deducts each correctly"""
        from apps.inventory.stock_helpers import deduct_stock
        
        # Create second product with variation
        product2 = Product.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            name="Product 2",
            retail_price=Decimal("50.00")
        )
        
        variation2 = ItemVariation.objects.create(
            product=product2,
            name="Size L",
            price=Decimal("50.00"),
            track_inventory=True
        )
        
        today = timezone.now().date()
        batch2 = Batch.objects.create(
            tenant=self.tenant,
            variation=variation2,
            outlet=self.outlet,
            batch_number="BATCH-2",
            expiry_date=today + timedelta(days=30),
            quantity=50,
            cost_price=Decimal("25.00")
        )
        
        # Create sale with items from both variations
        sale = Sale.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            user=self.user,
            receipt_number="MULTI-001",
            subtotal=Decimal("7000.00"),
            total=Decimal("7000.00"),
            payment_method='cash'
        )
        
        # Create sale items
        SaleItem.objects.create(
            sale=sale,
            product=self.product,
            variation=self.variation,
            product_name=self.product.name,
            variation_name=self.variation.name,
            quantity=20,
            quantity_in_base_units=20,
            price=Decimal("100.00"),
            total=Decimal("2000.00")
        )
        
        SaleItem.objects.create(
            sale=sale,
            product=product2,
            variation=variation2,
            product_name=product2.name,
            variation_name=variation2.name,
            quantity=30,
            quantity_in_base_units=30,
            price=Decimal("50.00"),
            total=Decimal("1500.00")
        )
        
        # Deduct stock for both items
        deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=20,
            user=self.user,
            reference_id=str(sale.id),
            reason=f"Sale {sale.receipt_number}"
        )
        
        deduct_stock(
            variation=variation2,
            outlet=self.outlet,
            quantity=30,
            user=self.user,
            reference_id=str(sale.id),
            reason=f"Sale {sale.receipt_number}"
        )
        
        # Verify both batches deducted
        self.batch.refresh_from_db()
        batch2.refresh_from_db()
        
        self.assertEqual(self.batch.quantity, 100 - 20)  # 80
        self.assertEqual(batch2.quantity, 50 - 30)       # 20
    
    def test_sale_stock_movement_audit_trail(self):
        """Every stock deduction creates a StockMovement record"""
        from apps.inventory.stock_helpers import deduct_stock
        
        initial_movements = StockMovement.objects.count()
        
        # Create and deduct
        sale = Sale.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            user=self.user,
            receipt_number="AUDIT-001",
            subtotal=Decimal("1000.00"),
            total=Decimal("1000.00"),
            payment_method='cash'
        )
        
        deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=25,
            user=self.user,
            reference_id=str(sale.id),
            reason=f"Sale {sale.receipt_number}"
        )
        
        # Verify movement created
        final_movements = StockMovement.objects.count()
        self.assertEqual(final_movements, initial_movements + 1)
        
        # Verify movement details
        movement = StockMovement.objects.latest('id')
        self.assertEqual(movement.variation, self.variation)
        self.assertEqual(movement.movement_type, 'sale')
        self.assertEqual(movement.quantity, 25)
        self.assertEqual(movement.reference_id, str(sale.id))


class SaleRefundTests(TransactionTestCase):
    """Test refund/void sale logic"""
    
    def setUp(self):
        """Create test environment"""
        self.tenant = Tenant.objects.create(name="Refund Test")
        self.user = User.objects.create_user(username="cashier", tenant=self.tenant)
        self.outlet = Outlet.objects.create(tenant=self.tenant, name="Store")
        
        self.product = Product.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            name="Refund Test Product",
            retail_price=Decimal("100.00")
        )
        
        self.variation = ItemVariation.objects.create(
            product=self.product,
            name="Default",
            price=Decimal("100.00"),
            track_inventory=True
        )
        
        today = timezone.now().date()
        self.batch = Batch.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            batch_number="REFUND-TEST",
            expiry_date=today + timedelta(days=30),
            quantity=100,
            cost_price=Decimal("50.00")
        )
    
    def test_void_sale_restores_stock(self):
        """Voiding a sale restores stock to batch"""
        from apps.inventory.stock_helpers import deduct_stock, add_stock
        
        # Deduct stock (simulating sale)
        deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=25,
            user=self.user,
            reference_id="TEST-001",
            reason="Sale"
        )
        
        self.batch.refresh_from_db()
        qty_after_sale = self.batch.quantity
        self.assertEqual(qty_after_sale, 75)
        
        # Restore stock (refund)
        add_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=25,
            batch_number="REFUND",
            expiry_date=timezone.now().date() + timedelta(days=30),
            cost_price=Decimal("50.00"),
            user=self.user,
            reason="Refund for sale TEST-001"
        )
        
        # Total stock should be back to 100
        total_qty = Batch.objects.filter(
            variation=self.variation,
            outlet=self.outlet
        ).aggregate(total=models.Sum('quantity'))['total'] or 0
        
        self.assertEqual(total_qty, 100)
    
    def test_refund_creates_reverse_movement(self):
        """Refunding creates a reverse StockMovement"""
        from apps.inventory.stock_helpers import deduct_stock, add_stock
        
        initial_movements = StockMovement.objects.count()
        
        # Deduct
        deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=20,
            user=self.user,
            reference_id="REV-001",
            reason="Sale"
        )
        
        # Refund
        add_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=20,
            batch_number="REFUND-REV-001",
            expiry_date=timezone.now().date() + timedelta(days=30),
            user=self.user,
            reason="Refund REV-001"
        )
        
        # Should have 2 movements (1 deduct, 1 refund)
        final_movements = StockMovement.objects.count()
        self.assertEqual(final_movements, initial_movements + 2)
        
        # Latest should be purchase (refund)
        latest = StockMovement.objects.latest('id')
        self.assertEqual(latest.movement_type, 'purchase')
        self.assertEqual(latest.quantity, 20)
    
    def test_partial_refund(self):
        """Refunding partial quantity updates stock correctly"""
        from apps.inventory.stock_helpers import deduct_stock, add_stock
        
        # Deduct 50 units
        deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=50,
            user=self.user,
            reference_id="PARTIAL-001",
            reason="Sale"
        )
        
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity, 50)
        
        # Refund only 20 units
        add_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=20,
            batch_number="PARTIAL-REFUND",
            expiry_date=timezone.now().date() + timedelta(days=30),
            user=self.user,
            reason="Partial refund"
        )
        
        # Should now have 70 total (50 + 20)
        total_qty = Batch.objects.filter(
            variation=self.variation,
            outlet=self.outlet
        ).aggregate(total=models.Sum('quantity'))['total'] or 0
        
        self.assertEqual(total_qty, 70)


# Helper import for Sum aggregation
from django.db import models
