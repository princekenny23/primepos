from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('outlets', '0010_ensure_business_type_column'),
        ('tenants', '0010_rename_tenant_paym_tenant__fbb5c3_idx_tenant_paym_tenant__a27784_idx_and_more'),
        ('sales', '1020_rename_sales_pd_tenant_device_idx_sales_print_tenant__733441_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ConnectorPairingSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('device_id', models.CharField(db_index=True, max_length=100)),
                ('pairing_code', models.CharField(db_index=True, max_length=6)),
                ('channel', models.CharField(default='agent', max_length=20)),
                ('printer_identifier', models.CharField(blank=True, default='', max_length=255)),
                ('expires_at', models.DateTimeField()),
                ('claimed_at', models.DateTimeField(blank=True, null=True)),
                ('issued_api_key', models.CharField(blank=True, default='', max_length=255)),
                ('delivered_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('outlet', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='connector_pairing_sessions', to='outlets.outlet')),
                ('tenant', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='connector_pairing_sessions', to='tenants.tenant')),
            ],
            options={
                'db_table': 'sales_connector_pairing_session',
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='connectorpairingsession',
            index=models.Index(fields=['device_id', 'pairing_code'], name='sales_conne_device__7ef5e5_idx'),
        ),
        migrations.AddIndex(
            model_name='connectorpairingsession',
            index=models.Index(fields=['pairing_code', 'expires_at'], name='sales_conne_pairing_5f5f23_idx'),
        ),
        migrations.AddIndex(
            model_name='connectorpairingsession',
            index=models.Index(fields=['expires_at'], name='sales_conne_expires_3ca774_idx'),
        ),
    ]
