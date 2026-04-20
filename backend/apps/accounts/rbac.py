from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Set
from django.db.utils import ProgrammingError, OperationalError


# Canonical permission registry used by roles and access checks.
# Keep this list additive to avoid breaking existing assignments.
PERMISSION_DEFINITIONS: List[dict] = [
    {'code': 'dashboard.view', 'name': 'View Dashboard', 'module': 'dashboard', 'feature': 'dashboard'},
    {'code': 'sales.view', 'name': 'View Sales', 'module': 'sales', 'feature': 'sales'},
    {'code': 'sales.create', 'name': 'Create Sales', 'module': 'sales', 'feature': 'sales'},
    {'code': 'inventory.view', 'name': 'View Inventory', 'module': 'inventory', 'feature': 'inventory'},
    {'code': 'inventory.manage', 'name': 'Manage Inventory', 'module': 'inventory', 'feature': 'inventory'},
    {'code': 'products.manage', 'name': 'Manage Products', 'module': 'inventory', 'feature': 'products'},
    {'code': 'customers.manage', 'name': 'Manage Customers', 'module': 'sales', 'feature': 'customers'},
    {'code': 'reports.view', 'name': 'View Reports', 'module': 'reports', 'feature': 'reports'},
    {'code': 'staff.manage', 'name': 'Manage Staff', 'module': 'office', 'feature': 'staff'},
    {'code': 'settings.manage', 'name': 'Manage Settings', 'module': 'settings', 'feature': 'settings'},
    {'code': 'distribution.manage', 'name': 'Manage Distribution', 'module': 'distribution', 'feature': 'distribution'},
    {'code': 'storefront.manage', 'name': 'Manage Storefront', 'module': 'storefront', 'feature': 'storefront'},
    {'code': 'pos.retail', 'name': 'Access Retail POS', 'module': 'pos', 'feature': 'retail'},
    {'code': 'pos.restaurant', 'name': 'Access Restaurant POS', 'module': 'pos', 'feature': 'restaurant'},
    {'code': 'pos.bar', 'name': 'Access Bar POS', 'module': 'pos', 'feature': 'bar'},
    {'code': 'outlet.switch', 'name': 'Switch Outlets', 'module': 'office', 'feature': 'outlet'},
    {'code': 'users.create', 'name': 'Create Users', 'module': 'office', 'feature': 'users'},
    {'code': 'users.update', 'name': 'Update Users', 'module': 'office', 'feature': 'users'},
    {'code': 'users.delete', 'name': 'Delete Users', 'module': 'office', 'feature': 'users'},
    {'code': 'roles.assign', 'name': 'Assign Roles', 'module': 'office', 'feature': 'roles'},
    {'code': 'roles.manage', 'name': 'Manage Roles', 'module': 'office', 'feature': 'roles'},
]


LEGACY_FLAG_TO_CODE: Dict[str, str] = {
    'can_dashboard': 'dashboard.view',
    'can_sales': 'sales.view',
    'can_inventory': 'inventory.view',
    'can_products': 'products.manage',
    'can_customers': 'customers.manage',
    'can_reports': 'reports.view',
    'can_staff': 'staff.manage',
    'can_settings': 'settings.manage',
    'can_distribution': 'distribution.manage',
    'can_storefront': 'storefront.manage',
    'can_pos_retail': 'pos.retail',
    'can_pos_restaurant': 'pos.restaurant',
    'can_pos_bar': 'pos.bar',
    'can_switch_outlet': 'outlet.switch',
}

# Additional access codes implied by legacy can_* flags.
IMPLIED_CODES_BY_FLAG: Dict[str, Set[str]] = {
    'can_sales': {'sales.create'},
    'can_staff': {'users.create', 'users.update', 'users.delete', 'roles.assign'},
    'can_settings': {'roles.manage'},
}

CODE_TO_LEGACY_FLAGS: Dict[str, Set[str]] = {}
for legacy_flag, code in LEGACY_FLAG_TO_CODE.items():
    CODE_TO_LEGACY_FLAGS.setdefault(code, set()).add(legacy_flag)

for legacy_flag, implied_codes in IMPLIED_CODES_BY_FLAG.items():
    for code in implied_codes:
        CODE_TO_LEGACY_FLAGS.setdefault(code, set()).add(legacy_flag)


@dataclass
class AccessDecision:
    allowed: bool
    code: str
    reason: str


def _get_staff_models():
    from apps.staff.models import PermissionDefinition, RolePermission
    return PermissionDefinition, RolePermission


def ensure_permission_catalog() -> None:
    """Ensure canonical permissions exist. Safe to call repeatedly."""
    try:
        PermissionDefinition, _ = _get_staff_models()
        for row in PERMISSION_DEFINITIONS:
            PermissionDefinition.objects.get_or_create(
                code=row['code'],
                defaults={
                    'name': row['name'],
                    'module': row['module'],
                    'feature': row.get('feature', ''),
                    'description': row.get('description', ''),
                    'is_active': True,
                },
            )
    except (ProgrammingError, OperationalError):
        # Keep auth and user listing paths operational during deploy windows.
        return


