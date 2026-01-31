# Generated migration to remove variation_name field

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1002_remove_saleitem_sales_salei_variati_742672_idx_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='saleitem',
            name='variation_name',
        ),
    ]
