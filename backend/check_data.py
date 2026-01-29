#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'primepos.settings')
django.setup()

from apps.products.models import ItemVariation, ProductUnit, Product

print(f"Total Products: {Product.objects.count()}")
print(f"Total ItemVariations: {ItemVariation.objects.count()}")
print(f"Total ProductUnits: {ProductUnit.objects.count()}")

if ItemVariation.objects.count() > 0:
    print("\nFirst 5 variations:")
    for v in ItemVariation.objects.all()[:5]:
        print(f"  - {v.product.name} > {v.name} (Price: {v.price})")
else:
    print("\nNo variations found in database")

if ProductUnit.objects.count() > 0:
    print("\nFirst 5 units:")
    for u in ProductUnit.objects.all()[:5]:
        print(f"  - {u.product.name} > {u.unit_name} (Factor: {u.conversion_factor})")
else:
    print("\nNo product units found in database")
