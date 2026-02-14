from django.db import migrations, models
from decimal import Decimal
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1003_merge_20260207_0646'),
    ]

    operations = [
        migrations.AddField(
            model_name='sale',
            name='cash_amount',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0'))]),
        ),
        migrations.AddField(
            model_name='sale',
            name='card_amount',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0'))]),
        ),
        migrations.AddField(
            model_name='sale',
            name='mobile_amount',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0'))]),
        ),
        migrations.AddField(
            model_name='sale',
            name='bank_transfer_amount',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0'))]),
        ),
        migrations.AddField(
            model_name='sale',
            name='other_amount',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0'))]),
        ),
        migrations.AddField(
            model_name='sale',
            name='tab_amount',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0'))]),
        ),
        migrations.AddField(
            model_name='sale',
            name='credit_amount',
            field=models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0'))]),
        ),
        migrations.AlterField(
            model_name='sale',
            name='payment_status',
            field=models.CharField(default='unpaid', max_length=20, choices=[('unpaid', 'Unpaid'), ('partially_paid', 'Partially Paid'), ('paid', 'Paid'), ('overdue', 'Overdue')]),
        ),
    ]
