from rest_framework import viewsets, status, serializers
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Count, Sum, Q
from django.db.models.deletion import ProtectedError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from apps.tenants.models import Tenant, TenantPaymentRecord
from apps.tenants.serializers import TenantSerializer, TenantPermissionsSerializer
from apps.tenants.permissions import IsSaaSAdmin
from apps.outlets.models import Outlet
from apps.accounts.models import User
from apps.sales.models import Sale


class TenantPaymentRecordSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TenantPaymentRecord
        fields = (
            'id',
            'tenant',
            'amount',
            'reason',
            'notes',
            'payment_date',
            'recorded_by',
            'recorded_by_name',
            'created_at',
        )
        read_only_fields = (
            'id',
            'tenant',
            'recorded_by',
            'recorded_by_name',
            'created_at',
        )

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by:
            return None
        return obj.recorded_by.name or obj.recorded_by.email


class AdminTenantViewSet(viewsets.ModelViewSet):
    """Admin ViewSet for tenant management (SaaS admin only)"""
    queryset = Tenant.objects.prefetch_related('outlets', 'users', 'payment_records').all()
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated, IsSaaSAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['type', 'is_active']
    search_fields = ['name', 'email', 'phone']
    ordering_fields = ['created_at', 'name']
    ordering = ['-created_at']

    def _purge_tenant_dependencies(self, tenant):
        from apps.bar.models import Tab, TabItem
        from apps.distribution.models import DeliveryOrder, DeliveryOrderItem, Trip
        from apps.storefronts.models import Storefront

        Storefront.objects.filter(tenant=tenant).delete()
        Trip.objects.filter(tenant=tenant).delete()
        DeliveryOrderItem.objects.filter(tenant=tenant).delete()
        DeliveryOrder.objects.filter(tenant=tenant).delete()
        TabItem.objects.filter(tab__tenant=tenant).delete()
        Tab.objects.filter(tenant=tenant).delete()

    def destroy(self, request, *args, **kwargs):
        """Delete tenant safely and return a user-friendly conflict when protected relations exist."""
        instance = self.get_object()
        try:
            with transaction.atomic():
                self._purge_tenant_dependencies(instance)
                self.perform_destroy(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProtectedError as exc:
            blocked_models = sorted({obj.__class__.__name__ for obj in exc.protected_objects})
            return Response(
                {
                    "detail": "Tenant cannot be deleted because it still has linked records.",
                    "blocked_by_models": blocked_models,
                    "blocked_count": len(exc.protected_objects),
                    "suggestion": "Suspend the tenant first, or delete related records before retrying.",
                },
                status=status.HTTP_409_CONFLICT,
            )
    
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

    @action(detail=True, methods=['get', 'post'], url_path='payments')
    def payments(self, request, pk=None):
        """Get tenant payment history or record a new manual payment."""
        tenant = self.get_object()

        if request.method == 'GET':
            payment_qs = tenant.payment_records.select_related('recorded_by').all()
            total_paid = payment_qs.aggregate(total=Sum('amount')).get('total') or 0

            return Response({
                'tenant_id': str(tenant.id),
                'tenant_name': tenant.name,
                'total_paid': float(total_paid),
                'payment_count': payment_qs.count(),
                'payments': TenantPaymentRecordSerializer(payment_qs, many=True).data,
            })

        amount_raw = request.data.get('amount')
        reason = (request.data.get('reason') or '').strip()
        notes = (request.data.get('notes') or '').strip()

        if not amount_raw:
            return Response({'detail': 'Amount is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not reason:
            return Response({'detail': 'Reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount_raw))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'detail': 'Amount must be a valid number.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({'detail': 'Amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        payment_date_raw = request.data.get('payment_date')
        payment_date = timezone.now()
        if payment_date_raw:
            parsed_payment_date = parse_datetime(str(payment_date_raw))
            if not parsed_payment_date:
                return Response({'detail': 'payment_date must be a valid ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
            if parsed_payment_date.tzinfo is None:
                parsed_payment_date = timezone.make_aware(parsed_payment_date, timezone.get_current_timezone())
            payment_date = parsed_payment_date

        payment = TenantPaymentRecord.objects.create(
            tenant=tenant,
            amount=amount,
            reason=reason,
            notes=notes,
            payment_date=payment_date,
            recorded_by=request.user,
        )

        payment_qs = tenant.payment_records.all()
        total_paid = payment_qs.aggregate(total=Sum('amount')).get('total') or 0

        return Response({
            'message': 'Payment recorded successfully.',
            'total_paid': float(total_paid),
            'payment_count': payment_qs.count(),
            'payment': TenantPaymentRecordSerializer(payment).data,
        }, status=status.HTTP_201_CREATED)


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

