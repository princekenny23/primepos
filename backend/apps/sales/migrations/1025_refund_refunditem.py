"""
Phase 3: Refund engine – adds Refund and RefundItem tables.
"""
from django.conf import settings
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1024_sale_receipt_per_outlet_unique'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tenants', '0001_initial'),
        ('outlets', '0001_initial'),
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Refund',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('refund_number', models.CharField(db_index=True, max_length=50)),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')],
                    default='approved', max_length=20,
                )),
                ('reason', models.TextField()),
                ('payment_method', models.CharField(max_length=20)),
                ('subtotal_refunded', models.DecimalField(
                    decimal_places=2, default=Decimal('0'), max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0'))],
                )),
                ('tax_refunded', models.DecimalField(
                    decimal_places=2, default=Decimal('0'), max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0'))],
                )),
                ('discount_reversed', models.DecimalField(
                    decimal_places=2, default=Decimal('0'), max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0'))],
                )),
                ('total_refunded', models.DecimalField(
                    decimal_places=2, max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.01'))],
                )),
                ('stock_restored', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('tenant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='refunds', to='tenants.tenant',
                )),
                ('outlet', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='refunds', to='outlets.outlet',
                )),
                ('original_sale', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='refunds', to='sales.sale',
                )),
                ('processed_by', models.ForeignKey(
                    null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='processed_refunds', to=settings.AUTH_USER_MODEL,
                )),
                ('approved_by', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='approved_refunds', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'sales_refund', 'ordering': ['-created_at']},
        ),
        migrations.AddConstraint(
            model_name='refund',
            constraint=models.UniqueConstraint(
                fields=['tenant', 'refund_number'],
                name='uniq_refund_number_per_tenant',
            ),
        ),
        migrations.AddIndex(
            model_name='refund',
            index=models.Index(fields=['tenant'], name='sales_refund_tenant_idx'),
        ),
        migrations.AddIndex(
            model_name='refund',
            index=models.Index(fields=['outlet'], name='sales_refund_outlet_idx'),
        ),
        migrations.AddIndex(
            model_name='refund',
            index=models.Index(fields=['original_sale'], name='sales_refund_sale_idx'),
        ),
        migrations.AddIndex(
            model_name='refund',
            index=models.Index(fields=['created_at'], name='sales_refund_created_idx'),
        ),
        migrations.CreateModel(
            name='RefundItem',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('product_name', models.CharField(max_length=255)),
                ('quantity', models.IntegerField(
                    validators=[django.core.validators.MinValueValidator(1)],
                )),
                ('quantity_in_base_units', models.IntegerField(
                    default=1,
                    validators=[django.core.validators.MinValueValidator(1)],
                )),
                ('price', models.DecimalField(
                    decimal_places=2, max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0'))],
                )),
                ('cost', models.DecimalField(
                    decimal_places=2, default=Decimal('0'), max_digits=15,
                    validators=[django.core.validators.MinValueValidator(Decimal('0'))],
                )),
                ('total', models.DecimalField(
                    decimal_places=2, max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0'))],
                )),
                ('refund', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='items', to='sales.refund',
                )),
                ('original_item', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='refund_items', to='sales.saleitem',
                )),
                ('product', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    to='products.product',
                )),
            ],
            options={'db_table': 'sales_refunditem'},
        ),
        migrations.AddIndex(
            model_name='refunditem',
            index=models.Index(fields=['refund'], name='sales_refunditem_refund_idx'),
        ),
        migrations.AddIndex(
            model_name='refunditem',
            index=models.Index(fields=['original_item'], name='sales_refunditem_item_idx'),
        ),
    ]
