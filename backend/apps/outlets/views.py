import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Outlet, Till
from .serializers import OutletSerializer, TillSerializer
from apps.tenants.permissions import TenantFilterMixin

logger = logging.getLogger(__name__)


class OutletViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Outlet ViewSet"""
    queryset = Outlet.objects.select_related('tenant').prefetch_related('tills')
    serializer_class = OutletSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'tenant']
    search_fields = ['name', 'phone', 'email', 'address']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        """Ensure tenant filtering is applied correctly"""
        # Ensure user.tenant is loaded
        user = self.request.user
        if not hasattr(user, '_tenant_loaded'):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.select_related('tenant').get(pk=user.pk)
                self.request.user = user
                user._tenant_loaded = True
            except User.DoesNotExist:
                pass
        
        is_saas_admin = getattr(user, 'is_saas_admin', False)
        request_tenant = getattr(self.request, 'tenant', None)
        user_tenant = getattr(user, 'tenant', None)
        tenant = request_tenant or user_tenant
        
        # Get base queryset
        queryset = Outlet.objects.select_related('tenant').prefetch_related('tills').all()
        
        # Apply tenant filter - CRITICAL for security
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(tenant=tenant)
            else:
                return queryset.none()
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Override create to add logging and better error handling"""
        logger.info(f"Creating outlet with data: {request.data}")
        logger.info(f"User: {request.user}, Tenant: {getattr(request.user, 'tenant', None)}")
        
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"Outlet validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            logger.error(f"Error creating outlet: {e}", exc_info=True)
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def perform_create(self, serializer):
        """Always set tenant from request context - CRITICAL for tenant isolation"""
        from rest_framework.exceptions import ValidationError
        
        # Try to get tenant from request (refreshes user from DB)
        tenant = self.get_tenant_for_request(self.request)
        
        # Check if tenant_id was provided in request (onboarding case)
        tenant_id_from_request = self.request.data.get('tenant')
        
        # If tenant_id provided, validate it (handles both cases: no tenant yet, or tenant mismatch)
        if tenant_id_from_request:
            # During onboarding, user might have just created tenant but token not refreshed
            # OR user might have an old tenant but is creating outlet for newly created tenant
            # Validate that the tenant exists and user has permission to create outlets for it
            try:
                tenant_id = int(tenant_id_from_request)
                from apps.tenants.models import Tenant
                requested_tenant = Tenant.objects.get(pk=tenant_id)
                
                # If we already have a tenant from user, check if it matches
                # If not, use the requested tenant (will validate below)
                if tenant and tenant.id == tenant_id:
                    # Tenant matches, use it
                    pass
                else:
                    # Tenant doesn't match or doesn't exist - use requested tenant
                    # Will validate below if user has permission
                    tenant = requested_tenant
                
                # CRITICAL: Verify user has permission (user.tenant should match, or user just created it)
                # Refresh user from DB with tenant relationship to ensure we have latest data
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    user = User.objects.select_related('tenant').get(pk=self.request.user.pk)
                    self.request.user = user
                    user._tenant_loaded = True
                except User.DoesNotExist:
                    raise ValidationError("User not found")
                
                # Validate user's tenant matches (or user is SaaS admin)
                # During onboarding, user.tenant might not be set yet in DB, or might be set to old tenant
                # We allow the tenant_id from request if it was just created (within last 5 minutes)
                if not self.request.user.is_saas_admin:
                    from django.utils import timezone
                    from datetime import timedelta
                    time_threshold = timezone.now() - timedelta(minutes=5)
                    
                    # Check if tenant was created recently (onboarding scenario)
                    tenant_is_recent = tenant.created_at >= time_threshold
                    
                    logger.info(f"Outlet creation validation: user.tenant.id={user.tenant.id if user.tenant else None}, "
                              f"requested_tenant.id={tenant.id}, tenant.created_at={tenant.created_at}, "
                              f"is_recent={tenant_is_recent}, tenant_id_from_request={tenant_id_from_request}")
                    
                    # If user has a tenant, check if it matches
                    if user.tenant:
                        if user.tenant.id != tenant.id:
                            # Tenant IDs don't match - check if this is onboarding
                            if tenant_is_recent:
                                # Tenant was just created (onboarding) - allow it
                                # The user might have an old tenant from previous session
                                # or the user.tenant might not be updated yet
                                logger.info(f"Allowing recently created tenant {tenant.id} for user with existing tenant {user.tenant.id} (onboarding)")
                                # Update user's tenant to the new one
                                user.tenant = tenant
                                user.save(update_fields=['tenant'])
                                self.request.user.tenant = tenant
                            else:
                                # Tenant is old and doesn't match - reject for security
                                logger.warning(f"Rejecting tenant {tenant.id} - doesn't match user tenant {user.tenant.id} and not recently created")
                                raise ValidationError(
                                    f"You can only create outlets for your own tenant. "
                                    f"Requested tenant {tenant.id} does not match your tenant {user.tenant.id}."
                                )
                        else:
                            logger.info(f"Tenant IDs match: {tenant.id}")
                    else:
                        # User doesn't have tenant yet - check if tenant was just created (onboarding)
                        if tenant_is_recent:
                            # Tenant was created recently, allow it and assign to user
                            logger.info(f"Assigning recently created tenant {tenant.id} to user (onboarding)")
                            user.tenant = tenant
                            user.save(update_fields=['tenant'])
                            self.request.user.tenant = tenant
                        else:
                            # Tenant is old and user has no tenant - reject
                            logger.warning(f"Rejecting old tenant {tenant.id} for user with no tenant")
                            raise ValidationError(
                                "You can only create outlets for your own tenant. "
                                "If you just created a tenant, please wait a moment and try again, "
                                "or refresh your session."
                            )
            except (ValueError, TypeError, Tenant.DoesNotExist):
                raise ValidationError(
                    "Invalid tenant ID or tenant not found. "
                    "Please ensure you are creating an outlet for your own tenant."
                )
        
        # If still no tenant, require it (will raise error)
        if not tenant:
            tenant = self.require_tenant(self.request)
        
        # Final validation - tenant from request data should match what we determined
        # But we've already validated it above (including onboarding scenarios),
        # so we just log if there's a mismatch (shouldn't happen at this point)
        if tenant_id_from_request:
            try:
                tenant_id = int(tenant_id_from_request)
                if tenant.id != tenant_id:
                    # This shouldn't happen if validation above worked correctly
                    # But log it for debugging
                    logger.warning(f"Tenant ID mismatch in final check: determined={tenant.id}, requested={tenant_id}")
                    # Use the tenant we determined (which has been validated)
                    # Don't reject here - we've already done all validation above
            except (ValueError, TypeError):
                pass  # Invalid format, but we already have tenant from authenticated user
        
        # Save with the validated tenant
        serializer.save(tenant=tenant)
    
    def update(self, request, *args, **kwargs):
        """Override update to ensure tenant matches and properly save all fields"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to update this outlet."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Call parent update to handle serialization and saving
        response = super().update(request, *args, **kwargs)
        
        # Ensure we return the updated instance with all fields
        if response.status_code == status.HTTP_200_OK:
            # Refresh instance from database to get latest data
            instance.refresh_from_db()
            # Re-serialize with updated data
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return response
    
    def perform_update(self, serializer):
        """Ensure all fields are properly saved"""
        # Save the outlet - this will update all fields in the database
        outlet = serializer.save()
        logger.info(f"Outlet {outlet.id} updated: name={outlet.name}, address={outlet.address}, phone={outlet.phone}, email={outlet.email}, is_active={outlet.is_active}")
        return outlet
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure tenant matches"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to delete this outlet."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['get'])
    def tills(self, request, pk=None):
        """Get tills for an outlet"""
        outlet = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and outlet.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to view tills for this outlet."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        tills = outlet.tills.filter(is_active=True)
        serializer = TillSerializer(tills, many=True)
        return Response(serializer.data)


class TillViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Till ViewSet"""
    queryset = Till.objects.select_related('outlet', 'outlet__tenant')
    serializer_class = TillSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['outlet', 'is_active', 'is_in_use']
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        """Filter tills by tenant through outlet"""
        queryset = super().get_queryset()
        # SaaS admins can see all tills
        if self.request.user.is_saas_admin:
            return queryset
        # Regular users only see tills from their tenant's outlets
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        if tenant:
            return queryset.filter(outlet__tenant=tenant)
        return queryset.none()
    
    def get_serializer_context(self):
        """Add request to serializer context"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        """Filter tills by tenant through outlet - ensure tenant filtering"""
        # Ensure user.tenant is loaded
        user = self.request.user
        if not hasattr(user, '_tenant_loaded'):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.select_related('tenant').get(pk=user.pk)
                self.request.user = user
                user._tenant_loaded = True
            except User.DoesNotExist:
                pass
        
        is_saas_admin = getattr(user, 'is_saas_admin', False)
        request_tenant = getattr(self.request, 'tenant', None)
        user_tenant = getattr(user, 'tenant', None)
        tenant = request_tenant or user_tenant
        
        # Get base queryset
        queryset = Till.objects.select_related('outlet', 'outlet__tenant').all()
        
        # Apply tenant filter through outlet - CRITICAL for security
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(outlet__tenant=tenant)
            else:
                return queryset.none()
        
        return queryset
    
    def perform_create(self, serializer):
        """Validate outlet belongs to tenant and save till"""
        outlet_id = serializer.validated_data.get('outlet_id')
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required. Please ensure you are authenticated and have a tenant assigned.")
        
        # CRITICAL: Validate outlet belongs to tenant
        from .models import Outlet
        try:
            outlet = Outlet.objects.get(id=outlet_id, tenant=tenant)
        except Outlet.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Outlet does not belong to your tenant.")
        
        serializer.save(outlet=outlet)
    
    def update(self, request, *args, **kwargs):
        """Override update to ensure tenant matches through outlet"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches through outlet (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.outlet.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to update this till."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure tenant matches through outlet"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches through outlet (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.outlet.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to delete this till."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=False, methods=['get'])
    def available(self, request):
        """Get available (not in use) tills for an outlet"""
        outlet_id = request.query_params.get('outlet_id')
        if not outlet_id:
            return Response(
                {"detail": "outlet_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        if not tenant:
            return Response(
                {"detail": "Tenant is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate outlet belongs to tenant
        from .models import Outlet
        try:
            outlet = Outlet.objects.get(id=outlet_id, tenant=tenant)
        except Outlet.DoesNotExist:
            return Response(
                {"detail": "Outlet does not belong to your tenant"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get available tills (active and not in use)
        tills = Till.objects.filter(
            outlet=outlet,
            is_active=True,
            is_in_use=False
        )
        serializer = self.get_serializer(tills, many=True)
        return Response(serializer.data)

