from django.db import migrations, models


def populate_movement_snapshots(apps, schema_editor):
    StockMovement = apps.get_model('inventory', 'StockMovement')
    negative_types = {'sale', 'transfer_out', 'damage', 'expiry'}

    for movement in StockMovement.objects.select_related('batch', 'product').iterator():
        unit_cost = None
        if movement.batch_id and movement.batch and movement.batch.cost_price is not None:
            unit_cost = movement.batch.cost_price
        elif movement.product_id and movement.product and movement.product.cost is not None:
            unit_cost = movement.product.cost

        StockMovement.objects.filter(pk=movement.pk).update(
            quantity_delta=(-movement.quantity if movement.movement_type in negative_types else movement.quantity),
            unit_cost=unit_cost,
        )


class Migration(migrations.Migration):
    dependencies = [('inventory', '0009_alter_stockmovement_product_and_more')]

    operations = [
        migrations.AddField(
            model_name='stockmovement',
            name='quantity_delta',
            field=models.IntegerField(blank=True, help_text='Signed inventory effect in base units; positive adds stock.', null=True),
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='unit_cost',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Immutable unit-cost snapshot at the time of movement.', max_digits=12, null=True),
        ),
        migrations.RunPython(populate_movement_snapshots, migrations.RunPython.noop),
    ]
