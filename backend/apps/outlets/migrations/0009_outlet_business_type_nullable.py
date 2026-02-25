# Generated migration to make outlet business_type nullable and enable tenant inheritance

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('outlets', '0008_merge_20260224_1051'),
    ]

    operations = [
        migrations.AlterField(
            model_name='outlet',
            name='business_type',
            field=models.CharField(
                blank=True,
                choices=[('wholesale_and_retail', 'Wholesale and Retail'), ('restaurant', 'Restaurant'), ('bar', 'Bar')],
                help_text='Business type for this outlet (inherits from tenant if not set)',
                max_length=30,
                null=True,
            ),
        ),
    ]
