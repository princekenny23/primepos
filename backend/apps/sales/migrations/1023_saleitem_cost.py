from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1022_rename_sales_conne_device__7ef5e5_idx_sales_conne_device__f7d47d_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='saleitem',
            name='cost',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Cost captured at time of sale',
                max_digits=15,
                null=True,
                validators=[MinValueValidator(Decimal('0'))],
            ),
        ),
    ]