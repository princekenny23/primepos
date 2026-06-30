# Generated manually for adding payment_lines field to Sale
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1027_alter_refund_options_alter_refunditem_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='sale',
            name='payment_lines',
            field=models.JSONField(blank=True, default=list, null=True),
        ),
    ]
