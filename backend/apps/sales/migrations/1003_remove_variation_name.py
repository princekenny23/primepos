# Generated migration to remove variation_name field

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1001_remove_sale_sales_till_idx'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='saleitem',
            name='variation_name',
        ),
    ]
