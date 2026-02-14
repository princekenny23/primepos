from django.core.management.base import BaseCommand
from django.db import transaction
from apps.sales.models import Sale, Receipt
from apps.sales.services import ReceiptService


class Command(BaseCommand):
    help = "Backfill missing PDF receipts for completed sales"

    def handle(self, *args, **options):
        self.stdout.write("Backfilling receipts for completed sales...")
        qs = Sale.objects.filter(status='completed')
        total = qs.count()
        created = 0

        for sale in qs.iterator():
            has_receipt = Receipt.objects.filter(sale=sale, format='pdf', is_current=True, voided=False).exists()
            if has_receipt:
                continue

            try:
                with transaction.atomic():
                    ReceiptService.generate_receipt(sale, format='pdf', user=sale.user)
                created += 1
            except Exception as exc:
                self.stderr.write(f"Failed to generate receipt for sale {sale.id}: {exc}")

        self.stdout.write(f"Backfill complete. Generated {created} of {total} sales.")
