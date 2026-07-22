from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0020_product_new_stock_override_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='is_archived',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='product',
            name='archived_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='product',
            name='archived_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='product',
            name='archived_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='archived_products',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
