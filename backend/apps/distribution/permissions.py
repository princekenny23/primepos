from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied


def get_effective_role(user):
    if not user or not user.is_authenticated:
        return ''
    role = getattr(user, 'effective_role', None) or getattr(user, 'role', '')
    return str(role).strip().lower()


class HasDistributionFeature(permissions.BasePermission):
    def has_permission(self, request, view):
        tenant = getattr(request, 'tenant', None) or getattr(request.user, 'tenant', None)
        if not tenant:
            raise PermissionDenied('Tenant context is required for Distribution module.')
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
