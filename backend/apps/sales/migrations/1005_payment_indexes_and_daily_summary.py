from django.db import migrations


DAILY_SUMMARY_VIEW = """
CREATE MATERIALIZED VIEW IF NOT EXISTS sales_payment_daily_summary AS
SELECT
  date_trunc('day', s.created_at)::date AS day,
  s.outlet_id,
  s.payment_method,
  SUM(s.total) AS total_sales,
  SUM(s.amount_paid) AS total_collected,
  SUM(s.cash_amount) AS cash_collected,
  SUM(s.card_amount) AS card_collected,
  SUM(s.mobile_amount) AS mobile_collected,
  SUM(s.bank_transfer_amount) AS bank_transfer_collected,
  SUM(s.other_amount) AS other_collected,
  SUM(s.tab_amount) AS tab_collected,
  SUM(s.credit_amount) AS credit_collected,
  COUNT(*) AS tx_count
FROM sales_sale s
GROUP BY day, s.outlet_id, s.payment_method;
"""

DROP_DAILY_SUMMARY_VIEW = """
DROP MATERIALIZED VIEW IF EXISTS sales_payment_daily_summary;
"""


def create_payment_summary(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales_sale (payment_status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sales_outlet_payment_method_created ON sales_sale (outlet_id, payment_method, created_at);")
        cursor.execute(DAILY_SUMMARY_VIEW)
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_payment_daily_summary_day_outlet_method "
            "ON sales_payment_daily_summary (day, outlet_id, payment_method);"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_sales_payment_daily_summary_day_outlet "
            "ON sales_payment_daily_summary (day, outlet_id);"
        )


def drop_payment_summary(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP INDEX IF EXISTS idx_sales_payment_daily_summary_day_outlet;")
        cursor.execute("DROP INDEX IF EXISTS idx_sales_payment_daily_summary_day_outlet_method;")
        cursor.execute(DROP_DAILY_SUMMARY_VIEW)
        cursor.execute("DROP INDEX IF EXISTS idx_sales_outlet_payment_method_created;")
        cursor.execute("DROP INDEX IF EXISTS idx_sales_payment_status;")


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1004_add_payment_breakdown'),
    ]

    operations = [
        migrations.RunPython(create_payment_summary, reverse_code=drop_payment_summary),
    ]
