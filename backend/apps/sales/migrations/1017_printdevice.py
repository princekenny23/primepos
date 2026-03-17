from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('outlets', '0006_outlet_business_type_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('sales', '1016_printjob'),
    ]

    operations = [
        migrations.CreateModel(
            name='PrintDevice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('device_id', models.CharField(max_length=100)),
                ('name', models.CharField(blank=True, default='', max_length=120)),
                ('channel', models.CharField(choices=[('agent', 'Local Print Agent'), ('mobile', 'Mobile Share')], default='agent', max_length=20)),
                ('printer_identifier', models.CharField(blank=True, default='', max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('last_seen_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('outlet', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='print_devices', to='outlets.outlet')),
                ('registered_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='registered_print_devices', to=settings.AUTH_USER_MODEL)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='print_devices', to='tenants.tenant')),
            ],
            options={
                'db_table': 'sales_printdevice',
                'verbose_name': 'Print Device',
                'verbose_name_plural': 'Print Devices',
                'ordering': ['-updated_at'],
                'unique_together': {('tenant', 'device_id')},
            },
        ),
        migrations.AddIndex(
            model_name='printdevice',
            index=models.Index(fields=['tenant', 'device_id'], name='sales_pd_tenant_device_idx'),
        ),
        migrations.AddIndex(
            model_name='printdevice',
            index=models.Index(fields=['tenant', 'outlet', 'is_active'], name='sales_pd_tenant_outlet_active_idx'),
        ),
        migrations.AddIndex(
            model_name='printdevice',
            index=models.Index(fields=['last_seen_at'], name='sales_pd_last_seen_idx'),
        ),
    ]
