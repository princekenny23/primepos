"""
Migration: Per-outlet role support for Staff
---------------------------------------------
Changes:
  1.  Staff.user: OneToOneField  →  ForeignKey (unique_together with tenant)
  2.  New StaffOutletRole through model (staff × outlet × role)
  3.  Staff.outlets: plain M2M  →  M2M through StaffOutletRole
  4.  Data preservation: existing outlet assignments are copied to StaffOutletRole
      (the staff's current role is used as the outlet-level role for migrated rows)
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def migrate_outlet_roles(apps, schema_editor):
    """Copy old staff_staff_outlets rows into the new StaffOutletRole table."""
    Staff = apps.get_model('staff', 'Staff')
    StaffOutletRole = apps.get_model('staff', 'StaffOutletRole')

    for staff in Staff.objects.prefetch_related('outlets').select_related('role').all():
        for outlet in staff.outlets.all():
            StaffOutletRole.objects.get_or_create(
                staff=staff,
                outlet=outlet,
                defaults={'role': staff.role},
            )


def reverse_migrate_outlet_roles(apps, schema_editor):
    """Reverse: delete all StaffOutletRole rows (outlets M2M will be restored)."""
    apps.get_model('staff', 'StaffOutletRole').objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('staff', '0002_alter_staff_options'),
        ('outlets', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── 1. Change user field from OneToOneField → ForeignKey ──────────────
        migrations.AlterField(
            model_name='staff',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='staff_profiles',
                to=settings.AUTH_USER_MODEL,
            ),
        ),

        # ── 2. Enforce one Staff profile per user per tenant ──────────────────
        migrations.AlterUniqueTogether(
            name='staff',
            unique_together={('user', 'tenant')},
        ),

        # ── 3. Create StaffOutletRole through model ───────────────────────────
        migrations.CreateModel(
            name='StaffOutletRole',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                (
                    'staff',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='outlet_roles',
                        to='staff.staff',
                    ),
                ),
                (
                    'outlet',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='staff_outlet_roles',
                        to='outlets.outlet',
                    ),
                ),
                (
                    'role',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='staff_outlet_assignments',
                        to='staff.role',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Staff Outlet Role',
                'verbose_name_plural': 'Staff Outlet Roles',
                'db_table': 'staff_outlet_role',
            },
        ),
        migrations.AlterUniqueTogether(
            name='staffoutletrole',
            unique_together={('staff', 'outlet')},
        ),
        migrations.AddIndex(
            model_name='staffoutletrole',
            index=models.Index(fields=['staff'], name='staff_outle_staff_i_idx'),
        ),
        migrations.AddIndex(
            model_name='staffoutletrole',
            index=models.Index(fields=['outlet'], name='staff_outle_outlet_idx'),
        ),

        # ── 4. Migrate existing outlet assignments → StaffOutletRole ──────────
        #       (must run BEFORE the old M2M field is removed)
        migrations.RunPython(migrate_outlet_roles, reverse_migrate_outlet_roles),

        # ── 5. Remove the old direct M2M outlets field ───────────────────────
        migrations.RemoveField(
            model_name='staff',
            name='outlets',
        ),

        # ── 6. Re-add outlets as through-model M2M ────────────────────────────
        migrations.AddField(
            model_name='staff',
            name='outlets',
            field=models.ManyToManyField(
                blank=True,
                related_name='staff_members',
                through='staff.StaffOutletRole',
                to='outlets.outlet',
            ),
        ),
    ]
