#!/usr/bin/env python3
"""Test if all apps can be imported without errors"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'primepos.settings')
django.setup()

print("Testing Django setup...")

# Try importing critical apps
try:
    from apps.inventory.models import Batch, StockMovement, LocationStock, StockTake, StockTakeItem
    print("✓ Inventory models imported successfully")
except Exception as e:
    print(f"✗ Failed to import inventory models: {e}")
    sys.exit(1)

try:
    from apps.sales.models import Sale, SaleItem
    print("✓ Sales models imported successfully")
except Exception as e:
    print(f"✗ Failed to import sales models: {e}")
    sys.exit(1)

try:
    from apps.products.models import Product, ProductUnit, Category
    print("✓ Products models imported successfully")
except Exception as e:
    print(f"✗ Failed to import products models: {e}")
    sys.exit(1)

try:
    from apps.bar.models import BarTable, Tab, TabItem
    print("✓ Bar models imported successfully")
except Exception as e:
    print(f"✗ Failed to import bar models: {e}")
    sys.exit(1)

try:
    from apps.suppliers.models import Supplier, PurchaseOrder
    print("✓ Suppliers models imported successfully")
except Exception as e:
    print(f"✗ Failed to import suppliers models: {e}")
    sys.exit(1)

# Try importing serializers
try:
    from apps.inventory.serializers import BatchSerializer, StockMovementSerializer
    print("✓ Inventory serializers imported successfully")
except Exception as e:
    print(f"✗ Failed to import inventory serializers: {e}")
    sys.exit(1)

try:
    from apps.sales.serializers import SaleSerializer, SaleItemSerializer
    print("✓ Sales serializers imported successfully")
except Exception as e:
    print(f"✗ Failed to import sales serializers: {e}")
    sys.exit(1)

print("\n✓ All imports successful! Backend is ready to start.")
