# Generated migration for Till tracking in Sales

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('outlets', '0001_initial'),  # Adjust to your latest outlets migration
        ('sales', '0001_initial'),  # Adjust to your latest sales migration
    ]

    operations = [
        # Add till FK to Sale model
        migrations.AddField(
            model_name='sale',
            name='till',
            field=models.ForeignKey(
                blank=True,
                help_text='Till/POS terminal used for this sale',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='sales',
                to='outlets.till'
            ),
        ),
        
        # Add index for till filtering
        migrations.AddIndex(
            model_name='sale',
            index=models.Index(fields=['till'], name='sales_till_idx'),
        ),
    ]
