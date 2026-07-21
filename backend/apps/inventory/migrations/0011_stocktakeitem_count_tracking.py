from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_count_tracking(apps, schema_editor):
    StockTakeItem = apps.get_model('inventory', 'StockTakeItem')

    for item in StockTakeItem.objects.all().iterator():
        is_counted = bool((item.counted_quantity or 0) > 0)
        counted_at = item.updated_at if is_counted else None
        StockTakeItem.objects.filter(pk=item.pk).update(
            is_counted=is_counted,
            counted_at=counted_at,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0010_stockmovement_immutable_snapshots'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='stocktakeitem',
            name='counted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='stocktakeitem',
            name='counted_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='counted_stock_take_items', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='stocktakeitem',
            name='is_counted',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(backfill_count_tracking, migrations.RunPython.noop),
    ]
