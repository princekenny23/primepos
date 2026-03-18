from rest_framework import permissions


def _get_request_value(request, keys):
    for key in keys:
        value = None
        if hasattr(request, 'data'):
            value = request.data.get(key)
        if value in (None, '', 'null'):
            value = request.query_params.get(key)
        if value not in (None, '', 'null'):
            return value
    return None


def _to_int(value):
    try:
        if value in (None, '', 'null'):
            return None
        return int(value)
    except (ValueError, TypeError):
        return None


def resolve_tenant_from_request(request):
    """
    Resolve tenant context for both tenant users and SaaS admins.
    SaaS admins can provide tenant context directly (tenant_id / X-Tenant-ID)
    or indirectly through related resource IDs (outlet/till/shift/sale).
    """
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        return None

    tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
    if tenant:
        return tenant

    if not getattr(user, 'is_saas_admin', False):
        return None

    tenant_id = _get_request_value(request, ['tenant', 'tenant_id'])
    if tenant_id in (None, '', 'null'):
        tenant_id = request.headers.get('X-Tenant-ID')

    tenant_id_int = _to_int(tenant_id)
    if tenant_id_int:
        from .models import Tenant
        try:
            return Tenant.objects.get(id=tenant_id_int)
        except Tenant.DoesNotExist:
            return None

    outlet_id = _get_request_value(request, ['outlet', 'outlet_id', 'warehouse', 'warehouse_id'])
    if outlet_id in (None, '', 'null'):
        outlet_id = request.headers.get('X-Outlet-ID')
    outlet_id_int = _to_int(outlet_id)
    if outlet_id_int:
        from apps.outlets.models import Outlet
        try:
            return Outlet.objects.select_related('tenant').get(id=outlet_id_int).tenant
        except Outlet.DoesNotExist:
            pass

    till_id_int = _to_int(_get_request_value(request, ['till', 'till_id']))
    if till_id_int:
        from apps.outlets.models import Till
        try:
            return Till.objects.select_related('outlet__tenant').get(id=till_id_int).outlet.tenant
        except Till.DoesNotExist:
            pass

    shift_id_int = _to_int(_get_request_value(request, ['shift', 'shift_id']))
    if shift_id_int:
        from apps.shifts.models import Shift
        try:
            shift = Shift.objects.select_related('outlet__tenant').get(id=shift_id_int)
            return shift.outlet.tenant if shift.outlet else None
        except Shift.DoesNotExist:
            pass

    sale_id_int = _to_int(_get_request_value(request, ['sale', 'sale_id', 'sales_order', 'sales_order_id']))
    if sale_id_int:
        from apps.sales.models import Sale
        try:
            return Sale.objects.select_related('tenant').get(id=sale_id_int).tenant
        except Sale.DoesNotExist:
            pass

    return None


class IsSaaSAdmin(permissions.BasePermission):
    """Permission check for SaaS admin users"""
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_saas_admin


class IsTenantMember(permissions.BasePermission):
    """Permission check for tenant members"""
    
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.tenant is not None


class IsTenantAdmin(permissions.BasePermission):
    """Permission check for tenant admin users"""
    
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        # Tenant admin has settings permission and is not a SaaS admin
        # Check through role system first, fall back to role field
        if user.is_saas_admin:
            return False
        return user.has_permission('can_settings') or user.effective_role == 'admin'


def is_tenant_admin(user):
    """Helper function to check if user is a tenant admin"""
    if not user or not user.is_authenticated:
        return False
    if user.is_saas_admin:
        return False
    # Check through role system first, fall back to role field
    return user.has_permission('can_settings') or user.effective_role == 'admin'


def is_admin_user(user):
    """Helper function to check if user is SaaS admin or tenant admin"""
    if not user or not user.is_authenticated:
        return False
    return user.is_saas_admin or is_tenant_admin(user)


