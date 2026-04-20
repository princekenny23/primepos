from django.db import migrations, models
import django.db.models.deletion


PERMISSION_DEFINITIONS = [
    ('dashboard.view', 'View Dashboard', 'dashboard', 'dashboard'),
    ('sales.view', 'View Sales', 'sales', 'sales'),
    ('sales.create', 'Create Sales', 'sales', 'sales'),
    ('inventory.view', 'View Inventory', 'inventory', 'inventory'),
    ('inventory.manage', 'Manage Inventory', 'inventory', 'inventory'),
    ('products.manage', 'Manage Products', 'inventory', 'products'),
    ('customers.manage', 'Manage Customers', 'sales', 'customers'),
    ('reports.view', 'View Reports', 'reports', 'reports'),
    ('staff.manage', 'Manage Staff', 'office', 'staff'),
    ('settings.manage', 'Manage Settings', 'settings', 'settings'),
    ('distribution.manage', 'Manage Distribution', 'distribution', 'distribution'),
    ('storefront.manage', 'Manage Storefront', 'storefront', 'storefront'),
    ('pos.retail', 'Access Retail POS', 'pos', 'retail'),
    ('pos.restaurant', 'Access Restaurant POS', 'pos', 'restaurant'),
    ('pos.bar', 'Access Bar POS', 'pos', 'bar'),
    ('outlet.switch', 'Switch Outlets', 'office', 'outlet'),
    ('users.create', 'Create Users', 'office', 'users'),
    ('users.update', 'Update Users', 'office', 'users'),
    ('users.delete', 'Delete Users', 'office', 'users'),
    ('roles.assign', 'Assign Roles', 'office', 'roles'),
    ('roles.manage', 'Manage Roles', 'office', 'roles'),
]


def seed_and_backfill_permissions(apps, schema_editor):
    PermissionDefinition = apps.get_model('staff', 'PermissionDefinition')
    Role = apps.get_model('staff', 'Role')
    RolePermission = apps.get_model('staff', 'RolePermission')

    permission_by_code = {}
    for code, name, module, feature in PERMISSION_DEFINITIONS:
        perm, _ = PermissionDefinition.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'module': module,
                'feature': feature,
                'description': '',
                'is_active': True,
            },
        )
        permission_by_code[code] = perm

    flag_to_codes = {
        'can_dashboard': {'dashboard.view'},
        'can_sales': {'sales.view', 'sales.create'},
        'can_inventory': {'inventory.view', 'inventory.manage'},
        'can_products': {'products.manage'},
        'can_customers': {'customers.manage'},
        'can_reports': {'reports.view'},
        'can_staff': {'staff.manage', 'users.create', 'users.update', 'users.delete', 'roles.assign'},
        'can_settings': {'settings.manage', 'roles.manage'},
        'can_distribution': {'distribution.manage'},
        'can_storefront': {'storefront.manage'},
        'can_pos_retail': {'pos.retail'},
        'can_pos_restaurant': {'pos.restaurant'},
        'can_pos_bar': {'pos.bar'},
        'can_switch_outlet': {'outlet.switch'},
    }

    for role in Role.objects.all():
        codes = set()
        for flag, mapped_codes in flag_to_codes.items():
            if getattr(role, flag, False):
                codes.update(mapped_codes)

        for code in codes:
            perm = permission_by_code.get(code)
            if not perm:
                continue
            RolePermission.objects.get_or_create(
                role_id=role.id,
                permission_id=perm.id,
                defaults={'allowed': True},
            )


def noop_reverse(apps, schema_editor):
    return


class Migration(migrations.Migration):

    dependencies = [
        ('staff', '0006_add_distribution_and_pos_permissions_to_role'),
    ]

    operations = [
        migrations.CreateModel(
            name='PermissionDefinition',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=100, unique=True)),
                ('name', models.CharField(max_length=150)),
                ('module', models.CharField(max_length=50)),
                ('feature', models.CharField(blank=True, max_length=80)),
                ('description', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Permission Definition',
                'verbose_name_plural': 'Permission Definitions',
                'db_table': 'staff_permission_definition',
                'ordering': ['module', 'code'],
            },
        ),
        migrations.CreateModel(
            name='RolePermission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('allowed', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('permission', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='role_permissions', to='staff.permissiondefinition')),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='role_permissions', to='staff.role')),
            ],
            options={
                'verbose_name': 'Role Permission',
                'verbose_name_plural': 'Role Permissions',
                'db_table': 'staff_role_permission',
                'unique_together': {('role', 'permission')},
            },
        ),
        migrations.AddField(
            model_name='role',
            name='permissions',
            field=models.ManyToManyField(blank=True, related_name='roles', through='staff.RolePermission', to='staff.permissiondefinition'),
        ),
        migrations.AddIndex(
            model_name='permissiondefinition',
            index=models.Index(fields=['module'], name='staff_permi_module_bfda2d_idx'),
        ),
        migrations.AddIndex(
            model_name='permissiondefinition',
            index=models.Index(fields=['is_active'], name='staff_permi_is_acti_8f90ca_idx'),
        ),
        migrations.AddIndex(
            model_name='rolepermission',
            index=models.Index(fields=['role'], name='staff_role__role_id_5c2d2b_idx'),
        ),
        migrations.AddIndex(
            model_name='rolepermission',
            index=models.Index(fields=['permission'], name='staff_role__permiss_d0f388_idx'),
        ),
        migrations.AddIndex(
            model_name='rolepermission',
            index=models.Index(fields=['allowed'], name='staff_role__allowed_47ddd5_idx'),
        ),
        migrations.RunPython(seed_and_backfill_permissions, noop_reverse),
    ]
