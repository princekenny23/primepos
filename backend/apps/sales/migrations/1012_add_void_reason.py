from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "1011_add_is_void"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE sales_sale "
                    "ADD COLUMN IF NOT EXISTS void_reason text DEFAULT '' NOT NULL;"
                ),
                migrations.RunSQL(
                    "UPDATE sales_sale SET void_reason = '' WHERE void_reason IS NULL;"
                ),
                migrations.RunSQL(
                    "ALTER TABLE sales_sale ALTER COLUMN void_reason SET DEFAULT '';"
                ),
                migrations.RunSQL(
                    "ALTER TABLE sales_sale ALTER COLUMN void_reason SET NOT NULL;"
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="sale",
                    name="void_reason",
                    field=models.TextField(default="", blank=True),
                ),
            ],
        )
    ]
