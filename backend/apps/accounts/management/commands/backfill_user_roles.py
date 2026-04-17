"""
Management command to backfill staff roles for users who don't have one assigned.
Run: python manage.py backfill_user_roles [--dry-run] [--tenant-id=1]
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.accounts.models import User, create_default_roles_for_tenant
from apps.staff.models import Staff, Role
from apps.tenants.models import Tenant


class Command(BaseCommand):
    help = "Backfill staff roles for users without role assignments"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without making them',
        )
        parser.add_argument(
            '--tenant-id',
            type=int,
            help='Backfill only specific tenant (by ID)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        tenant_filter_id = options.get('tenant_id')

        if dry_run:
            self.stdout.write(self.style.WARNING('🔍 DRY RUN MODE - No changes will be made\n'))

        # Get tenants to process
        tenants = Tenant.objects.all()
        if tenant_filter_id:
            tenants = tenants.filter(id=tenant_filter_id)
            
        if not tenants.exists():
            self.stdout.write(self.style.ERROR('No tenants found'))
            return

        total_updated = 0
        total_roles_missing = 0

        with transaction.atomic():
            for tenant in tenants:
                self.stdout.write(f"\n📌 Processing tenant: {tenant.name} (ID: {tenant.id})")

                # Ensure default roles exist
                existing_roles = Role.objects.filter(tenant=tenant, is_active=True)
                if not existing_roles.exists():
                    self.stdout.write(f"  ⚠️  No roles found, creating defaults...")
                    if not dry_run:
                        create_default_roles_for_tenant(tenant)
                        self.stdout.write(self.style.SUCCESS("  ✓ Created default roles"))
                    else:
                        self.stdout.write("  (Would create default roles)")

                # Find staff without roles
                staff_without_role = Staff.objects.filter(
                    tenant=tenant,
                    role__isnull=True,
                ).select_related('user')

                if not staff_without_role.exists():
                    self.stdout.write("  ✓ All staff have roles assigned")
                    continue

                self.stdout.write(f"  Found {staff_without_role.count()} staff without roles")

                # Assign roles based on user.role
                role_keyword_map = {
                    'admin': 'admin',
                    'manager': 'manager',
                    'cashier': 'cashier',
                    'staff': 'staff',
                }

                for staff in staff_without_role:
                    user = staff.user
                    role_keyword = role_keyword_map.get((user.role or '').lower(), 'staff')

                    # Find matching role
                    matched_role = Role.objects.filter(
                        tenant=tenant,
                        is_active=True,
                        name__icontains=role_keyword,
                    ).first()

                    # Fallback to Admin if not found
                    if not matched_role:
                        matched_role = Role.objects.filter(
                            tenant=tenant,
                            is_active=True,
                            name__icontains='admin',
                        ).first()

                    if matched_role:
                        if not dry_run:
                            staff.role = matched_role
                            staff.save(update_fields=['role'])
                        self.stdout.write(
                            f"    ✓ {user.email} → {matched_role.name} role"
                        )
                        total_updated += 1
                    else:
                        self.stdout.write(
                            self.style.ERROR(
                                f"    ✗ {user.email} - NO ROLE FOUND for tenant!"
                            )
                        )
                        total_roles_missing += 1

        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(self.style.SUCCESS(f"✓ Updated {total_updated} staff roles"))
        if total_roles_missing > 0:
            self.stdout.write(
                self.style.ERROR(f"✗ {total_roles_missing} staff still have no role")
            )
        self.stdout.write("=" * 50)
