from django.db import migrations, models
from decimal import Decimal
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "1009_add_tax_amount"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE sales_sale "
                    "ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0 NOT NULL;"
                ),
                migrations.RunSQL(
                    "UPDATE sales_sale SET discount_amount = 0 WHERE discount_amount IS NULL;"
                ),
                migrations.RunSQL(
                    "ALTER TABLE sales_sale ALTER COLUMN discount_amount SET DEFAULT 0;"
                ),
                migrations.RunSQL(
                    "ALTER TABLE sales_sale ALTER COLUMN discount_amount SET NOT NULL;"
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="sale",
                    name="discount_amount",
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
