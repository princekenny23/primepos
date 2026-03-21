from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Q, Sum, Count
from django.utils import timezone
from datetime import datetime, timedelta
from .models import Expense
from .serializers import ExpenseSerializer
from apps.tenants.permissions import TenantFilterMixin, HasTenantModuleAccess


class ExpenseViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Expense ViewSet with tenant filtering"""
    queryset = Expense.objects.select_related('tenant', 'outlet', 'user').all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_office']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'outlet', 'category', 'status', 'payment_method']
    search_fields = ['expense_number', 'title', 'description', 'vendor']
    ordering_fields = ['expense_date', 'amount', 'created_at']
    ordering = ['-expense_date', '-created_at']
    
    def get_queryset(self):
        """Apply tenant filtering and additional filters"""
        queryset = super().get_queryset()
        
        # Apply outlet filter if provided
        outlet = self.get_outlet_for_request(self.request)
        if outlet:
            queryset = queryset.filter(outlet=outlet)
        elif self.request.query_params.get('outlet'):
            outlet_id = self.request.query_params.get('outlet')
            try:
                queryset = queryset.filter(outlet_id=outlet_id)
            except (ValueError, TypeError):
                pass
        
        # Filter by date range if provided
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(expense_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(expense_date__lte=end_date)
        
        return queryset
    
    def perform_create(self, serializer):
        """Set tenant and user on create"""
        tenant = self.require_tenant(self.request)
        serializer.save(tenant=tenant, user=self.request.user)
    
    def update(self, request, *args, **kwargs):
        """Override update to ensure tenant matches"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin)
        if not request.user.is_saas_admin and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to update this expense."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure tenant matches"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin)
        if not request.user.is_saas_admin and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to delete this expense."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get expense statistics"""
        queryset = self.get_queryset()
        
        # Total expenses
        total_expenses = queryset.aggregate(total=Sum('amount'))['total'] or 0
        
        # Today's expenses
        today = timezone.now().date()
        today_expenses = queryset.filter(expense_date=today).aggregate(
            total=Sum('amount')
        )['total'] or 0
        
        # Pending approval count
        pending_count = queryset.filter(status='pending').count()
        
        # Category breakdown
        category_breakdown = queryset.values('category').annotate(
            total=Sum('amount'),
            count=Count('id')
        ).order_by('-total')
        
        # Status breakdown
        status_breakdown = queryset.values('status').annotate(
            total=Sum('amount'),
            count=Count('id')
        )
        
        return Response({
            'total_expenses': float(total_expenses),
            'today_expenses': float(today_expenses),
            'pending_count': pending_count,
            'category_breakdown': list(category_breakdown),
            'status_breakdown': list(status_breakdown),
        })
    
    @action(detail=True, methods=['patch'])
    def approve(self, request, pk=None):
        """Approve an expense"""
        expense = self.get_object()
        notes = request.data.get('notes', '')
        
        expense.status = 'approved'
        expense.approved_by = request.user
        expense.approved_at = timezone.now()
        expense.approval_notes = notes
        expense.save()
        
        serializer = self.get_serializer(expense)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch'])
    def reject(self, request, pk=None):
        """Reject an expense"""
        expense = self.get_object()
        notes = request.data.get('notes', '')
        
        expense.status = 'rejected'
        expense.rejected_by = request.user
        expense.rejected_at = timezone.now()
        expense.approval_notes = notes  # Store rejection reason in approval_notes
        expense.save()
        
        serializer = self.get_serializer(expense)
        return Response(serializer.data)

