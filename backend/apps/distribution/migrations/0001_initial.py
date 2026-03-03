from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('sales', '1014_alter_sale_is_void_alter_sale_void_reason_and_more'),
        ('tenants', '0006_tenantpermissions'),
    ]

    operations = [
        migrations.CreateModel(
            name='Vehicle',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('plate_number', models.CharField(max_length=50)),
                ('make', models.CharField(blank=True, max_length=100)),
                ('model', models.CharField(blank=True, max_length=100)),
                ('capacity_kg', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='distribution_vehicles', to='tenants.tenant')),
            ],
            options={
                'db_table': 'distribution_vehicle',
                'ordering': ['plate_number'],
                'unique_together': {('tenant', 'plate_number')},
            },
        ),
        migrations.CreateModel(
            name='DriverProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('license_number', models.CharField(blank=True, max_length=100)),
                ('phone', models.CharField(blank=True, max_length=30)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='distribution_drivers', to='tenants.tenant')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='driver_profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'distribution_driver_profile',
                'ordering': ['user__email'],
            },
        ),
        migrations.CreateModel(
            name='Delivery',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('pending_dispatch', 'Pending Dispatch'), ('in_transit', 'In Transit'), ('delivered', 'Delivered'), ('cancelled', 'Cancelled')], default='draft', max_length=30)),
                ('dispatch_notes', models.TextField(blank=True)),
                ('dispatched_at', models.DateTimeField(blank=True, null=True)),
                ('delivered_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_deliveries', to=settings.AUTH_USER_MODEL)),
                ('driver', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_deliveries', to=settings.AUTH_USER_MODEL)),
                ('sale', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deliveries', to='sales.sale')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deliveries', to='tenants.tenant')),
                ('vehicle', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deliveries', to='distribution.vehicle')),
            ],
            options={
                'db_table': 'distribution_delivery',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='VehicleLocation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('latitude', models.DecimalField(decimal_places=7, max_digits=10)),
                ('longitude', models.DecimalField(decimal_places=7, max_digits=10)),
                ('speed_kph', models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True)),
                ('recorded_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('delivery', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='locations', to='distribution.delivery')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='vehicle_locations', to='tenants.tenant')),
                ('vehicle', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='locations', to='distribution.vehicle')),
            ],
            options={
                'db_table': 'distribution_vehicle_location',
                'ordering': ['-recorded_at'],
            },
        ),
        migrations.AddIndex(
            model_name='vehicle',
            index=models.Index(fields=['tenant'], name='distributio_tenant__9a0ee5_idx'),
        ),
        migrations.AddIndex(
            model_name='vehicle',
            index=models.Index(fields=['is_active'], name='distributio_is_acti_3f9ca5_idx'),
        ),
        migrations.AddIndex(
            model_name='vehicle',
            index=models.Index(fields=['tenant', 'is_active'], name='distributio_tenant__12ad4c_idx'),
        ),
        migrations.AddIndex(
            model_name='driverprofile',
            index=models.Index(fields=['tenant'], name='distributio_tenant__336136_idx'),
        ),
        migrations.AddIndex(
            model_name='driverprofile',
            index=models.Index(fields=['is_active'], name='distributio_is_acti_9ba334_idx'),
        ),
        migrations.AddIndex(
            model_name='driverprofile',
            index=models.Index(fields=['tenant', 'is_active'], name='distributio_tenant__2ea90f_idx'),
        ),
        migrations.AddIndex(
            model_name='delivery',
            index=models.Index(fields=['tenant'], name='distributio_tenant__2def2b_idx'),
        ),
        migrations.AddIndex(
            model_name='delivery',
            index=models.Index(fields=['sale'], name='distributio_sale_id_37026d_idx'),
        ),
        migrations.AddIndex(
            model_name='delivery',
            index=models.Index(fields=['status'], name='distributio_status_b39f50_idx'),
        ),
        migrations.AddIndex(
            model_name='delivery',
            index=models.Index(fields=['driver'], name='distributio_driver__e5336c_idx'),
        ),
        migrations.AddIndex(
            model_name='delivery',
            index=models.Index(fields=['vehicle'], name='distributio_vehicle_0ac3d1_idx'),
        ),
        migrations.AddIndex(
            model_name='delivery',
            index=models.Index(fields=['tenant', 'status'], name='distributio_tenant__8c3208_idx'),
        ),
        migrations.AddIndex(
            model_name='vehiclelocation',
            index=models.Index(fields=['tenant'], name='distributio_tenant__5db5c2_idx'),
        ),
        migrations.AddIndex(
            model_name='vehiclelocation',
            index=models.Index(fields=['vehicle'], name='distributio_vehicle_4c39aa_idx'),
        ),
        migrations.AddIndex(
            model_name='vehiclelocation',
            index=models.Index(fields=['delivery'], name='distributio_delivery_1e15fd_idx'),
        ),
        migrations.AddIndex(
            model_name='vehiclelocation',
            index=models.Index(fields=['recorded_at'], name='distributio_recorde_d8daf2_idx'),
        ),
        migrations.AddIndex(
            model_name='vehiclelocation',
            index=models.Index(fields=['tenant', 'recorded_at'], name='distributio_tenant__d12d0c_idx'),
        ),
    ]
