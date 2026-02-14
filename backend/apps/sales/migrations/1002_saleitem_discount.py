from decimal import Decimal
from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1001_remove_sale_sales_till_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='saleitem',
            name='discount',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0'),
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(Decimal('0'))],
            ),
        ),
    ]
