from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import UploadedFile
import logging
from .models import Tenant
from .serializers import TenantSerializer
from .permissions import IsSaaSAdmin, TenantFilterMixin, HasTenantModuleAccess

User = get_user_model()
logger = logging.getLogger(__name__)


class TenantViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Tenant ViewSet"""
    queryset = Tenant.objects.prefetch_related('outlets', 'users').all()
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_settings']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['type', 'is_active']
    search_fields = ['name', 'email', 'phone']
    ordering_fields = ['created_at', 'name']
    ordering = ['-created_at']
    
    def get_permissions(self):
        """SaaS admins can manage all tenants, regular users can create and update their own tenant"""
        if self.action == 'destroy':
            return [IsSaaSAdmin()]
        # Allow authenticated users to create and update their own tenant
        if self.action in ['create', 'update', 'partial_update']:
            return [IsAuthenticated()]
        return [IsAuthenticated()]
    
    def get_queryset(self):
        """Override to filter tenants - users can only see their own tenant"""
        queryset = super().get_queryset()
        # SaaS admins can see all tenants
        if self.request.user.is_saas_admin:
            return queryset
        # Regular users only see their own tenant
        if self.request.user.tenant:
            return queryset.filter(id=self.request.user.tenant.id)
        return queryset.none()
    
    def update(self, request, *args, **kwargs):
        """Override update to ensure users can only update their own tenant"""
        instance = self.get_object()
        
        # Regular users can only update their own tenant
        if not request.user.is_saas_admin:
            if not request.user.tenant or instance.id != request.user.tenant.id:
                return Response(
                    {"detail": "You can only update your own tenant."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        """Override partial_update to ensure users can only update their own tenant"""
        instance = self.get_object()
        
        # Regular users can only update their own tenant
        if not request.user.is_saas_admin:
            if not request.user.tenant or instance.id != request.user.tenant.id:
                return Response(
                    {"detail": "You can only update your own tenant."},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        return super().partial_update(request, *args, **kwargs)
    
    def create(self, request, *args, **kwargs):
        """Override create to log validation errors"""
        logger.info(f"Creating tenant with data: {request.data}")
        logger.info(f"User: {request.user}, Is SaaS Admin: {getattr(request.user, 'is_saas_admin', False)}")
        
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"Tenant validation errors: {serializer.errors}")
            # Return detailed error message
            error_detail = serializer.errors
            if isinstance(error_detail, dict):
                # Format errors nicely
                error_messages = []
                for field, errors in error_detail.items():
                    if isinstance(errors, list):
                        error_messages.extend([f"{field}: {error}" for error in errors])
                    else:
                        error_messages.append(f"{field}: {errors}")
                error_detail = {'detail': '; '.join(error_messages), 'errors': serializer.errors}
            return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
        
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        """Set tenant for regular users during creation"""
        # If user is not SaaS admin, they're creating their own tenant
        # The tenant will be automatically associated with them
        tenant = serializer.save()
        
        # If user doesn't have a tenant yet, associate this one
        if not self.request.user.is_saas_admin and not self.request.user.tenant:
            # Refresh user from database to ensure we have the latest instance
            user = User.objects.get(pk=self.request.user.pk)
            user.tenant = tenant
            user.save(update_fields=['tenant'])
            # Update request.user to reflect the change
            self.request.user.tenant = tenant
        
        return tenant
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current user's tenant"""
        if request.user.is_saas_admin:
            return Response({"detail": "SaaS admins don't have a tenant"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not request.user.tenant:
            return Response({"detail": "User has no tenant"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = self.get_serializer(request.user.tenant)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], url_path='upload-logo')
    def upload_logo(self, request):
        """Upload business logo for current user's tenant"""
        if not request.user.tenant:
            return Response(
                {"detail": "User has no tenant"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        tenant = request.user.tenant
        
        # Check if user can upload logo (owner or admin)
        if not request.user.is_saas_admin and request.user.tenant.id != tenant.id:
            return Response(
                {"detail": "You don't have permission to upload logo for this tenant"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get file from request
        file = request.FILES.get('file')
        if not file:
            return Response(
                {"detail": "No file provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file type
        allowed_types = ['image/png', 'image/jpeg', 'image/webp']
        if file.content_type not in allowed_types:
            return Response(
                {"detail": "Invalid file type. Allowed: PNG, JPG, WebP"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file size (max 5MB)
        max_size = 5 * 1024 * 1024  # 5MB
        if file.size > max_size:
            return Response(
                {"detail": "File size exceeds 5MB limit"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Delete old logo if exists
        if tenant.logo:
            try:
                tenant.logo.delete(save=False)
            except Exception as e:
                logger.warning(f"Failed to delete old logo for tenant {tenant.id}: {str(e)}")
        
        # Save new logo
        tenant.logo = file
        tenant.save(update_fields=['logo'])
        
        # Return updated tenant with logo URL
        serializer = self.get_serializer(tenant)
        return Response(
            {
                "detail": "Logo uploaded successfully",
                "logo": request.build_absolute_uri(tenant.logo.url) if tenant.logo else None,
                "tenant": serializer.data
            },
            status=status.HTTP_200_OK
        )

