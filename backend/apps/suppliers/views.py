from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction
from django.utils import timezone
from .models import (
    Supplier, PurchaseOrder, SupplierInvoice,
    PurchaseReturn, ProductSupplier
)
from .serializers import (
    SupplierSerializer, PurchaseOrderSerializer,
    SupplierInvoiceSerializer, PurchaseReturnSerializer,
    ProductSupplierSerializer
)
from apps.tenants.permissions import TenantFilterMixin, HasTenantModuleAccess, is_admin_user
import logging

logger = logging.getLogger(__name__)


class SupplierViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Supplier ViewSet"""
    queryset = Supplier.objects.select_related('tenant', 'outlet')
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_inventory']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'outlet', 'is_active']
    search_fields = ['name', 'contact_name', 'email', 'phone']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        """Ensure tenant and outlet filtering is applied"""
        queryset = super().get_queryset()
        user = self.request.user
        is_saas_admin = getattr(user, 'is_saas_admin', False)
        
        # Ensure tenant filter is applied (TenantFilterMixin should handle this, but double-check)
        if not is_saas_admin:
            request_tenant = getattr(self.request, 'tenant', None)
            user_tenant = getattr(user, 'tenant', None)
            tenant = request_tenant or user_tenant
            
            if tenant:
                # Explicitly filter by tenant to ensure it's applied
                queryset = queryset.filter(tenant=tenant)
            else:
                queryset = queryset.none()
        
        # Apply outlet filter if provided (suppliers can be outlet-specific or tenant-level)
        outlet = self.get_outlet_for_request(self.request)
        if outlet:
            queryset = queryset.filter(outlet=outlet)
        
        return queryset
    
    def get_serializer_context(self):
        """Add request to serializer context"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def create(self, request, *args, **kwargs):
        """Override create to log validation errors"""
        logger.info(f"Creating supplier with data: {request.data}")
        logger.info(f"User: {request.user}, Tenant: {getattr(request.user, 'tenant', None)}")
        
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"Validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        """Always set tenant from request context (frontend doesn't send it)"""
        if hasattr(self.request, 'tenant') and self.request.tenant:
            serializer.save(tenant=self.request.tenant)
        elif self.request.user.tenant:
            serializer.save(tenant=self.request.user.tenant)
        else:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required. Please ensure you are authenticated and have a tenant assigned.")
    
    def update(self, request, *args, **kwargs):
        """Override update to check permissions"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to update this supplier."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to check permissions"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to delete this supplier."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)


class PurchaseOrderViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Purchase Order ViewSet - outlet-specific"""
    queryset = PurchaseOrder.objects.select_related('tenant', 'supplier', 'outlet', 'created_by')
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_inventory']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'supplier', 'outlet', 'status']
    search_fields = ['po_number', 'notes']
    ordering_fields = ['order_date', 'created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter by tenant and outlet"""
        queryset = super().get_queryset()
        user = self.request.user
        is_saas_admin = getattr(user, 'is_saas_admin', False)
        
        # Apply tenant filter
        if not is_saas_admin:
            request_tenant = getattr(self.request, 'tenant', None)
            user_tenant = getattr(user, 'tenant', None)
            tenant = request_tenant or user_tenant
            
            if tenant:
                queryset = queryset.filter(tenant=tenant)
            else:
                return queryset.none()
        
        # Apply outlet filter (purchase orders are outlet-specific)
        outlet = self.get_outlet_for_request(self.request)
        if outlet:
            queryset = queryset.filter(outlet=outlet)
        else:
            # If no outlet specified, return empty queryset (POs require outlet)
            return queryset.none()
        
        return queryset
    
    def get_serializer_context(self):
        """Add request to serializer context"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def perform_create(self, serializer):
        """Set tenant, outlet, and created_by"""
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required.")
        
        # Get outlet from request (required for purchase orders)
        outlet = self.get_outlet_for_request(self.request)
        if not outlet:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Outlet is required for purchase orders. Please specify X-Outlet-ID header or ?outlet=id query parameter.")
        
        # Verify outlet belongs to tenant
        if outlet.tenant != tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Outlet does not belong to your tenant.")
        
        serializer.save(tenant=tenant, outlet=outlet, created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve purchase order"""
        po = self.get_object()
        if po.status != 'pending':
            return Response(
                {"detail": f"Cannot approve PO with status '{po.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        po.status = 'approved'
        po.approved_at = timezone.now()
        po.save()
        
        serializer = self.get_serializer(po)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Mark purchase order as received"""
        po = self.get_object()
        if po.status not in ['approved', 'ordered', 'partial']:
            return Response(
                {"detail": f"Cannot receive PO with status '{po.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        po.status = 'received'
        po.received_at = timezone.now()
        po.save()
        
        serializer = self.get_serializer(po)
        return Response(serializer.data)


class SupplierInvoiceViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Supplier Invoice ViewSet - outlet-specific"""
    queryset = SupplierInvoice.objects.select_related('tenant', 'supplier', 'purchase_order', 'outlet')
    serializer_class = SupplierInvoiceSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_inventory']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'supplier', 'outlet', 'status']
    search_fields = ['invoice_number', 'supplier_invoice_number']
    ordering_fields = ['invoice_date', 'due_date', 'created_at']
    ordering = ['-invoice_date']
    
    def get_queryset(self):
        """Filter by tenant and outlet"""
        queryset = super().get_queryset()
        user = self.request.user
        is_saas_admin = getattr(user, 'is_saas_admin', False)
        
        # Apply tenant filter
        if not is_saas_admin:
            request_tenant = getattr(self.request, 'tenant', None)
            user_tenant = getattr(user, 'tenant', None)
            tenant = request_tenant or user_tenant
            
            if tenant:
                queryset = queryset.filter(tenant=tenant)
            else:
                return queryset.none()
        
        # Apply outlet filter (invoices are outlet-specific)
        outlet = self.get_outlet_for_request(self.request)
        if outlet:
            queryset = queryset.filter(outlet=outlet)
        else:
            # If no outlet specified, return empty queryset (invoices require outlet)
            return queryset.none()
        
        return queryset
    
    def perform_create(self, serializer):
        """Set tenant and outlet"""
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required.")
        
        # Get outlet from request (required for invoices)
        outlet = self.get_outlet_for_request(self.request)
        if not outlet:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Outlet is required for supplier invoices. Please specify X-Outlet-ID header or ?outlet=id query parameter.")
        
        # Verify outlet belongs to tenant
        if outlet.tenant != tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Outlet does not belong to your tenant.")
        
        serializer.save(tenant=tenant, outlet=outlet)
    
    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        """Record payment against invoice"""
        invoice = self.get_object()
        amount = request.data.get('amount')
        
        if not amount:
            return Response(
                {"detail": "Payment amount is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from decimal import Decimal
            amount = Decimal(str(amount))
            invoice.amount_paid += amount
            invoice.update_status()
            
            serializer = self.get_serializer(invoice)
            return Response(serializer.data)
        except (ValueError, TypeError):
            return Response(
                {"detail": "Invalid payment amount"},
                status=status.HTTP_400_BAD_REQUEST
            )


class PurchaseReturnViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Purchase Return ViewSet - outlet-specific"""
    queryset = PurchaseReturn.objects.select_related('tenant', 'supplier', 'purchase_order', 'outlet', 'created_by')
    serializer_class = PurchaseReturnSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_inventory']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'supplier', 'outlet', 'status']
    search_fields = ['return_number', 'reason']
    ordering_fields = ['return_date', 'created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter by tenant and outlet"""
        queryset = super().get_queryset()
        user = self.request.user
        is_saas_admin = getattr(user, 'is_saas_admin', False)
        
        # Apply tenant filter
        if not is_saas_admin:
            request_tenant = getattr(self.request, 'tenant', None)
            user_tenant = getattr(user, 'tenant', None)
            tenant = request_tenant or user_tenant
            
            if tenant:
                queryset = queryset.filter(tenant=tenant)
            else:
                return queryset.none()
        
        # Apply outlet filter (returns are outlet-specific)
        outlet = self.get_outlet_for_request(self.request)
        if outlet:
            queryset = queryset.filter(outlet=outlet)
        else:
            # If no outlet specified, return empty queryset (returns require outlet)
            return queryset.none()
        
        return queryset
    
    def get_serializer_context(self):
        """Add request to serializer context"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def perform_create(self, serializer):
        """Set tenant, outlet, and created_by"""
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required.")
        
        # Get outlet from request (required for purchase returns)
        outlet = self.get_outlet_for_request(self.request)
        if not outlet:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Outlet is required for purchase returns. Please specify X-Outlet-ID header or ?outlet=id query parameter.")
        
        # Verify outlet belongs to tenant
        if outlet.tenant != tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Outlet does not belong to your tenant.")
        
        serializer.save(tenant=tenant, outlet=outlet, created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve purchase return"""
        purchase_return = self.get_object()
        if purchase_return.status != 'pending':
            return Response(
                {"detail": f"Cannot approve return with status '{purchase_return.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        purchase_return.status = 'approved'
        purchase_return.save()
        
        serializer = self.get_serializer(purchase_return)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark purchase return as completed"""
        purchase_return = self.get_object()
        if purchase_return.status != 'approved':
            return Response(
                {"detail": f"Cannot complete return with status '{purchase_return.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        purchase_return.status = 'returned'
        purchase_return.returned_at = timezone.now()
        purchase_return.save()
        
        
        serializer = self.get_serializer(purchase_return)
        return Response(serializer.data)


class ProductSupplierViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Product Supplier relationship ViewSet"""
    queryset = ProductSupplier.objects.select_related('tenant', 'product', 'supplier')
    serializer_class = ProductSupplierSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_inventory']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'product', 'supplier', 'is_preferred', 'is_active']
    search_fields = ['product__name', 'supplier__name']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_serializer_context(self):
        """Add request to serializer context"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def perform_create(self, serializer):
        """Set tenant"""
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        serializer.save(tenant=tenant)



