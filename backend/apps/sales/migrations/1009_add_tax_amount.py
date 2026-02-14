from django.db import migrations, models
from decimal import Decimal
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "1008_merge_20260212_0332"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE sales_sale "
                    "ADD COLUMN IF NOT EXISTS tax_amount numeric(10,2) DEFAULT 0 NOT NULL;"
                ),
                migrations.RunSQL(
                    "UPDATE sales_sale SET tax_amount = 0 WHERE tax_amount IS NULL;"
                ),
                migrations.RunSQL(
                    "ALTER TABLE sales_sale ALTER COLUMN tax_amount SET DEFAULT 0;"
                ),
                migrations.RunSQL(
                    "ALTER TABLE sales_sale ALTER COLUMN tax_amount SET NOT NULL;"
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="sale",
                    name="tax_amount",
                    field=models.DecimalField(
                        decimal_places=2,
                        default=Decimal("0"),
                        max_digits=10,
                        validators=[django.core.validators.MinValueValidator(Decimal("0"))],
                    ),
                ),
            ],
        )
    ]
