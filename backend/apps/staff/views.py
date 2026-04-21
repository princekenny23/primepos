from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from .models import Role, Staff, Attendance
from .serializers import RoleSerializer, StaffSerializer, AttendanceSerializer
from apps.tenants.permissions import TenantFilterMixin, HasTenantModuleAccess, resolve_tenant_from_request


class RoleViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Role ViewSet"""
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_settings']
    ignore_outlet_module_permissions = True
    required_permission_codes = ['roles.manage']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        """Safe methods (list/retrieve) only require authentication; write methods require roles.manage."""
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), HasTenantModuleAccess()]
    
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
        tenant = resolve_tenant_from_request(self.request) or getattr(user, 'tenant', None)
        
        # Get base queryset
        queryset = Role.objects.all()
        
        # Apply tenant filter - CRITICAL for security
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(tenant=tenant)
            else:
                return queryset.none()
        
        return queryset
    
    def perform_create(self, serializer):
        """Always set tenant from request context (supports SaaS admin tenant targeting)"""
        tenant = self.get_tenant_for_request(self.request)
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                "Tenant is required. Provide tenant or tenant_id in request data/query when acting as SaaS admin."
            )
        serializer.save(tenant=tenant)
    
    def update(self, request, *args, **kwargs):
        """Override update to ensure tenant matches"""
        instance = self.get_object()
        tenant = resolve_tenant_from_request(request) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to update this role."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure tenant matches"""
        instance = self.get_object()
        tenant = resolve_tenant_from_request(request) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to delete this role."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)


class StaffViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Staff ViewSet"""
    queryset = Staff.objects.select_related('user', 'tenant', 'role').prefetch_related(
        'outlets', 'outlet_roles__outlet', 'outlet_roles__role'
    )
    serializer_class = StaffSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_office', 'allow_settings']
    ignore_outlet_module_permissions = True
    require_any_tenant_permission = True
    required_permission_codes = ['staff.manage']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'role', 'is_active']
    search_fields = ['user__name', 'user__email']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_permissions(self):
        """Safe methods only require authentication; write methods require staff.manage."""
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), HasTenantModuleAccess()]
    
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
        tenant = resolve_tenant_from_request(self.request) or getattr(user, 'tenant', None)
        
        # Get base queryset
        queryset = Staff.objects.select_related('user', 'tenant', 'role').prefetch_related(
            'outlets', 'outlet_roles__outlet', 'outlet_roles__role'
        ).all()
        
        # Apply tenant filter - CRITICAL for security
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(tenant=tenant)
            else:
                return queryset.none()
        
        return queryset
    
    def get_serializer_context(self):
        """Add request to serializer context"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def create(self, request, *args, **kwargs):
        """Override create to add better error logging and handling"""
        import logging
        from rest_framework.exceptions import ValidationError as DRFValidationError
        
        logger = logging.getLogger(__name__)
        
        try:
            logger.info(f"Creating staff with data: {request.data}")
            
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                logger.error(f"Validation errors: {serializer.errors}")
                # Format errors nicely for frontend
                error_detail = serializer.errors
                if isinstance(error_detail, dict):
                    error_messages = []
                    for field, errors in error_detail.items():
                        if isinstance(errors, list):
                            # Handle list of errors
                            for error in errors:
                                if isinstance(error, dict) and 'string' in error:
                                    error_messages.append(f"{field}: {error['string']}")
                                else:
                                    error_messages.append(f"{field}: {error}")
                        elif isinstance(errors, dict) and 'string' in errors:
                            # Handle ErrorDetail object format
                            error_messages.append(f"{field}: {errors['string']}")
                        else:
                            error_messages.append(f"{field}: {errors}")
                    error_detail = {'detail': '; '.join(error_messages), 'errors': serializer.errors}
                return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
            
            # Use perform_create so tenant is always injected from request context.
            self.perform_create(serializer)
            staff = serializer.instance
            headers = self.get_success_headers(serializer.data)
            logger.info("Staff created successfully")

            # Create notification for new staff (Square POS-like)
            try:
                from apps.notifications.services import NotificationService
                NotificationService.notify_staff_added(staff)
            except Exception as e:
                logger.error(f"Failed to create staff notification: {str(e)}")

            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except DRFValidationError as e:
            logger.error(f"Validation error: {e.detail}")
            # Format ValidationError properly
            error_detail = e.detail
            if isinstance(error_detail, dict):
                error_messages = []
                for field, errors in error_detail.items():
                    if isinstance(errors, list):
                        for error in errors:
                            if isinstance(error, dict) and 'string' in error:
                                error_messages.append(f"{field}: {error['string']}")
                            else:
                                error_messages.append(f"{field}: {error}")
                    elif isinstance(errors, dict) and 'string' in errors:
                        error_messages.append(f"{field}: {errors['string']}")
                    else:
                        error_messages.append(f"{field}: {errors}")
                error_detail = {'detail': '; '.join(error_messages), 'errors': e.detail}
            return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating staff: {str(e)}")
            logger.error(f"Request data: {request.data}")
            logger.error(f"Exception type: {type(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    def perform_create(self, serializer):
        """Always set tenant from request context (supports SaaS admin tenant targeting)"""
        tenant = self.get_tenant_for_request(self.request)
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                "Tenant is required. Provide tenant or tenant_id in request data/query when acting as SaaS admin."
            )
        serializer.save(tenant=tenant)
    
    def update(self, request, *args, **kwargs):
        """Override update to ensure tenant matches"""
        instance = self.get_object()
        tenant = resolve_tenant_from_request(request) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to update this staff member."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure tenant matches"""
        instance = self.get_object()
        tenant = resolve_tenant_from_request(request) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to delete this staff member."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)


class AttendanceViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Attendance ViewSet"""
    queryset = Attendance.objects.select_related('staff', 'staff__tenant', 'outlet', 'outlet__tenant')
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_settings']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['staff', 'outlet']
    ordering_fields = ['check_in']
    ordering = ['-check_in']
    
    def get_queryset(self):
        """Filter attendance by tenant through staff"""
        queryset = super().get_queryset()
        # SaaS admins can see all attendance records
        if self.request.user.is_saas_admin:
            return queryset
        # Regular users only see attendance from their tenant's staff
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        if tenant:
            return queryset.filter(staff__tenant=tenant)
        return queryset.none()
    
    @action(detail=False, methods=['post'])
    def check_in(self, request):
        """Check in staff member"""
        staff_id = request.data.get('staff_id')
        outlet_id = request.data.get('outlet_id')
        
        if not all([staff_id, outlet_id]):
            return Response(
                {"detail": "staff_id and outlet_id are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        attendance = Attendance.objects.create(
            staff_id=staff_id,
            outlet_id=outlet_id,
            check_in=timezone.now()
        )
        
        serializer = self.get_serializer(attendance)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def check_out(self, request, pk=None):
        """Check out staff member"""
        attendance = self.get_object()
        
        if attendance.check_out:
            return Response(
                {"detail": "Already checked out"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        attendance.check_out = timezone.now()
        attendance.save()
        
        serializer = self.get_serializer(attendance)
        return Response(serializer.data)

