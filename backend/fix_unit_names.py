#!/usr/bin/env python
import os
import sys

# Add the project directory to the path
sys.path.insert(0, os.path.dirname(__file__))

# Set the Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'primepos.settings')

# Setup Django
import django
django.setup()

from apps.products.models import ProductUnit

def check_and_fix_units():
    # Find units with null or empty unit_name
    units_with_issues = ProductUnit.objects.filter(
        unit_name__isnull=True
    ) | ProductUnit.objects.filter(unit_name='')

    print(f"Found {units_with_issues.count()} units with missing unit_name")

    for unit in units_with_issues:
        print(f"ID: {unit.id}, Product: {unit.product.name}, unit_name: {repr(unit.unit_name)}")

        # Fix: set a default unit_name based on conversion_factor
        if unit.conversion_factor == 1:
            new_name = "piece"
        elif unit.conversion_factor == 12:
            new_name = "dozen"
        elif unit.conversion_factor == 6:
            new_name = "half-dozen"
        else:
            new_name = f"unit_{int(unit.conversion_factor)}"

        unit.unit_name = new_name
        unit.save()
        print(f"  -> Fixed to: {new_name}")

    print("Done!")

if __name__ == "__main__":
    check_and_fix_units()