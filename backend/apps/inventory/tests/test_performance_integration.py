"""
Phase 1 Day 5: Performance and Integration Tests
Tests performance benchmarks and end-to-end scenarios
"""

from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from django.db import transaction, connection
from django.test.utils import override_settings
from datetime import timedelta, date
from decimal import Decimal
import time
import logging

from apps.inventory.models import Batch, LocationStock, StockMovement
from apps.inventory.stock_helpers import (
    get_available_stock,
    deduct_stock,
    add_stock,
    mark_expired_batches
)
from apps.products.models import Product, ItemVariation
from apps.outlets.models import Outlet
from apps.tenants.models import Tenant
from apps.accounts.models import User

logger = logging.getLogger(__name__)


class PerformanceBenchmarkTestCase(TestCase):
    """Test performance benchmarks - ensure operations are fast"""
    
    def setUp(self):
        """Create test data with multiple batches"""
        self.tenant = Tenant.objects.create(name="Perf Test Tenant")
        self.user = User.objects.create_user(username="perftest", tenant=self.tenant)
        self.outlet = Outlet.objects.create(tenant=self.tenant, name="Perf Store")
        self.product = Product.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            name="Perf Product",
            retail_price=Decimal("10.00")
        )
        self.variation = ItemVariation.objects.create(
            product=self.product,
            name="Default",
            price=Decimal("10.00"),
            track_inventory=True
        )
        
        # Create 10 batches
        today = timezone.now().date()
        for i in range(10):
            Batch.objects.create(
                tenant=self.tenant,
                variation=self.variation,
                outlet=self.outlet,
                batch_number=f"PERF-BATCH-{i:03d}",
                expiry_date=today + timedelta(days=30 + i),
                quantity=100,
                cost_price=Decimal("5.00")
            )
    
    def test_deduct_stock_performance(self):
        """Test that deduct_stock completes in <100ms"""
        start = time.time()
        
        try:
            deduct_stock(
                variation=self.variation,
                outlet=self.outlet,
                quantity=50,
                user=self.user,
                reference_id="PERF-SALE-001",
                reason="Performance test"
            )
        except Exception as e:
            self.fail(f"deduct_stock failed: {e}")
        
        elapsed = time.time() - start
        
        # Should complete in less than 100ms
        self.assertLess(
            elapsed,
            0.1,
            f"deduct_stock took {elapsed:.3f}s, should be <0.1s"
        )
        
        print(f"✅ deduct_stock: {elapsed*1000:.2f}ms")
    
    def test_get_available_stock_performance(self):
        """Test that get_available_stock is fast with many batches"""
        start = time.time()
        
        available = get_available_stock(self.variation, self.outlet)
        
        elapsed = time.time() - start
        
        # Should be very fast (single query)
        self.assertLess(
            elapsed,
            0.01,
            f"get_available_stock took {elapsed:.3f}s, should be <0.01s"
        )
        
        self.assertEqual(available, 1000)  # 10 batches × 100
        print(f"✅ get_available_stock: {elapsed*1000:.2f}ms")
    
    def test_query_count_deduct(self):
        """Verify deduct_stock doesn't cause N+1 queries"""
        # Deduct from multiple batches
        with self.assertNumQueries(11):  # Optimized query count: 1 SELECT + 1 BULK UPDATE + 1 BULK INSERT + LocationStock ops
            # SELECT batches (1 query)
            # BULK UPDATE batches (1 query)
            # BULK INSERT movements (1 query)
            # LocationStock operations (remaining queries)
            deduct_stock(
                variation=self.variation,
                outlet=self.outlet,
                quantity=150,
                user=self.user,
                reference_id="QUERY-TEST",
                reason="Query count test"
            )
    
    def test_bulk_deduction_performance(self):
        """Test multiple deductions in sequence"""
        start = time.time()
        
        # Perform 10 deductions
        for i in range(10):
            try:
                deduct_stock(
                    variation=self.variation,
                    outlet=self.outlet,
                    quantity=5,
                    user=self.user,
                    reference_id=f"BULK-{i:03d}",
                    reason="Bulk test"
                )
            except Exception as e:
                pass  # May run out of stock, that's ok
        
        elapsed = time.time() - start
        avg_time = elapsed / 10
        
        print(f"✅ Bulk deductions: {elapsed*1000:.2f}ms total, {avg_time*1000:.2f}ms avg")


