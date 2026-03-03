from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0002_customer_credit_enabled_customer_credit_limit_and_more'),
        ('distribution', '0002_rename_distributio_tenant__2def2b_idx_distributio_tenant__f9101d_idx_and_more'),
        ('outlets', '0009_outlet_business_type_nullable'),
        ('products', '0019_alter_product_alcohol_percentage_and_more'),
        ('sales', '1014_alter_sale_is_void_alter_sale_void_reason_and_more'),
        ('tenants', '0007_tenant_has_distribution'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='vehicle',
            name='fuel_type',
            field=models.CharField(choices=[('diesel', 'Diesel'), ('petrol', 'Petrol'), ('electric', 'Electric'), ('hybrid', 'Hybrid')], default='diesel', max_length=20),
        ),
        migrations.AddField(
            model_name='vehicle',
            name='status',
            field=models.CharField(choices=[('available', 'Available'), ('on_trip', 'On Trip'), ('maintenance', 'Maintenance')], default='available', max_length=20),
        ),
        migrations.AddIndex(
            model_name='vehicle',
            index=models.Index(fields=['status'], name='distributio_status_306766_idx'),
        ),
        migrations.AddIndex(
            model_name='vehicle',
            index=models.Index(fields=['tenant', 'status'], name='distributio_tenant__8e309e_idx'),
        ),
        migrations.CreateModel(
            name='Driver',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('phone', models.CharField(blank=True, max_length=30)),
                ('license_number', models.CharField(max_length=100)),
                ('id_number', models.CharField(blank=True, max_length=100)),
                ('status', models.CharField(choices=[('available', 'Available'), ('on_trip', 'On Trip'), ('inactive', 'Inactive')], default='available', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fleet_drivers', to='tenants.tenant')),
            ],
            options={
                'db_table': 'distribution_driver',
                'ordering': ['name'],
                'unique_together': {('tenant', 'license_number')},
            },
        ),
        migrations.AddIndex(
            model_name='driver',
            index=models.Index(fields=['tenant'], name='distributio_tenant__dbfa8c_idx'),
        ),
        migrations.AddIndex(
            model_name='driver',
            index=models.Index(fields=['status'], name='distributio_status_d052bc_idx'),
        ),
        migrations.AddIndex(
            model_name='driver',
            index=models.Index(fields=['tenant', 'status'], name='distributio_tenant__fe405a_idx'),
        ),
        migrations.CreateModel(
            name='DeliveryOrder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('delivery_address', models.TextField(blank=True)),
                ('delivery_status', models.CharField(choices=[('pending', 'Pending'), ('assigned', 'Assigned'), ('in_transit', 'In Transit'), ('delivered', 'Delivered'), ('cancelled', 'Cancelled')], default='pending', max_length=20)),
                ('trip_start_time', models.DateTimeField(blank=True, null=True)),
                ('trip_end_time', models.DateTimeField(blank=True, null=True)),
                ('proof_of_delivery', models.FileField(blank=True, null=True, upload_to='distribution/pod/')),
                ('reservation_released_at', models.DateTimeField(blank=True, null=True)),
                ('reserved_deducted_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_driver', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='delivery_orders', to='distribution.driver')),
                ('assigned_vehicle', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='delivery_orders', to='distribution.vehicle')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_delivery_orders', to=settings.AUTH_USER_MODEL)),
                ('customer', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='delivery_orders', to='customers.customer')),
                ('sales_order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='delivery_orders', to='sales.sale')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='delivery_orders', to='tenants.tenant')),
                ('warehouse', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='delivery_orders', to='outlets.outlet')),
            ],
            options={
                'db_table': 'distribution_delivery_order',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='deliveryorder',
            index=models.Index(fields=['tenant'], name='distributio_tenant__114928_idx'),
        ),
        migrations.AddIndex(
            model_name='deliveryorder',
            index=models.Index(fields=['delivery_status'], name='distributio_deliver_e7ce05_idx'),
        ),
        migrations.AddIndex(
            model_name='deliveryorder',
            index=models.Index(fields=['tenant', 'delivery_status'], name='distributio_tenant__1cc704_idx'),
        ),
        migrations.AddIndex(
            model_name='deliveryorder',
            index=models.Index(fields=['sales_order'], name='distributio_sales_o_d5fa1d_idx'),
        ),
        migrations.AddIndex(
            model_name='deliveryorder',
            index=models.Index(fields=['warehouse'], name='distributio_warehou_c7f3e0_idx'),
        ),
        migrations.CreateModel(
            name='DeliveryOrderItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.PositiveIntegerField(default=1)),
                ('is_released', models.BooleanField(default=False)),
                ('is_deducted', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('delivery_order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='distribution.deliveryorder')),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='delivery_order_items', to='products.product')),
                ('sale_item', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='delivery_order_items', to='sales.saleitem')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='delivery_order_items', to='tenants.tenant')),
            ],
            options={
                'db_table': 'distribution_delivery_order_item',
            },
        ),
        migrations.AddIndex(
            model_name='deliveryorderitem',
            index=models.Index(fields=['tenant'], name='distributio_tenant__8ca1ad_idx'),
        ),
        migrations.AddIndex(
            model_name='deliveryorderitem',
            index=models.Index(fields=['delivery_order'], name='distributio_deliver_3f7640_idx'),
        ),
        migrations.AddIndex(
            model_name='deliveryorderitem',
            index=models.Index(fields=['product'], name='distributio_product_8e8fe1_idx'),
        ),
        migrations.AddIndex(
            model_name='deliveryorderitem',
            index=models.Index(fields=['is_released', 'is_deducted'], name='distributio_is_rele_750ad3_idx'),
        ),
        migrations.CreateModel(
            name='Trip',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fuel_cost', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('distance_km', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_cost', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('profit', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('delivery_order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='trips', to='distribution.deliveryorder')),
                ('driver', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='trips', to='distribution.driver')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='trips', to='tenants.tenant')),
                ('vehicle', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='trips', to='distribution.vehicle')),
            ],
            options={
                'db_table': 'distribution_trip',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='trip',
            index=models.Index(fields=['tenant'], name='distributio_tenant__58ee7b_idx'),
        ),
        migrations.AddIndex(
            model_name='trip',
            index=models.Index(fields=['delivery_order'], name='distributio_deliver_a3d579_idx'),
        ),
        migrations.AddIndex(
            model_name='trip',
            index=models.Index(fields=['vehicle'], name='distributio_vehicle_934762_idx'),
        ),
        migrations.AddIndex(
            model_name='trip',
            index=models.Index(fields=['driver'], name='distributio_driver__385378_idx'),
        ),
    ]
