from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
from django.core.validators import MinValueValidator


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0008_ensure_has_distribution_column'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TenantPaymentRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12, validators=[MinValueValidator(Decimal('0.01'))])),
                ('reason', models.CharField(max_length=255)),
                ('notes', models.TextField(blank=True)),
                ('payment_date', models.DateTimeField(default=django.utils.timezone.now)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('recorded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tenant_payment_records', to=settings.AUTH_USER_MODEL)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payment_records', to='tenants.tenant')),
            ],
            options={
                'verbose_name': 'Tenant Payment Record',
                'verbose_name_plural': 'Tenant Payment Records',
                'db_table': 'tenant_payment_records',
                'ordering': ['-payment_date', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='tenantpaymentrecord',
            index=models.Index(fields=['tenant'], name='tenant_paym_tenant__fbb5c3_idx'),
        ),
        migrations.AddIndex(
            model_name='tenantpaymentrecord',
            index=models.Index(fields=['payment_date'], name='tenant_paym_payment_f6f5fd_idx'),
        ),
    ]
