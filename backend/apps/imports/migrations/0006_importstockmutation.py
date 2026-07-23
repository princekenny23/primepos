from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('outlets', '0012_remove_outlet_distribution_active'),
        ('products', '0021_product_archive_fields'),
        ('imports', '0005_alter_importbatch_sync_mode'),
    ]

    operations = [
        migrations.CreateModel(
            name='ImportStockMutation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('row_number', models.IntegerField()),
                ('before_quantity', models.IntegerField(default=0)),
                ('applied_quantity', models.IntegerField(default=0)),
                ('quantity_delta', models.IntegerField(default=0)),
                ('sync_strategy', models.CharField(blank=True, max_length=64)),
                ('movement_reason', models.CharField(blank=True, max_length=255)),
                ('rolled_back', models.BooleanField(default=False)),
                ('rolled_back_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('batch', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stock_mutations', to='imports.importbatch')),
                ('outlet', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='import_stock_mutations', to='outlets.outlet')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='import_stock_mutations', to='products.product')),
            ],
            options={
                'db_table': 'imports_importstockmutation',
                'ordering': ['row_number', 'created_at'],
                'unique_together': {('batch', 'row_number', 'product')},
            },
        ),
        migrations.AddIndex(
            model_name='importstockmutation',
            index=models.Index(fields=['batch', 'rolled_back'], name='imports_imp_batch_i_0ee9db_idx'),
        ),
        migrations.AddIndex(
            model_name='importstockmutation',
            index=models.Index(fields=['product', 'outlet'], name='imports_imp_product_848dfa_idx'),
        ),
        migrations.AddIndex(
            model_name='importstockmutation',
            index=models.Index(fields=['created_at'], name='imports_imp_created_f8e64d_idx'),
        ),
    ]