def _codes_from_legacy_flags(legacy_flags: Dict[str, bool]) -> Set[str]:
    codes: Set[str] = set()
    for flag, code in LEGACY_FLAG_TO_CODE.items():
        if legacy_flags.get(flag):
            codes.add(code)
            codes.update(IMPLIED_CODES_BY_FLAG.get(flag, set()))
    return codes


def get_role_permission_codes(role) -> Set[str]:
    """Return effective permission codes for a role.

    During migration, combine canonical grants with legacy flag-derived grants so
    partially migrated roles do not lose access unexpectedly.
    """
    if not role:
        return set()

    ensure_permission_catalog()

    canonical_codes: Set[str] = set()
    try:
        canonical_codes = set(
            role.role_permissions.filter(
                allowed=True,
                permission__is_active=True,
            ).values_list('permission__code', flat=True)
        )
    except (ProgrammingError, OperationalError):
        canonical_codes = set()

    legacy_flags = {
        flag: bool(getattr(role, flag, False))
        for flag in LEGACY_FLAG_TO_CODE
    }
    legacy_codes = _codes_from_legacy_flags(legacy_flags)

    if canonical_codes:
        return canonical_codes.union(legacy_codes)

    return legacy_codes


def sync_role_permissions_from_codes(role, permission_codes: Iterable[str]) -> Set[str]:
    """Persist canonical role permissions and sync legacy fields for compatibility."""
    PermissionDefinition, RolePermission = _get_staff_models()

    ensure_permission_catalog()

    requested_codes = {str(code).strip() for code in (permission_codes or []) if str(code).strip()}

    available_permissions = PermissionDefinition.objects.filter(code__in=requested_codes, is_active=True)
    available_by_code = {p.code: p for p in available_permissions}

    # Replace role permissions atomically (upsert + prune).
    existing_by_code = {
        rp.permission.code: rp
        for rp in role.role_permissions.select_related('permission').all()
    }

    keep_codes = set(available_by_code.keys())
    for code, permission in available_by_code.items():
        rp = existing_by_code.get(code)
        if rp:
            if not rp.allowed:
                rp.allowed = True
                rp.save(update_fields=['allowed', 'updated_at'])
        else:
            RolePermission.objects.create(role=role, permission=permission, allowed=True)

    stale_ids = [
        rp.id for code, rp in existing_by_code.items() if code not in keep_codes
    ]
    if stale_ids:
        role.role_permissions.filter(id__in=stale_ids).delete()

    sync_legacy_role_flags_from_codes(role, keep_codes)
    return keep_codes


def sync_legacy_role_flags_from_codes(role, permission_codes: Iterable[str]) -> None:
    """Map canonical permission codes back to legacy can_* flags for old clients."""
    codes = set(permission_codes or [])

    updates = {}
    for legacy_flag in LEGACY_FLAG_TO_CODE:
        should_enable = False
        for code in codes:
            mapped_flags = CODE_TO_LEGACY_FLAGS.get(code, set())
            if legacy_flag in mapped_flags:
                should_enable = True
                break
        updates[legacy_flag] = should_enable

    changed_fields = []
    for field, value in updates.items():
        if getattr(role, field, None) != value:
            setattr(role, field, value)
            changed_fields.append(field)

    if changed_fields:
        role.save(update_fields=changed_fields)


def sync_role_permissions_from_legacy_flags(role) -> Set[str]:
    legacy_flags = {
        flag: bool(getattr(role, flag, False))
        for flag in LEGACY_FLAG_TO_CODE
    }
    codes = _codes_from_legacy_flags(legacy_flags)
    return sync_role_permissions_from_codes(role, codes)


def user_permission_codes(user) -> Set[str]:
    """Resolve canonical permission codes for a user from resolved role."""
    if not user:
        return set()

    if getattr(user, 'is_saas_admin', False) or getattr(user, 'is_superuser', False):
        return {row['code'] for row in PERMISSION_DEFINITIONS}

    role = user._resolve_permission_role()
    if not role:
        return set()

    return get_role_permission_codes(role)


def user_has_permission_code(user, code: str) -> bool:
    if not user or not getattr(user, 'is_authenticated', False):
        return False

    if getattr(user, 'is_saas_admin', False) or getattr(user, 'is_superuser', False):
        return True

    normalized_code = (code or '').strip()
    if not normalized_code:
        return False

    try:
        return normalized_code in user_permission_codes(user)
    except (ProgrammingError, OperationalError):
        return False


def user_has_legacy_permission(user, legacy_flag: str) -> bool:
    if not user or not getattr(user, 'is_authenticated', False):
        return False

    if getattr(user, 'is_saas_admin', False) or getattr(user, 'is_superuser', False):
        return True

    code = LEGACY_FLAG_TO_CODE.get(legacy_flag)
    if not code:
        return False

    if user_has_permission_code(user, code):
        return True

    # Compatibility: honor legacy role flag while data is migrating.
    role = user._resolve_permission_role()
    if role:
        return bool(getattr(role, legacy_flag, False))

    return False


def evaluate_access(user, code: str) -> AccessDecision:
    if user_has_permission_code(user, code):
        return AccessDecision(allowed=True, code=code, reason='granted')
    return AccessDecision(allowed=False, code=code, reason='missing_permission')
