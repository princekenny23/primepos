from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('outlets', '0010_ensure_business_type_column'),
    ]

    operations = [
        migrations.AddField(
            model_name='outlet',
            name='distribution_active',
            field=models.BooleanField(default=True),
        ),
    ]