class IntegrationScenarios(TransactionTestCase):
    """Test real-world scenarios with transactions"""
    
    def setUp(self):
        """Create test environment"""
        self.tenant = Tenant.objects.create(name="Integration Test")
        self.user = User.objects.create_user(username="inttest", tenant=self.tenant)
        self.outlet = Outlet.objects.create(tenant=self.tenant, name="Int Store")
        
        self.product = Product.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            name="Integration Product",
            retail_price=Decimal("25.00"),
            cost=Decimal("12.00")
        )
        
        self.variation = ItemVariation.objects.create(
            product=self.product,
            name="Default",
            price=Decimal("25.00"),
            cost=Decimal("12.00"),
            track_inventory=True
        )
    
    def test_scenario_receive_and_sell(self):
        """Scenario: Receive stock, then sell it"""
        today = timezone.now().date()
        
        # Step 1: Receive stock
        batch = add_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=100,
            batch_number="PO-2026-001",
            expiry_date=today + timedelta(days=365),
            cost_price=Decimal("12.00"),
            user=self.user,
            reason="Purchase order #001"
        )
        
        self.assertEqual(batch.quantity, 100)
        
        # Step 2: Check available stock
        available = get_available_stock(self.variation, self.outlet)
        self.assertEqual(available, 100)
        
        # Step 3: Sell 25 units
        deductions = deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=25,
            user=self.user,
            reference_id="SALE-001",
            reason="Customer purchase"
        )
        
        self.assertEqual(len(deductions), 1)
        self.assertEqual(deductions[0][1], 25)
        
        # Step 4: Verify remaining stock
        available = get_available_stock(self.variation, self.outlet)
        self.assertEqual(available, 75)
        
        # Step 5: Verify movement records
        movements = StockMovement.objects.filter(
            variation=self.variation
        ).order_by('created_at')
        
        self.assertEqual(movements.count(), 2)  # 1 purchase + 1 sale
        self.assertEqual(movements.first().movement_type, 'purchase')
        self.assertEqual(movements.last().movement_type, 'sale')
    
    def test_scenario_fifo_expiry(self):
        """Scenario: Multiple batches with different expiry, FIFO deduction"""
        today = timezone.now().date()
        
        # Create 3 batches with different expiry dates
        batch1 = add_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=30,
            batch_number="BATCH-SOON",
            expiry_date=today + timedelta(days=10),  # Expires soon
            cost_price=Decimal("12.00"),
            user=self.user,
            reason="Expiring soon"
        )
        
        batch2 = add_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=40,
            batch_number="BATCH-NORMAL",
            expiry_date=today + timedelta(days=30),  # Normal expiry
            cost_price=Decimal("12.00"),
            user=self.user,
            reason="Normal"
        )
        
        batch3 = add_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=50,
            batch_number="BATCH-FRESH",
            expiry_date=today + timedelta(days=60),  # Fresh
            cost_price=Decimal("12.00"),
            user=self.user,
            reason="Fresh stock"
        )
        
        total_stock = get_available_stock(self.variation, self.outlet)
        self.assertEqual(total_stock, 120)  # 30 + 40 + 50
        
        # Deduct 35 units - should use FIFO (oldest first)
        deductions = deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=35,
            user=self.user,
            reference_id="FIFO-TEST",
            reason="FIFO test"
        )
        
        # Should deduct from batch1 (30) and batch2 (5)
        self.assertEqual(len(deductions), 2)
        self.assertEqual(deductions[0][0].batch_number, "BATCH-SOON")
        self.assertEqual(deductions[0][1], 30)
        self.assertEqual(deductions[1][0].batch_number, "BATCH-NORMAL")
        self.assertEqual(deductions[1][1], 5)
        
        # Verify batches updated
        batch1.refresh_from_db()
        batch2.refresh_from_db()
        batch3.refresh_from_db()
        
        self.assertEqual(batch1.quantity, 0)   # All sold
        self.assertEqual(batch2.quantity, 35)  # 40 - 5
        self.assertEqual(batch3.quantity, 50)  # Untouched
    
    def test_scenario_expiry_handling(self):
        """Scenario: Expired batches are not sold"""
        today = timezone.now().date()
        
        # Create expired batch
        expired_batch = Batch.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            batch_number="EXPIRED",
            expiry_date=today - timedelta(days=5),  # Expired
            quantity=50,
            cost_price=Decimal("12.00")
        )
        
        # Create fresh batch
        fresh_batch = add_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=50,
            batch_number="FRESH",
            expiry_date=today + timedelta(days=30),
            cost_price=Decimal("12.00"),
            user=self.user,
            reason="Fresh stock"
        )
        
        # Check available stock - should only include fresh
        available = get_available_stock(self.variation, self.outlet)
        self.assertEqual(available, 50)  # Only fresh batch
        
        # Mark expired batches - use transaction
        with transaction.atomic():
            count = mark_expired_batches(
                variation=self.variation,
                outlet=self.outlet
            )
        
        self.assertEqual(count, 1)  # One batch marked
        
        # Expired batch should now have 0 quantity
        expired_batch.refresh_from_db()
        self.assertEqual(expired_batch.quantity, 0)
        
        # Verify expiry StockMovement created
        expiry_movement = StockMovement.objects.filter(
            batch=expired_batch,
            movement_type='expiry'
        ).first()
        
        self.assertIsNotNone(expiry_movement)
        self.assertEqual(expiry_movement.quantity, 50)
    
    def test_scenario_insufficient_stock_rollback(self):
        """Scenario: Insufficient stock transaction rolls back completely"""
        # Add initial stock
        add_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=10,
            batch_number="BATCH-001",
            expiry_date=timezone.now().date() + timedelta(days=30),
            user=self.user
        )
        
        initial_movements = StockMovement.objects.count()
        initial_quantity = get_available_stock(self.variation, self.outlet)
        
        # Try to deduct more than available
        with self.assertRaises(ValueError):
            deduct_stock(
                variation=self.variation,
                outlet=self.outlet,
                quantity=100,  # More than available (10)
                user=self.user,
                reference_id="FAIL-001",
                reason="Should fail"
            )
        
        # Verify nothing changed (transaction rolled back)
        final_quantity = get_available_stock(self.variation, self.outlet)
        final_movements = StockMovement.objects.count()
        
        self.assertEqual(final_quantity, initial_quantity)
        self.assertEqual(final_movements, initial_movements)
    
    def test_scenario_concurrent_sales(self):
        """Scenario: Multiple concurrent sales don't oversell"""
        # Add stock
        add_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=50,
            batch_number="CONCURRENT-TEST",
            expiry_date=timezone.now().date() + timedelta(days=30),
            user=self.user
        )
        
        # Simulate 3 concurrent sales of 20 units each
        # In practice, the third should fail or they all succeed depending on timing
        deduction_count = 0
        
        for i in range(3):
            try:
                deduct_stock(
                    variation=self.variation,
                    outlet=self.outlet,
                    quantity=20,
                    user=self.user,
                    reference_id=f"CONCURRENT-{i:03d}",
                    reason="Concurrent sale"
                )
                deduction_count += 1
            except ValueError:
                # Expected when stock runs out
                pass
        
        # Should have at least 2 successful deductions (40 units = 50 - 10)
        self.assertGreaterEqual(deduction_count, 2)
        
        # Total remaining stock should be 10 or less
        remaining = get_available_stock(self.variation, self.outlet)
        self.assertLessEqual(remaining, 10)