class TenantFilterMixin:
    """Mixin to filter queryset by tenant"""
    
    def get_queryset(self):
        queryset = super().get_queryset()
        # SaaS admins can see all tenants
        if self.request.user.is_saas_admin:
            return queryset
        # Regular users only see their tenant
        if hasattr(self.request, 'tenant') and self.request.tenant:
            return queryset.filter(tenant=self.request.tenant)
        # If no tenant in request, filter by user's tenant
        if self.request.user.tenant:
            return queryset.filter(tenant=self.request.user.tenant)
        return queryset.none()
    
    def get_tenant_for_request(self, request):
        """
        Helper method to get tenant for a request with proper validation.
        CRITICAL: Use this in perform_create to ensure tenant isolation.
        SaaS admins can access any tenant by providing tenant_id in request data.
        
        Returns:
            Tenant instance or None
        
        Raises:
            ValidationError if tenant is required but missing (for non-SaaS admins)
        """
        user = getattr(request, 'user', None)
        if not getattr(user, 'is_authenticated', False):
            return getattr(request, 'tenant', None)

        if user.is_saas_admin:
            return resolve_tenant_from_request(request)
        
        # Refresh user to ensure tenant is loaded (important during onboarding)
        if not hasattr(user, '_tenant_loaded'):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.select_related('tenant').get(pk=user.pk)
                request.user = user
                user._tenant_loaded = True
            except User.DoesNotExist:
                pass
        
        return getattr(request, 'tenant', None) or user.tenant
    
    def require_tenant(self, request):
        """
        CRITICAL: Get tenant and raise error if missing.
        Use this in perform_create to enforce tenant isolation.
        SaaS admins can provide tenant_id in request data to work with any tenant.
        
        Returns:
            Tenant instance
        
        Raises:
            ValidationError if tenant is missing (for non-SaaS admins)
        """
        from rest_framework.exceptions import ValidationError
        
        # SaaS admins must still provide/derive tenant context for tenant-bound resources
        if request.user.is_saas_admin:
            tenant = self.get_tenant_for_request(request)
            if tenant:
                return tenant
            raise ValidationError(
                "Tenant is required. Provide tenant_id (or X-Tenant-ID), or include a tenant-scoped resource "
                "like outlet_id/till_id/shift_id/sale_id in request."
            )
        
        tenant = self.get_tenant_for_request(request)
        
        if not tenant:
            raise ValidationError(
                "Tenant is required. Please ensure you are authenticated and have a tenant assigned. "
                "If you just created a tenant, please refresh your session or log out and log back in."
            )
        
        return tenant
    
    def get_outlet_for_request(self, request):
        """
        Helper method to get outlet for a request.
        Checks query params, headers, and request data.
        SaaS admins can access outlets from any tenant.
        
        Returns:
            Outlet instance or None
        """
        # Check query params first (most common)
        outlet_id = request.query_params.get('outlet') or request.query_params.get('outlet_id')
        
        # Check headers (X-Outlet-ID)
        if not outlet_id:
            outlet_id = request.headers.get('X-Outlet-ID')
        
        # Check request data (for POST/PUT)
        if not outlet_id and hasattr(request, 'data'):
            outlet_id = (
                request.data.get('outlet')
                or request.data.get('outlet_id')
                or request.data.get('warehouse')
                or request.data.get('warehouse_id')
            )
        
        if not outlet_id:
            return None
        
        try:
            from apps.outlets.models import Outlet
            user = getattr(request, 'user', None)
            is_saas_admin = bool(getattr(user, 'is_authenticated', False) and getattr(user, 'is_saas_admin', False))
            # SaaS admins can access outlets from any tenant
            if is_saas_admin:
                return Outlet.objects.get(id=outlet_id)
            else:
                tenant = self.get_tenant_for_request(request)
                if not tenant:
                    return None
                return Outlet.objects.get(id=outlet_id, tenant=tenant)
        except (Outlet.DoesNotExist, ValueError, TypeError):
            return None
    
    def validate_tenant_id(self, request, tenant_id_from_data):
        """
        CRITICAL: Validate that tenant_id from request data matches authenticated tenant.
        Use this to prevent cross-tenant data leakage.
        SaaS admins can set any tenant_id.
        
        Args:
            request: DRF request object
            tenant_id_from_data: Tenant ID from request data (if provided)
        
        Raises:
            ValidationError if tenant IDs don't match (for non-SaaS admins)
        """
        # SaaS admins can set any tenant_id
        if request.user.is_saas_admin:
            if tenant_id_from_data:
                try:
                    from .models import Tenant
                    tenant_id = int(tenant_id_from_data)
                    Tenant.objects.get(id=tenant_id)  # Validate tenant exists
                except (Tenant.DoesNotExist, ValueError, TypeError):
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError(f"Invalid tenant ID: {tenant_id_from_data}")
            return  # SaaS admin can proceed
        
        if not tenant_id_from_data:
            return  # No tenant ID in data, will be set from authenticated tenant
        
        from rest_framework.exceptions import ValidationError
        
        tenant = self.get_tenant_for_request(request)
        
        if not tenant:
            raise ValidationError("Tenant is required.")
        
        try:
            tenant_id_from_data = int(tenant_id_from_data)
            if tenant.id != tenant_id_from_data:
                raise ValidationError(
                    f"You can only create resources for your own tenant. "
                    f"Requested tenant {tenant_id_from_data} does not match your tenant {tenant.id}."
                )
        except (ValueError, TypeError):
            raise ValidationError("Invalid tenant ID format.")

