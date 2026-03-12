from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0008_tenant_currency'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('sales', '1015_sale_delivery_required'),
    ]

    operations = [
        migrations.CreateModel(
            name='PrintJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('channel', models.CharField(choices=[('agent', 'Local Print Agent'), ('mobile', 'Mobile Share')], default='agent', max_length=20)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('claimed', 'Claimed'), ('completed', 'Completed'), ('failed', 'Failed'), ('cancelled', 'Cancelled')], default='pending', max_length=20)),
                ('device_id', models.CharField(blank=True, default='', max_length=100)),
                ('printer_identifier', models.CharField(blank=True, default='', max_length=255)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('error_message', models.TextField(blank=True, default='')),
                ('claimed_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('outlet', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='print_jobs', to='tenants.outlet')),
                ('requested_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='requested_print_jobs', to=settings.AUTH_USER_MODEL)),
                ('sale', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='print_jobs', to='sales.sale')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='print_jobs', to='tenants.tenant')),
            ],
            options={
                'db_table': 'sales_printjob',
                'verbose_name': 'Print Job',
                'verbose_name_plural': 'Print Jobs',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['tenant', 'status']),
                    models.Index(fields=['tenant', 'device_id', 'status']),
                    models.Index(fields=['outlet', 'status']),
                    models.Index(fields=['created_at']),
                ],
            },
        ),
    ]
