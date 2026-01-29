from django.core.management.base import BaseCommand
from apps.products.models import ProductUnit


class Command(BaseCommand):
    help = 'Fix ProductUnits with missing unit_name'

    def handle(self, *args, **options):
        # Find units with null or empty unit_name
        units_with_issues = ProductUnit.objects.filter(
            unit_name__isnull=True
        ) | ProductUnit.objects.filter(unit_name='')

        self.stdout.write(f"Found {units_with_issues.count()} units with missing unit_name")

        for unit in units_with_issues:
            self.stdout.write(f"ID: {unit.id}, Product: {unit.product.name}, unit_name: {repr(unit.unit_name)}")

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
            self.stdout.write(f"  -> Fixed to: {new_name}")

        self.stdout.write("Done!")