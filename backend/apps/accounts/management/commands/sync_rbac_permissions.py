from django.core.management.base import BaseCommand

from apps.accounts.rbac import ensure_permission_catalog, sync_role_permissions_from_legacy_flags
from apps.staff.models import Role


class Command(BaseCommand):
    help = "Sync canonical RBAC permission codes from existing role can_* flags"

    def handle(self, *args, **options):
        ensure_permission_catalog()

        total = 0
        for role in Role.objects.all():
            sync_role_permissions_from_legacy_flags(role)
            total += 1

        self.stdout.write(self.style.SUCCESS(f"Synced RBAC permissions for {total} role(s)."))
