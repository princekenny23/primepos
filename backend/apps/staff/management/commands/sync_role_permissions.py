"""Management command to sync all Role records' legacy boolean flags to
canonical RolePermission rows.

Run once after deploying the RBAC migration, and any time you need to
re-align existing roles with the current IMPLIED_CODES_BY_FLAG definitions.

Usage:
    python manage.py sync_role_permissions
    python manage.py sync_role_permissions --dry-run
"""

from django.core.management.base import BaseCommand

from apps.accounts.rbac import sync_role_permissions_from_legacy_flags
from apps.staff.models import Role


class Command(BaseCommand):
    help = "Sync all Role records: derive canonical permission codes from legacy boolean flags."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be changed without writing to the database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        roles = Role.objects.select_related("tenant").prefetch_related("role_permissions")
        total = roles.count()
        self.stdout.write(f"Found {total} roles to process.")

        updated = 0
        skipped = 0
        errors = 0

        for role in roles:
            try:
                if dry_run:
                    from apps.accounts.rbac import get_role_permission_codes
                    before = set(get_role_permission_codes(role))
                    # Compute what would be synced without saving
                    from apps.accounts.rbac import IMPLIED_CODES_BY_FLAG, LEGACY_FLAG_TO_CODE
                    derived: set = set()
                    for flag, code in LEGACY_FLAG_TO_CODE.items():
                        if getattr(role, flag, False):
                            derived.add(code)
                    for flag, codes in IMPLIED_CODES_BY_FLAG.items():
                        if getattr(role, flag, False):
                            derived.update(codes)
                    new_codes = before | derived
                    added = new_codes - before
                    if added:
                        self.stdout.write(
                            self.style.WARNING(
                                f"[DRY-RUN] Role '{role.name}' (tenant={getattr(role.tenant, 'name', role.tenant_id)}): "
                                f"would add {sorted(added)}"
                            )
                        )
                        updated += 1
                    else:
                        skipped += 1
                else:
                    sync_role_permissions_from_legacy_flags(role)
                    updated += 1
            except Exception as exc:
                self.stderr.write(
                    self.style.ERROR(
                        f"Error processing role '{role.name}' (id={role.pk}): {exc}"
                    )
                )
                errors += 1

        label = "[DRY-RUN] Would update" if dry_run else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{label} {updated} roles, skipped {skipped}, errors {errors}."
            )
        )
