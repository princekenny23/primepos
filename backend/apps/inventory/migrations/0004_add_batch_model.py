# Generated migration for Batch model

from django.db import migrations, models
import django.db.models.deletion
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0003_initialize_location_stock'),
        ('products', '0014_rename_products_pr_outlet_idx_products_pr_outlet__655c0b_idx_and_more'),
        ('outlets', '0001_initial'),
        ('tenants', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Batch',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('batch_number', models.CharField(help_text='Unique batch/lot number', max_length=100)),
                ('expiry_date', models.DateField(help_text='Date when this batch expires')),
                ('quantity', models.IntegerField(default=0, help_text='Current quantity in this batch', validators=[django.core.validators.MinValueValidator(0)])),
                ('cost_price', models.DecimalField(blank=True, decimal_places=2, help_text='Cost per unit for this batch', max_digits=10, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('outlet', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='batches', to='outlets.outlet')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='batches', to='tenants.tenant')),
            ],
            options={
                'verbose_name': 'Batch',
                'verbose_name_plural': 'Batches',
                'db_table': 'inventory_batch',
                'ordering': ['expiry_date', 'created_at'],
            },
        ),
        migrations.AddField(
            model_name='stockmovement',
            name='batch',
            field=models.ForeignKey(blank=True, help_text='Batch this movement belongs to', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='movements', to='inventory.batch'),
        ),
        migrations.AddIndex(
            model_name='batch',
            index=models.Index(fields=['tenant'], name='inventory_b_tenant_idx'),
        ),
        migrations.AddIndex(
            model_name='batch',
            index=models.Index(fields=['expiry_date'], name='inventory_b_expiry_idx'),
        ),
    ]
