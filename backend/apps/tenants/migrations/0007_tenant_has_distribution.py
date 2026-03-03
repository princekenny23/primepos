from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0006_tenantpermissions'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenant',
            name='has_distribution',
            field=models.BooleanField(default=False),
        ),
    ]
