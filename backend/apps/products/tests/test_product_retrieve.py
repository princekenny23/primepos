from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.outlets.models import Outlet
from apps.products.models import Product
from apps.tenants.models import Tenant, TenantPermissions


class ProductRetrieveTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_model = get_user_model()
        self.tenant = Tenant.objects.create(name="Test Tenant", type="retail")
        self.tenant_permissions, _ = TenantPermissions.objects.get_or_create(tenant=self.tenant)
        self.outlet = Outlet.objects.create(tenant=self.tenant, name="Main Outlet")
        self.user = self.user_model.objects.create_user(
            username="tester",
            email="tester@example.com",
            password="secret123",
            tenant=self.tenant,
            is_saas_admin=False,
        )
        self.product = Product.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            name="Test Product",
            retail_price="10.00",
            stock=5,
        )

    def test_retrieve_product_without_outlet_context_returns_product_for_tenant(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(f"/api/v1/products/{self.product.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], self.product.id)
