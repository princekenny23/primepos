from datetime import date
from decimal import Decimal

from django.test import TestCase

from apps.accounts.models import User
from apps.outlets.models import Outlet
from apps.suppliers.models import PurchaseReturn, Supplier
from apps.suppliers.serializers import PurchaseReturnSerializer
from apps.tenants.models import Tenant


class PurchaseReturnSerializerTest(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="Purchase Return Tenant")
        self.user = User.objects.create_user(username="purchase-return-user", tenant=self.tenant)
        self.outlet = Outlet.objects.create(tenant=self.tenant, name="Purchase Return Outlet")
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            name="Return Supplier",
            is_active=True,
        )

    def test_purchase_return_serializer_creates_return(self):
        data = {
            'supplier_id': self.supplier.id,
            'outlet_id': self.outlet.id,
            'return_date': date.today().isoformat(),
            'reason': 'Defective items',
            'total': Decimal('100.00'),
            'notes': 'Test return',
        }

        request = type('Request', (), {'tenant': self.tenant, 'user': self.user})()
        serializer = PurchaseReturnSerializer(data=data, context={'request': request})

        self.assertTrue(serializer.is_valid(), serializer.errors)
        purchase_return = serializer.save(tenant=self.tenant, outlet=self.outlet, created_by=self.user)

        self.assertIsInstance(purchase_return, PurchaseReturn)
        self.assertEqual(purchase_return.supplier, self.supplier)
        self.assertEqual(purchase_return.outlet, self.outlet)
        self.assertEqual(purchase_return.created_by, self.user)
        self.assertTrue(str(purchase_return.return_number).startswith('RET-'))
