from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.inventory.models import StockMovement, StockTake, StockTakeItem
from apps.outlets.models import Outlet, Till
from apps.products.models import Category, Product
from apps.shifts.models import Shift
from apps.tenants.models import Tenant


class ReportingLogicTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.tenant = Tenant.objects.create(name="Acme Retail")
        self.user = User.objects.create_user(
            username="reporter",
            email="reporter@example.com",
            password="pass1234",
            tenant=self.tenant,
        )
        self.client.force_authenticate(user=self.user)

        self.outlet = Outlet.objects.create(
            tenant=self.tenant,
            name="Main Outlet",
            address="Test address",
        )
        self.till = Till.objects.create(outlet=self.outlet, name="Till 1")

        self.other_tenant = Tenant.objects.create(name="Other Tenant")
        self.other_outlet = Outlet.objects.create(
            tenant=self.other_tenant,
            name="Other Outlet",
            address="Other address",
        )

        self.category = Category.objects.create(tenant=self.tenant, name="General")
        self.product = Product.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            category=self.category,
            name="Test Product",
            sku="SKU-001",
            retail_price=Decimal("20.00"),
            cost=Decimal("10.00"),
            stock=0,
            is_active=True,
        )

    def _get_results(self, response):
        payload = response.json()
        if isinstance(payload, dict) and "results" in payload:
            return payload["results"]
        return payload

    def _create_movement(self, movement_type, quantity, days_ago):
        movement = StockMovement.objects.create(
            tenant=self.tenant,
            product=self.product,
            outlet=self.outlet,
            user=self.user,
            movement_type=movement_type,
            quantity=quantity,
        )
        StockMovement.objects.filter(pk=movement.pk).update(
            created_at=timezone.now() - timedelta(days=days_ago)
        )

    def test_inventory_valuation_uses_pre_period_ledger_for_opening_stock(self):
        today = timezone.now().date()
        start_date = today - timedelta(days=7)
        end_date = today

        # Opening ledger position before period: +100 purchase, -25 sale => 75 opening.
        self._create_movement("purchase", 100, 20)
        self._create_movement("sale", 25, 10)

        # In-period movements: -10 sale, +5 purchase => closing should be 70.
        self._create_movement("sale", 10, 3)
        self._create_movement("purchase", 5, 2)

        response = self.client.get(
            "/api/v1/reports/inventory-valuation/",
            {
                "outlet": self.outlet.id,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["item_count"], 1)

        item = payload["items"][0]
        self.assertEqual(item["open_qty"], 75)
        self.assertEqual(item["received_qty"], 5)
        self.assertEqual(item["sold_qty"], 10)
        self.assertEqual(item["stock_qty"], 70)
        self.assertIn("meta", payload)
        self.assertEqual(payload["meta"]["tenant_id"], self.tenant.id)
        self.assertEqual(payload["meta"]["outlet_id"], str(self.outlet.id))

    def test_inventory_valuation_zero_count_reports_negative_discrepancy(self):
        today = timezone.now().date()
        start_date = today - timedelta(days=7)
        end_date = today

        self._create_movement("purchase", 12, 10)

        stock_take = StockTake.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            user=self.user,
            operating_date=today,
            status="completed",
            completed_at=timezone.now(),
        )
        StockTakeItem.objects.create(
            stock_take=stock_take,
            product=self.product,
            expected_quantity=12,
            counted_quantity=0,
        )

        response = self.client.get(
            "/api/v1/reports/inventory-valuation/",
            {
                "outlet": self.outlet.id,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        )

        self.assertEqual(response.status_code, 200)
        item = response.json()["items"][0]

        self.assertEqual(item["stock_qty"], 12)
        self.assertEqual(item["counted_qty"], 0)
        self.assertEqual(item["discrepancy"], -12)
        self.assertEqual(item["discrepancy_value"], -120.0)

    def test_reports_reject_outlet_from_another_tenant(self):
        response = self.client.get(
            "/api/v1/reports/inventory-valuation/",
            {
                "outlet": self.other_outlet.id,
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Outlet is required", response.json().get("detail", ""))

    def test_shift_history_applies_start_and_end_date_filters(self):
        today = timezone.now().date()

        old_shift = Shift.objects.create(
            outlet=self.outlet,
            till=self.till,
            user=self.user,
            operating_date=today - timedelta(days=15),
            opening_cash_balance=Decimal("100.00"),
            closing_cash_balance=Decimal("150.00"),
            status="CLOSED",
        )
        in_range_shift = Shift.objects.create(
            outlet=self.outlet,
            till=self.till,
            user=self.user,
            operating_date=today - timedelta(days=2),
            opening_cash_balance=Decimal("200.00"),
            closing_cash_balance=Decimal("260.00"),
            status="CLOSED",
        )

        response = self.client.get(
            "/api/v1/shifts/history/",
            {
                "outlet": self.outlet.id,
                "start_date": (today - timedelta(days=7)).isoformat(),
                "end_date": today.isoformat(),
            },
        )

        self.assertEqual(response.status_code, 200)
        results = self._get_results(response)
        ids = {int(row["id"]) for row in results}

        self.assertIn(in_range_shift.id, ids)
        self.assertNotIn(old_shift.id, ids)
