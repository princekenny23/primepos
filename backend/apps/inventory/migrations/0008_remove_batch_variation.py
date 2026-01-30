# Generated migration to remove variation field from Batch after ItemVariation deletion

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0007_batch_product_alter_batch_unique_together_and_more'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='batch',
            unique_together=set(),
        ),
        migrations.RemoveField(
            model_name='batch',
            name='variation',
        ),
        migrations.AlterUniqueTogether(
            name='batch',
            unique_together={('product', 'outlet', 'batch_number')},
        ),
        migrations.RemoveIndex(
            model_name='batch',
            name='inventory_b_variati_ea7ea7_idx',
        ),
        migrations.RemoveIndex(
            model_name='batch',
            name='inventory_b_variati_1eecd5_idx',
        ),
    ]
