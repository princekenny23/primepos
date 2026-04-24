"""
Phase 4: Cash-up and variance accountability.
- Adds CashMovement model for deposit/withdrawal tracking
- Adds closed_by, variance_reason, variance_approved_by fields to Shift
- Updates system_total formula to include cash movements
"""
from django.conf import settings
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('shifts', '0003_remove_shift_unique_together'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Add new fields to Shift model
        migrations.AddField(
            model_name='shift',
            name='closed_by',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='closed_shifts', to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='shift',
            name='variance_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='shift',
            name='variance_approved_by',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='variance_approved_shifts', to=settings.AUTH_USER_MODEL,
            ),
        ),

        # Create CashMovement model
        migrations.CreateModel(
            name='CashMovement',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('movement_type', models.CharField(
                    choices=[
                        ('deposit', 'Deposit'),
                        ('withdrawal', 'Withdrawal'),
                        ('float_add', 'Float Add'),
                        ('paid_out', 'Paid Out'),
                    ],
                    max_length=20,
                )),
                ('amount', models.DecimalField(
                    decimal_places=2, max_digits=10,
                    validators=[django.core.validators.MinValueValidator(Decimal('0.01'))],
                )),
                ('note', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('shift', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='cash_movements', to='shifts.shift',
                )),
                ('recorded_by', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='cash_movements_recorded', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'shifts_cashmovement', 'ordering': ['created_at']},
        ),

        # Add indexes for CashMovement
        migrations.AddIndex(
            model_name='cashmovement',
            index=models.Index(fields=['shift'], name='shifts_cashmovement_shift_idx'),
        ),
        migrations.AddIndex(
            model_name='cashmovement',
            index=models.Index(fields=['movement_type'], name='shifts_cashmovement_type_idx'),
        ),
        migrations.AddIndex(
            model_name='cashmovement',
            index=models.Index(fields=['created_at'], name='shifts_cashmovement_created_idx'),
        ),
    ]
