# Generated migration to make variation_name nullable for UNITS ONLY architecture

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1001_remove_sale_sales_till_idx'),
    ]

    operations = [
        migrations.AlterField(
            model_name='saleitem',
            name='variation_name',
            field=models.CharField(blank=True, help_text='Variation name snapshot', max_length=255, null=True),
        ),
    ]