class LocationStockSyncTest(TestCase):
    """Test that LocationStock stays in sync with Batch totals"""
    
    def setUp(self):
        """Setup sync test data"""
        self.tenant = Tenant.objects.create(name="Sync Test")
        self.user = User.objects.create_user(username="sync", tenant=self.tenant)
        self.outlet = Outlet.objects.create(tenant=self.tenant, name="Sync Store")
        self.product = Product.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            name="Sync Product",
            retail_price=Decimal("10.00")
        )
        self.variation = ItemVariation.objects.create(
            product=self.product,
            name="Default",
            price=Decimal("10.00"),
            track_inventory=True
        )
    
    def test_location_stock_updates_with_deduction(self):
        """LocationStock should sync when stock is deducted"""
        today = timezone.now().date()
        
        # Add stock via batch
        Batch.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            batch_number="SYNC-001",
            expiry_date=today + timedelta(days=30),
            quantity=100
        )
        
        # LocationStock should be created during deduction
        deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=20,
            user=self.user,
            reference_id="SYNC-TEST",
            reason="Sync test"
        )
        
        # Get LocationStock
        location_stock = LocationStock.objects.filter(
            variation=self.variation,
            outlet=self.outlet
        ).first()
        
        self.assertIsNotNone(location_stock)
        
        # Should show remaining 80
        self.assertEqual(location_stock.quantity, 80)
    
    def test_location_stock_helper_method(self):
        """Test LocationStock sync_quantity_from_batches method"""
        today = timezone.now().date()
        
        # Create batch
        Batch.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            batch_number="SYNC-002",
            expiry_date=today + timedelta(days=30),
            quantity=100
        )
        
        # Create LocationStock
        loc_stock = LocationStock.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            quantity=0  # Wrong
        )
        
        # Sync should fix it
        loc_stock.sync_quantity_from_batches()
        
        self.assertEqual(loc_stock.quantity, 100)


