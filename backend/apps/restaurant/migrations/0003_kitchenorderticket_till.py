# Generated migration for Till tracking in Restaurant

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('outlets', '0001_initial'),
        ('restaurant', '0002_kitchenorderticket'),
    ]

    operations = [
        # Add till FK to KitchenOrderTicket model
        migrations.AddField(
            model_name='kitchenorderticket',
            name='till',
            field=models.ForeignKey(
                blank=True,
                help_text='Till/POS terminal that created this order',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='kitchen_orders',
                to='outlets.till'
            ),
        ),
        
        # Add index for till filtering
        migrations.AddIndex(
            model_name='kitchenorderticket',
            index=models.Index(fields=['till'], name='restaurant_till_idx'),
        ),
    ]
