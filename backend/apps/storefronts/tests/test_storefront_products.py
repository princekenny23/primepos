from django.test import TestCase

from apps.outlets.models import Outlet
from apps.products.models import Category, Product
from apps.storefronts.models import Storefront
from apps.tenants.models import Tenant


class StorefrontProductsEndpointTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="Storefront Tenant", type="retail")
        self.outlet = Outlet.objects.create(tenant=self.tenant, name="Main Outlet")
        self.other_outlet = Outlet.objects.create(tenant=self.tenant, name="Second Outlet")
        self.storefront = Storefront.objects.create(
            tenant=self.tenant,
            default_outlet=self.outlet,
            name="Demo Store",
            slug="demo-store",
        )
        self.category = Category.objects.create(tenant=self.tenant, name="Groceries")

        self.product_one = Product.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            category=self.category,
            name="Milk",
            retail_price="3.50",
            stock=10,
            is_active=True,
        )
        self.product_two = Product.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            category=self.category,
            name="Bread",
            retail_price="2.00",
            stock=6,
            is_active=True,
        )
        Product.objects.create(
            tenant=self.tenant,
            outlet=self.other_outlet,
            category=self.category,
            name="Other Outlet Product",
            retail_price="1.00",
            stock=2,
            is_active=True,
        )
        Product.objects.create(
            tenant=self.tenant,
            outlet=self.outlet,
            category=self.category,
            name="Inactive Product",
            retail_price="1.00",
            stock=0,
            is_active=False,
        )

    def test_public_products_endpoint_returns_paginated_outlet_products(self):
        response = self.client.get(f"/api/v1/storefronts/{self.storefront.slug}/products/?page_size=2")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 2)
        returned_ids = [item["id"] for item in payload["results"]]
        self.assertEqual(returned_ids, [self.product_two.id, self.product_one.id])