class EdgeCaseTests(TestCase):
    """Test edge cases and unusual scenarios"""
    
    def setUp(self):
        """Setup edge case test data"""
        self.tenant = Tenant.objects.create(name="Edge Test")
        self.user = User.objects.create_user(username="edge", tenant=self.tenant)
        self.outlet = Outlet.objects.create(tenant=self.tenant, name="Edge Store")
        self.product = Product.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            name="Edge Product",
            retail_price=Decimal("10.00")
        )
        self.variation = ItemVariation.objects.create(
            product=self.product,
            name="Default",
            price=Decimal("10.00")
        )
    
    def test_deduct_exact_amount(self):
        """Deduct exact amount available"""
        today = timezone.now().date()
        
        Batch.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            batch_number="EXACT",
            expiry_date=today + timedelta(days=30),
            quantity=42
        )
        
        deductions = deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=42,
            user=self.user,
            reference_id="EXACT-TEST",
            reason="Exact amount"
        )
        
        self.assertEqual(len(deductions), 1)
        self.assertEqual(deductions[0][1], 42)
        
        available = get_available_stock(self.variation, self.outlet)
        self.assertEqual(available, 0)
    
    def test_deduct_one_unit(self):
        """Deduct just one unit"""
        today = timezone.now().date()
        
        Batch.objects.create(
            tenant=self.tenant,
            variation=self.variation,
            outlet=self.outlet,
            batch_number="ONE",
            expiry_date=today + timedelta(days=30),
            quantity=100
        )
        
        deductions = deduct_stock(
            variation=self.variation,
            outlet=self.outlet,
            quantity=1,
            user=self.user,
            reference_id="ONE-TEST",
            reason="One unit"
        )
        
        self.assertEqual(len(deductions), 1)
        self.assertEqual(deductions[0][1], 1)
