from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction, IntegrityError
from django.utils import timezone
from datetime import date
from decimal import Decimal, InvalidOperation
from .models import Shift
from .serializers import ShiftSerializer
from apps.outlets.models import Till, Outlet
from apps.tenants.permissions import TenantFilterMixin
from apps.tenants.permissions import is_admin_user


class ShiftViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Shift ViewSet"""
    queryset = Shift.objects.select_related('outlet', 'outlet__tenant', 'till', 'user')
    serializer_class = ShiftSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['outlet', 'till', 'status', 'operating_date']
    ordering_fields = ['start_time', 'operating_date']
    ordering = ['-start_time']
    
    def get_queryset(self):
        """Filter shifts by tenant through outlet - ensure tenant filtering"""
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
        queryset = Shift.objects.select_related('outlet', 'outlet__tenant', 'till', 'user').all()
        
        # Apply tenant filter through outlet - CRITICAL for security
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(outlet__tenant=tenant)
            else:
                return queryset.none()
        
        # Apply outlet filter if provided (for outlet isolation)
        outlet = self.get_outlet_for_request(self.request)
        if outlet:
            queryset = queryset.filter(outlet=outlet)
        # Also check explicit outlet filter in query params (for backward compatibility)
        elif self.request.query_params.get('outlet'):
            outlet_id = self.request.query_params.get('outlet')
            try:
                queryset = queryset.filter(outlet_id=outlet_id)
            except (ValueError, TypeError):
                pass
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def start(self, request):
        """Start a new shift"""
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        if not tenant:
            return Response(
                {"detail": "User must have a tenant"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        outlet_id = serializer.validated_data.get('outlet_id')
        till_id = serializer.validated_data.get('till_id')
        operating_date = serializer.validated_data.get('operating_date', date.today())
        
        # CRITICAL: Validate outlet belongs to tenant
        from apps.outlets.models import Outlet
        try:
            outlet = Outlet.objects.get(id=outlet_id, tenant=tenant)
        except Outlet.DoesNotExist:
            return Response(
                {"detail": "Outlet does not belong to your tenant."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # CRITICAL: Validate till belongs to tenant through outlet
        try:
            till = Till.objects.get(id=till_id, outlet__tenant=tenant)
        except Till.DoesNotExist:
            return Response(
                {"detail": "Till does not belong to your tenant."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if shift already exists - with tenant filter
        existing_shift = Shift.objects.filter(
            outlet_id=outlet_id,
            till_id=till_id,
            operating_date=operating_date,
            status='OPEN',
            outlet__tenant=tenant  # CRITICAL: Ensure tenant matches
        ).first()
        
        if existing_shift:
            return Response(
                {"detail": "A shift already exists for this outlet, date, and till combination."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if till is in use
        if till.is_in_use:
            return Response(
                {"detail": "This till is currently in use. Please select another till."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Mark till as in use
        till.is_in_use = True
        till.save()
        
        # Create shift
        shift = serializer.save(user=request.user, status='OPEN')
        
        # Create notification for shift opened (Square POS-like)
        try:
            from apps.notifications.services import NotificationService
            NotificationService.notify_shift_opened(shift)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create shift opened notification: {str(e)}")
        
        response_serializer = ShiftSerializer(shift)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close a shift and calculate system totals"""
        shift = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # CRITICAL: Verify tenant matches through outlet (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and shift.outlet.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to close this shift."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if shift.status == 'CLOSED':
            return Response(
                {"detail": "Shift is already closed"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        closing_cash_balance = request.data.get('closing_cash_balance')
        if closing_cash_balance is None:
            return Response(
                {"detail": "closing_cash_balance is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            closing_cash_balance = Decimal(str(closing_cash_balance))
        except (ValueError, InvalidOperation):
            return Response(
                {"detail": "closing_cash_balance must be a valid number"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with transaction.atomic():
                shift.closing_cash_balance = closing_cash_balance
                shift.status = 'CLOSED'
                shift.end_time = timezone.now()
                shift.save()
            
            # Mark till as available (if till exists)
            if shift.till:
                try:
                    shift.till.is_in_use = False
                    shift.till.save()
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to update till status: {str(e)}")
                    # Don't fail the shift close if till update fails
            
                # Create notification for shift closed (Square POS-like)
                try:
                    from apps.notifications.services import NotificationService
                    NotificationService.notify_shift_closed(shift)
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to create shift closed notification: {str(e)}")
        except IntegrityError:
            return Response(
                {"detail": "Unable to close shift due to a data conflict. Please retry or contact support."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        response_serializer = ShiftSerializer(shift)
        return Response(response_serializer.data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get active shift for current user"""
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        if not tenant:
            return Response({"detail": "User must have a tenant"}, status=status.HTTP_400_BAD_REQUEST)
        
        outlet_id = request.query_params.get('outlet_id')
        if not outlet_id:
            return Response({"detail": "outlet_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # CRITICAL: Filter by tenant through outlet
        shift = Shift.objects.filter(
            outlet_id=outlet_id,
            outlet__tenant=tenant,  # CRITICAL: Ensure tenant matches
            user=request.user,
            status='OPEN'
        ).first()
        
        if not shift:
            return Response({"detail": "No active shift found"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='current')
    def current(self, request):
        """Get current open shift (more flexible than active - can filter by outlet/till)"""
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        if not tenant:
            return Response({"detail": "User must have a tenant"}, status=status.HTTP_400_BAD_REQUEST)
        
        outlet_id = request.query_params.get('outlet_id')
        till_id = request.query_params.get('till_id')
        
        # Build query
        query = {
            'outlet__tenant': tenant,  # CRITICAL: Ensure tenant matches
            'status': 'OPEN'
        }
        
        if outlet_id:
            query['outlet_id'] = outlet_id
        if till_id:
            query['till_id'] = till_id
        if not request.user.is_saas_admin:
            # For non-SaaS admins, also filter by user
            query['user'] = request.user
        
        # CRITICAL: Filter by tenant through outlet
        shift = Shift.objects.filter(**query).first()
        
        if not shift:
            return Response({"detail": "No open shift found"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get shift history"""
        queryset = self.filter_queryset(self.get_queryset())
        queryset = queryset.filter(status='CLOSED')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def check(self, request):
        """Check if shift exists"""
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        if not tenant:
            return Response({"exists": False})
        
        outlet_id = request.query_params.get('outlet_id')
        till_id = request.query_params.get('till_id')
        date_str = request.query_params.get('date')
        
        if not all([outlet_id, till_id, date_str]):
            return Response({"exists": False})
        
        try:
            operating_date = date.fromisoformat(date_str)
        except ValueError:
            return Response({"exists": False})
        
        # CRITICAL: Filter by tenant through outlet
        exists = Shift.objects.filter(
            outlet_id=outlet_id,
            outlet__tenant=tenant,  # CRITICAL: Ensure tenant matches
            till_id=till_id,
            operating_date=operating_date,
            status='OPEN'
        ).exists()
        
        return Response({"exists": exists})

