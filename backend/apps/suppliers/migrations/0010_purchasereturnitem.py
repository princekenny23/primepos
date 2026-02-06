from django.db import migrations, models
import django.db.models.deletion
from django.core.validators import MinValueValidator
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('suppliers', '0009_remove_autopurchaseordersettings_tenant_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='PurchaseReturnItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])),
                ('unit_price', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=10, validators=[MinValueValidator(Decimal('0'))])),
                ('total', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=10, validators=[MinValueValidator(Decimal('0'))])),
                ('reason', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='purchase_return_items', to='products.product')),
                ('purchase_return', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='suppliers.purchasereturn')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='purchase_return_items', to='tenants.tenant')),
            ],
            options={
                'verbose_name': 'Purchase Return Item',
                'verbose_name_plural': 'Purchase Return Items',
                'db_table': 'suppliers_purchasereturnitem',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='purchasereturnitem',
            index=models.Index(fields=['tenant'], name='suppliers_purchasereturnitem_tenant_idx'),
        ),
        migrations.AddIndex(
            model_name='purchasereturnitem',
            index=models.Index(fields=['purchase_return'], name='suppliers_purchasereturnitem_preturn_idx'),
        ),
        migrations.AddIndex(
            model_name='purchasereturnitem',
            index=models.Index(fields=['product'], name='suppliers_purchasereturnitem_product_idx'),
        ),
    ]