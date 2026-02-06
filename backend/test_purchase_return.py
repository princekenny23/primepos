#!/usr/bin/env python
"""Test purchase return serializer"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'primepos.settings')
django.setup()

from apps.suppliers.serializers import PurchaseReturnSerializer
from apps.suppliers.models import Supplier, PurchaseReturn
from apps.outlets.models import Outlet
from apps.tenants.models import Tenant
from apps.accounts.models import User
from datetime import date, datetime
from decimal import Decimal

# Get first tenant and outlet
tenant = Tenant.objects.first()
outlet = Outlet.objects.filter(tenant=tenant).first()
supplier = Supplier.objects.filter(tenant=tenant).first()
user = User.objects.filter(tenant=tenant).first()

if not all([tenant, outlet, supplier, user]):
    print("Missing required objects:")
    print(f"  Tenant: {tenant}")
    print(f"  Outlet: {outlet}")
    print(f"  Supplier: {supplier}")
    print(f"  User: {user}")
    exit(1)

# Test data
data = {
    'supplier_id': supplier.id,
    'outlet_id': outlet.id,
    'return_date': date.today().isoformat(),
    'reason': 'Defective items',
    'total': Decimal('100.00'),
    'notes': 'Test return'
}

# Create serializer with context
context = {
    'request': type('Request', (), {
        'tenant': tenant,
        'user': user
    })()
}

serializer = PurchaseReturnSerializer(data=data, context=context)

if serializer.is_valid():
    # Test with perform_create style save
    ret = serializer.save(tenant=tenant, outlet=outlet, created_by=user)
    print(f"✅ Purchase return created successfully!")
    print(f"  ID: {ret.id}")
    print(f"  Return Number: {ret.return_number}")
    print(f"  Supplier: {ret.supplier.name}")
    print(f"  Outlet: {ret.outlet.name}")
    print(f"  Created By: {ret.created_by.username}")
    
    # Clean up
    ret.delete()
    print(f"✅ Test completed successfully!")
else:
    print(f"❌ Serializer validation failed:")
    for field, errors in serializer.errors.items():
        print(f"  {field}: {errors}")
