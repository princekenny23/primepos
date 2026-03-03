from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Count, Sum, Q
from django.utils import timezone
from datetime import timedelta
from apps.tenants.models import Tenant
from apps.tenants.serializers import TenantSerializer, TenantPermissionsSerializer
from apps.tenants.permissions import IsSaaSAdmin
from apps.outlets.models import Outlet
from apps.accounts.models import User
from apps.sales.models import Sale


class AdminTenantViewSet(viewsets.ModelViewSet):
    """Admin ViewSet for tenant management (SaaS admin only)"""
    queryset = Tenant.objects.prefetch_related('outlets', 'users').all()
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated, IsSaaSAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['type', 'is_active']
    search_fields = ['name', 'email', 'phone']
    ordering_fields = ['created_at', 'name']
    ordering = ['-created_at']
    
    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """Suspend a tenant"""
        tenant = self.get_object()
        reason = request.data.get('reason', '')
        
        tenant.is_active = False
        tenant.save()
        
        # Log suspension reason in settings
        if 'suspension_history' not in tenant.settings:
            tenant.settings['suspension_history'] = []
        tenant.settings['suspension_history'].append({
            'date': timezone.now().isoformat(),
            'reason': reason,
            'suspended_by': request.user.id
        })
        tenant.save()
        
        return Response({"message": "Tenant suspended successfully"})
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a tenant"""
        tenant = self.get_object()
        tenant.is_active = True
        tenant.save()
        return Response({"message": "Tenant activated successfully"})
    
    @action(detail=True, methods=['get', 'put', 'patch'], url_path='permissions')
    def permissions(self, request, pk=None):
        """Get or update tenant permissions"""
        tenant = self.get_object()
        
        # Get or create permissions instance
        from apps.tenants.models import TenantPermissions
        permissions_obj, created = TenantPermissions.objects.get_or_create(tenant=tenant)
        
        if request.method == 'GET':
            serializer = TenantPermissionsSerializer(permissions_obj)
            data = serializer.data
            data['has_distribution'] = tenant.has_distribution
            return Response(data)
        
        elif request.method in ['PUT', 'PATCH']:
            partial = request.method == 'PATCH'
            request_data = request.data.copy()
            has_distribution = request_data.pop('has_distribution', None)
            serializer = TenantPermissionsSerializer(
                permissions_obj, 
                data=request_data,
                partial=partial
            )
            
            if serializer.is_valid():
                serializer.save()
                if has_distribution is not None:
                    tenant.has_distribution = str(has_distribution).lower() in ['true', '1', 'yes', 'on']
                    tenant.save(update_fields=['has_distribution'])
                response_data = serializer.data
                response_data['has_distribution'] = tenant.has_distribution
                return Response(response_data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSaaSAdmin])
def platform_analytics(request):
    """Platform-wide analytics for SaaS admin"""
    # Total tenants
    total_tenants = Tenant.objects.count()
    active_tenants = Tenant.objects.filter(is_active=True).count()
    
    # Total outlets
    total_outlets = Outlet.objects.count()
    
    # Total users
    total_users = User.objects.count()
    
    # Revenue (from all sales)
    total_revenue = Sale.objects.aggregate(Sum('total'))['total__sum'] or 0
    
    # Tenant growth (last 30 days)
    thirty_days_ago = timezone.now() - timedelta(days=30)
    new_tenants = Tenant.objects.filter(created_at__gte=thirty_days_ago).count()
    
    # Business type distribution
    type_distribution = Tenant.objects.values('type').annotate(count=Count('id'))
    
    return Response({
        'total_tenants': total_tenants,
        'active_tenants': active_tenants,
        'total_outlets': total_outlets,
        'total_users': total_users,
        'total_revenue': float(total_revenue),
        'new_tenants_30d': new_tenants,
        'type_distribution': list(type_distribution),
    })

