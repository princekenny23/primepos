from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0012_tenantpermissions_storefront_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenant',
            name='domain',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='tenant',
            name='subdomain',
            field=models.SlugField(blank=True, max_length=63, null=True, unique=True),
        ),
    ]
