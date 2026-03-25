"""
Management command to migrate existing users to the new User → Staff → Role system
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.accounts.models import User, create_default_roles_for_tenant
from apps.staff.models import Staff, Role
from apps.tenants.models import Tenant


class Command(BaseCommand):
    help = 'Migrate existing users to the User → Staff → Role linkage system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run the command without making any changes',
        )
        parser.add_argument(
            '--create-roles',
            action='store_true',
            help='Create default roles for all tenants',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        create_roles = options['create_roles']

        if dry_run:
            self.stdout.write(self.style.WARNING('Running in DRY RUN mode - no changes will be made'))

        # Step 1: Create default roles for all tenants
        if create_roles:
            self.stdout.write('Creating default roles for all tenants...')
            tenants = Tenant.objects.all()
            roles_created = 0
            
            for tenant in tenants:
                self.stdout.write(f'  Processing tenant: {tenant.name}')
                if not dry_run:
                    roles = create_default_roles_for_tenant(tenant)
                    roles_created += len(roles)
                    self.stdout.write(self.style.SUCCESS(f'    Created {len(roles)} roles for {tenant.name}'))
                else:
                    self.stdout.write(f'    Would create default roles for {tenant.name}')
            
            self.stdout.write(self.style.SUCCESS(f'Total roles created: {roles_created}'))

        # Step 2: Create Staff profiles for users without one
        self.stdout.write('\nCreating Staff profiles for users...')
        users = User.objects.filter(tenant__isnull=False, is_superuser=False)
        staff_created = 0
        staff_skipped = 0
        
        for user in users:
            try:
                # Check if staff profile exists
                if user.staff_profiles.filter(tenant=user.tenant).exists():
                    staff_skipped += 1
                    continue
                
                if not dry_run:
                    Staff.objects.create(
                        user=user,
                        tenant=user.tenant,
                        is_active=user.is_active
                    )
                    staff_created += 1
                    self.stdout.write(f'  Created staff profile for: {user.email}')
                else:
                    self.stdout.write(f'  Would create staff profile for: {user.email}')
                    staff_created += 1
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  Error creating staff for {user.email}: {str(e)}'))

        self.stdout.write(self.style.SUCCESS(f'Staff profiles created: {staff_created}'))
        self.stdout.write(f'Staff profiles skipped (already exist): {staff_skipped}')

        # Step 3: Assign roles to staff based on user.role
        self.stdout.write('\nAssigning roles to staff members...')
        staff_members = Staff.objects.select_related('user', 'tenant', 'role').all()
        roles_assigned = 0
        roles_skipped = 0
        
        # Map user.role to Role name
        role_mapping = {
            'admin': 'Admin',
            'manager': 'Manager',
            'cashier': 'Cashier',
            'staff': 'Staff',
            'saas_admin': 'Admin',  # SaaS admins get Admin role in their tenant
        }
        
        for staff in staff_members:
            # Skip if already has a role assigned
            if staff.role:
                roles_skipped += 1
                continue
            
            user_role = staff.user.role
            role_name = role_mapping.get(user_role, 'Staff')  # Default to Staff if unknown
            
            try:
                # Find the matching role in the tenant
                role = Role.objects.get(tenant=staff.tenant, name=role_name)
                
                if not dry_run:
                    staff.role = role
                    staff.save()
                    roles_assigned += 1
                    self.stdout.write(f'  Assigned {role_name} role to: {staff.user.email}')
                else:
                    self.stdout.write(f'  Would assign {role_name} role to: {staff.user.email}')
                    roles_assigned += 1
                    
            except Role.DoesNotExist:
                self.stdout.write(self.style.ERROR(
                    f'  Role "{role_name}" not found for tenant {staff.tenant.name}. User: {staff.user.email}'
                ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'  Error assigning role to {staff.user.email}: {str(e)}'
                ))

        self.stdout.write(self.style.SUCCESS(f'Roles assigned: {roles_assigned}'))
        self.stdout.write(f'Roles skipped (already assigned): {roles_skipped}')

        # Summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS('Migration Summary:'))
        if create_roles:
            self.stdout.write(f'  - Default roles created for all tenants')
        self.stdout.write(f'  - Staff profiles created: {staff_created}')
        self.stdout.write(f'  - Roles assigned to staff: {roles_assigned}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\nThis was a DRY RUN - no changes were made'))
            self.stdout.write('Run without --dry-run to apply changes')
        else:
            self.stdout.write(self.style.SUCCESS('\n✓ Migration completed successfully!'))
