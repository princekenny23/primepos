from django.db import migrations, models
from decimal import Decimal
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "1012_add_void_reason"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE sales_saleitem "
                    "ADD COLUMN IF NOT EXISTS tax_rate_at_sale numeric(5,2) DEFAULT 0 NOT NULL;"
                ),
                migrations.RunSQL(
                    "UPDATE sales_saleitem SET tax_rate_at_sale = 0 WHERE tax_rate_at_sale IS NULL;"
                ),
                migrations.RunSQL(
                    "ALTER TABLE sales_saleitem ALTER COLUMN tax_rate_at_sale SET DEFAULT 0;"
                ),
                migrations.RunSQL(
                    "ALTER TABLE sales_saleitem ALTER COLUMN tax_rate_at_sale SET NOT NULL;"
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="saleitem",
                    name="tax_rate_at_sale",
                    field=models.DecimalField(
                        decimal_places=2,
                        default=Decimal("0"),
                        max_digits=5,
                        validators=[django.core.validators.MinValueValidator(Decimal("0"))],
                    ),
                ),
            ],
        )
    ]
