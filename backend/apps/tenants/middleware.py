from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model
from .models import Tenant

User = get_user_model()


class TenantMiddleware(MiddlewareMixin):
    """
    Middleware to extract tenant from JWT token and set request.tenant
    SaaS admins bypass tenant filtering
    
    This middleware runs before DRF authentication, so it sets request.tenant
    which can be used by TenantFilterMixin even if DRF authentication overrides request.user
    """
    def process_request(self, request):
        request.tenant = None
        
        # Skip for admin and static files
        if request.path.startswith('/admin/') or request.path.startswith('/static/'):
            return None

        # Resolve tenant from host/subdomain first (Odoo-style URL tenancy).
        host = (
            request.META.get('HTTP_X_TENANT_HOST')
            or request.META.get('HTTP_HOST')
            or request.get_host()
            or ''
        ).split(':')[0].strip().lower()

        if host:
            tenant = Tenant.objects.filter(is_active=True, domain__iexact=host).first()
            if not tenant and '.' in host:
                subdomain = host.split('.', 1)[0]
                if subdomain and subdomain not in {'www', 'api', 'admin'}:
                    tenant = Tenant.objects.filter(is_active=True, subdomain__iexact=subdomain).first()
            if tenant:
                request.tenant = tenant

        # Allow explicit tenant targeting for business-scoped API requests.
        if request.tenant is None:
            tenant_header = request.META.get('HTTP_X_TENANT_ID')
            if tenant_header not in (None, '', 'null'):
                try:
                    request.tenant = Tenant.objects.filter(is_active=True).get(id=int(tenant_header))
                except (ValueError, TypeError, Tenant.DoesNotExist):
                    pass

        # Get token from Authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None

        token = auth_header.split(' ')[1]
        
        try:
            # Decode token
            untyped_token = UntypedToken(token)
            user_id = untyped_token.get('user_id')
            
            if user_id:
                # Load user with tenant relationship
                user = User.objects.select_related('tenant').get(id=user_id)
                
                # SaaS admins: keep any tenant already resolved from the host/X-Tenant-ID header;
                # only fall back to None if no tenant was resolved earlier.
                if user.is_saas_admin:
                    if not getattr(request, 'tenant', None):
                        request.tenant = None
                elif user.tenant:
                    # Set tenant on request for TenantFilterMixin to use
                    request.tenant = user.tenant
                    
        except (TokenError, InvalidToken, User.DoesNotExist):
            # Invalid token or user not found - let DRF authentication handle it
            pass

        return None

