from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0011_tenantpermissions_office_split_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenantpermissions',
            name='allow_storefront',
            field=models.BooleanField(default=True, help_text='Enable Storefront app'),
        ),
        migrations.AddField(
            model_name='tenantpermissions',
            name='allow_storefront_orders',
            field=models.BooleanField(default=True, help_text='Manage storefront orders'),
        ),
        migrations.AddField(
            model_name='tenantpermissions',
            name='allow_storefront_reports',
            field=models.BooleanField(default=True, help_text='View storefront reports'),
        ),
        migrations.AddField(
            model_name='tenantpermissions',
            name='allow_storefront_settings',
            field=models.BooleanField(default=True, help_text='Manage storefront settings'),
        ),
        migrations.AddField(
            model_name='tenantpermissions',
            name='allow_storefront_sites',
            field=models.BooleanField(default=True, help_text='Manage storefront sites'),
        ),
    ]
