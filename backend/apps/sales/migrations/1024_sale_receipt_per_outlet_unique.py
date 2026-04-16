from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1023_saleitem_cost'),
    ]

    operations = [
        migrations.AlterField(
            model_name='sale',
            name='receipt_number',
            field=models.CharField(db_index=True, max_length=50),
        ),
        migrations.AddConstraint(
            model_name='sale',
            constraint=models.UniqueConstraint(
                fields=('tenant', 'outlet', 'receipt_number'),
                name='uniq_sale_receipt_per_outlet',
            ),
        ),
    ]
