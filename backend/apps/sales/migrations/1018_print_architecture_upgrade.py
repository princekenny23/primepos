from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1017_printdevice'),
    ]

    operations = [
        migrations.CreateModel(
            name='Printer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('printer_type', models.CharField(choices=[('receipt', 'Receipt'), ('kitchen', 'Kitchen'), ('bar', 'Bar')], default='receipt', max_length=20)),
                ('connection_type', models.CharField(choices=[('usb', 'USB'), ('network', 'Network')], default='usb', max_length=20)),
                ('identifier', models.CharField(blank=True, default='', max_length=255)),
                ('is_default', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('device', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='printers', to='sales.printdevice')),
                ('outlet', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cloud_printers', to='outlets.outlet')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cloud_printers', to='tenants.tenant')),
            ],
            options={
                'verbose_name': 'Cloud Printer',
                'verbose_name_plural': 'Cloud Printers',
                'db_table': 'sales_printer',
                'ordering': ['-is_default', 'name'],
                'unique_together': {('outlet', 'device', 'name')},
            },
        ),
        migrations.AddField(
            model_name='printjob',
            name='attempts',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='printjob',
            name='max_attempts',
            field=models.PositiveIntegerField(default=3),
        ),
        migrations.AddField(
            model_name='printjob',
            name='printer',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='print_jobs', to='sales.printer'),
        ),
        migrations.AddField(
            model_name='printjob',
            name='printer_type',
            field=models.CharField(choices=[('receipt', 'Receipt'), ('kitchen', 'Kitchen'), ('bar', 'Bar')], default='receipt', max_length=20),
        ),
        migrations.AlterField(
            model_name='printjob',
            name='status',
            field=models.CharField(choices=[('pending', 'Pending'), ('claimed', 'Claimed'), ('printing', 'Printing'), ('completed', 'Completed'), ('failed', 'Failed'), ('failed_permanent', 'Failed Permanent')], default='pending', max_length=20),
        ),
        migrations.AddField(
            model_name='printdevice',
            name='api_key_hash',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='printdevice',
            name='printer_status',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddIndex(
            model_name='printjob',
            index=models.Index(fields=['tenant', 'outlet', 'printer_type', 'status'], name='sales_pj_tenant_outlet_ptype_status_idx'),
        ),
        migrations.AddIndex(
            model_name='printdevice',
            index=models.Index(fields=['is_active'], name='sales_pd_is_active_idx'),
        ),
        migrations.AddIndex(
            model_name='printer',
            index=models.Index(fields=['tenant', 'outlet', 'printer_type', 'is_active'], name='sales_pr_tenant_outlet_type_active_idx'),
        ),
        migrations.AddIndex(
            model_name='printer',
            index=models.Index(fields=['device', 'is_active'], name='sales_pr_device_active_idx'),
        ),
    ]
