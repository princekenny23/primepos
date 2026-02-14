from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum, Case, When, Value, F, Min, Max
from decimal import Decimal
from apps.sales.models import Sale
from apps.customers.models import CreditPayment

BATCH_SIZE = 1000


class Command(BaseCommand):
    help = "Backfill sale payment breakdown fields from customers_creditpayment"

    def handle(self, *args, **options):
        self.stdout.write("Starting backfill of payment breakdowns...")

        agg = CreditPayment.objects.aggregate(min_sale=Min('sale'), max_sale=Max('sale'))
        min_sale = agg.get('min_sale')
        max_sale = agg.get('max_sale')
        if not min_sale:
            self.stdout.write("No credit payments found. Nothing to do.")
            return

        start = int(min_sale)
        end_bound = int(max_sale)

        while start <= end_bound:
            end = start + BATCH_SIZE - 1
            self.stdout.write(f"Processing sales {start}..{end}")
            with transaction.atomic():
                payments = (
                    CreditPayment.objects
                    .filter(sale__gte=start, sale__lte=end)
                    .values('sale')
                    .annotate(
                        cash=Sum(Case(When(payment_method='cash', then=F('amount')), default=Value(0))),
                        card=Sum(Case(When(payment_method='card', then=F('amount')), default=Value(0))),
                        mobile=Sum(Case(When(payment_method='mobile', then=F('amount')), default=Value(0))),
                        bank_transfer=Sum(Case(When(payment_method='bank_transfer', then=F('amount')), default=Value(0))),
                        other=Sum(Case(When(payment_method='other', then=F('amount')), default=Value(0))),
                        tab=Sum(Case(When(payment_method='tab', then=F('amount')), default=Value(0))),
                        credit=Sum(Case(When(payment_method='credit', then=F('amount')), default=Value(0))),
                        total_paid=Sum('amount')
                    )
                )

                affected_ids = []
                for p in payments:
                    sid = p['sale']
                    affected_ids.append(sid)
                    Sale.objects.filter(pk=sid).update(
                        cash_amount=(p.get('cash') or Decimal('0')),
                        card_amount=(p.get('card') or Decimal('0')),
                        mobile_amount=(p.get('mobile') or Decimal('0')),
                        bank_transfer_amount=(p.get('bank_transfer') or Decimal('0')),
                        other_amount=(p.get('other') or Decimal('0')),
                        tab_amount=(p.get('tab') or Decimal('0')),
                        credit_amount=(p.get('credit') or Decimal('0')),
                        amount_paid=(p.get('total_paid') or Decimal('0')),
                    )

                # Refresh payment_status for affected sales
                for sid in affected_ids:
                    try:
                        s = Sale.objects.get(pk=sid)
                        s.update_payment_status()
                    except Sale.DoesNotExist:
                        continue

            start = end + 1

        self.stdout.write("Backfill complete.")
