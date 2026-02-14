from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Refresh the sales_payment_daily_summary materialized view"

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            self.stdout.write("Materialized view refresh skipped: database is not PostgreSQL.")
            return

        self.stdout.write("Refreshing sales_payment_daily_summary materialized view...")
        with connection.cursor() as cursor:
            try:
                cursor.execute('REFRESH MATERIALIZED VIEW CONCURRENTLY sales_payment_daily_summary;')
            except Exception:
                cursor.execute('REFRESH MATERIALIZED VIEW sales_payment_daily_summary;')
        self.stdout.write("Refresh complete.")
