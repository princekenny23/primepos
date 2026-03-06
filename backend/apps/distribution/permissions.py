from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from apps.tenants.permissions import resolve_tenant_from_request


def get_effective_role(user):
    if not user or not user.is_authenticated:
        return ''
    role = getattr(user, 'effective_role', None) or getattr(user, 'role', '')
    return str(role).strip().lower()


def resolve_distribution_tenant(request):
    return resolve_tenant_from_request(request)


class HasDistributionFeature(permissions.BasePermission):
    def has_permission(self, request, view):
        tenant = resolve_distribution_tenant(request)
        if not tenant:
            raise PermissionDenied('Tenant context is required for Distribution module. Provide tenant_id when acting as SaaS admin.')
        if not getattr(tenant, 'has_distribution', False):
            raise PermissionDenied('Distribution module is not enabled for this tenant.')
        return True


class IsDispatcher(permissions.BasePermission):
    def has_permission(self, request, view):
        role = get_effective_role(request.user)
        if getattr(request.user, 'is_saas_admin', False):
            return True
        return role in {'admin', 'manager', 'dispatcher'}


class IsDriver(permissions.BasePermission):
    def has_permission(self, request, view):
        role = get_effective_role(request.user)
        return role == 'driver'
