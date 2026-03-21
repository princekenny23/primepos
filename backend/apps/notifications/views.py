from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from django.db.models import Q, Count
from .models import Notification, NotificationPreference
from .serializers import NotificationSerializer, NotificationPreferenceSerializer
from apps.tenants.permissions import TenantFilterMixin, HasTenantModuleAccess
from rest_framework.permissions import IsAuthenticated


class NotificationViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """
    ViewSet for managing notifications
    """
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_dashboard']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['type', 'priority', 'read']
    search_fields = ['title', 'message']
    ordering_fields = ['created_at', 'priority']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter notifications for current user or tenant-wide"""
        queryset = super().get_queryset()
        
        # Get tenant from request
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return queryset.none()
        
        # Filter by tenant
        queryset = queryset.filter(tenant=tenant)
        
        # Filter by outlet if provided (check metadata for outlet_id)
        outlet_id = self.request.query_params.get('outlet_id')
        if outlet_id:
            try:
                outlet_id_int = int(outlet_id)
                # Filter by metadata containing outlet_id
                queryset = queryset.filter(metadata__outlet_id=outlet_id_int)
            except (ValueError, TypeError):
                # If outlet_id is not a valid integer, ignore the filter
                pass
        
        # Filter by user: show user-specific notifications OR tenant-wide (user=null)
        user = self.request.user
        queryset = queryset.filter(Q(user=user) | Q(user__isnull=True))
        
        return queryset.select_related('tenant', 'user')
    
    def perform_create(self, serializer):
        """Set tenant and user when creating notification"""
        tenant = getattr(self.request, 'tenant', None)
        serializer.save(tenant=tenant)
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark notification as read"""
        notification = self.get_object()
        if not notification.read:
            notification.read = True
            notification.save(update_fields=['read', 'updated_at'])
        serializer = self.get_serializer(notification)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        """Mark all unread notifications as read"""
        queryset = self.get_queryset().filter(read=False)
        count = queryset.update(read=True, updated_at=timezone.now())
        return Response({'message': f'{count} notifications marked as read.'})
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications"""
        count = self.get_queryset().filter(read=False).count()
        return Response({'unread_count': count})
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get notification summary"""
        queryset = self.get_queryset()
        
        total = queryset.count()
        unread = queryset.filter(read=False).count()
        by_type = queryset.values('type').annotate(count=Count('id'))
        by_priority = queryset.values('priority').annotate(count=Count('id'))
        
        return Response({
            'total': total,
            'unread': unread,
            'read': total - unread,
            'by_type': {item['type']: item['count'] for item in by_type},
            'by_priority': {item['priority']: item['count'] for item in by_priority},
        })


class NotificationPreferenceViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    queryset = NotificationPreference.objects.all()
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_settings']
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['user', 'tenant']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-updated_at']

    def get_queryset(self):
        queryset = super().get_queryset()
        # Users should only see their own preferences
        if not self.request.user.is_saas_admin:
            queryset = queryset.filter(user=self.request.user)
        return queryset.select_related('user', 'tenant')

    def perform_create(self, serializer):
        """Set user and tenant from request"""
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        serializer.save(user=self.request.user, tenant=tenant)

    @action(detail=False, methods=['get'], url_path='my-preferences')
    def my_preferences(self, request):
        """Get current user's notification preferences"""
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        try:
            preferences = NotificationPreference.objects.get(user=request.user, tenant=tenant)
            serializer = self.get_serializer(preferences)
            return Response(serializer.data)
        except NotificationPreference.DoesNotExist:
            # Create default preferences if they don't exist
            preferences = NotificationPreference.objects.create(
                user=request.user,
                tenant=tenant
            )
            serializer = self.get_serializer(preferences)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

