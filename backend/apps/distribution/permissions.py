from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied


def get_effective_role(user):
    if not user or not user.is_authenticated:
        return ''
    role = getattr(user, 'effective_role', None) or getattr(user, 'role', '')
    return str(role).strip().lower()


def resolve_distribution_tenant(request):
    tenant = getattr(request, 'tenant', None) or getattr(request.user, 'tenant', None)
    if tenant:
        return tenant

    if getattr(request.user, 'is_saas_admin', False):
        tenant_id = None
        if hasattr(request, 'data'):
            tenant_id = request.data.get('tenant') or request.data.get('tenant_id')
        if not tenant_id:
            tenant_id = request.query_params.get('tenant') or request.query_params.get('tenant_id')

        if tenant_id:
            from apps.tenants.models import Tenant

            try:
                return Tenant.objects.get(id=int(tenant_id))
            except (Tenant.DoesNotExist, ValueError, TypeError):
                return None

    return None


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
