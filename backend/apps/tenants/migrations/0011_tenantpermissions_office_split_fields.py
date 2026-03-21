from django.db import migrations, models


def forward_fill_office_split_fields(apps, schema_editor):
    TenantPermissions = apps.get_model('tenants', 'TenantPermissions')
    for permission in TenantPermissions.objects.all():
        base_value = bool(getattr(permission, 'allow_office_hr', True))
        permission.allow_office_users = base_value
        permission.allow_office_staff = base_value
        permission.allow_office_shift_management = base_value
        permission.save(update_fields=[
            'allow_office_users',
            'allow_office_staff',
            'allow_office_shift_management',
        ])


def reverse_fill_office_hr(apps, schema_editor):
    TenantPermissions = apps.get_model('tenants', 'TenantPermissions')
    for permission in TenantPermissions.objects.all():
        merged = bool(permission.allow_office_users and permission.allow_office_staff and permission.allow_office_shift_management)
        permission.allow_office_hr = merged
        permission.save(update_fields=['allow_office_hr'])


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0010_rename_tenant_paym_tenant__fbb5c3_idx_tenant_paym_tenant__a27784_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenantpermissions',
            name='allow_office_shift_management',
            field=models.BooleanField(default=True, help_text='Shift management'),
        ),
        migrations.AddField(
            model_name='tenantpermissions',
            name='allow_office_staff',
            field=models.BooleanField(default=True, help_text='Staff management'),
        ),
        migrations.AddField(
            model_name='tenantpermissions',
            name='allow_office_users',
            field=models.BooleanField(default=True, help_text='User management'),
        ),
        migrations.RunPython(forward_fill_office_split_fields, reverse_fill_office_hr),
    ]
