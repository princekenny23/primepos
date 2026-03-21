from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction
from django.utils import timezone
from .models import Quotation, QuotationItem
from .serializers import QuotationSerializer, QuotationItemSerializer
from apps.tenants.permissions import TenantFilterMixin, HasTenantModuleAccess
from apps.sales.models import Sale, SaleItem


class QuotationViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Quotation ViewSet"""
    queryset = Quotation.objects.select_related(
        'tenant', 'outlet', 'user', 'customer'
    ).prefetch_related('items', 'items__product').all()
    serializer_class = QuotationSerializer
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_sales']
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['outlet', 'status', 'customer']
    search_fields = ['quotation_number', 'customer_name']
    ordering_fields = ['created_at', 'total', 'valid_until']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Ensure tenant filtering is applied"""
        queryset = super().get_queryset()
        user = self.request.user
        
        # SaaS admins can see all
        if getattr(user, 'is_saas_admin', False):
            return queryset
        
        # Filter by tenant
        tenant = getattr(self.request, 'tenant', None) or getattr(user, 'tenant', None)
        if tenant:
            queryset = queryset.filter(tenant=tenant)
        else:
            queryset = queryset.none()
        
        return queryset

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Send quotation (change status to 'sent')"""
        quotation = self.get_object()
        quotation.status = 'sent'
        quotation.save()
        serializer = self.get_serializer(quotation)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def convert_to_sale(self, request, pk=None):
        """Convert quotation to sale"""
        quotation = self.get_object()
        
        if quotation.status == 'converted':
            return Response(
                {"error": "Quotation has already been converted to a sale"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with transaction.atomic():
                # Create sale from quotation
                sale = Sale.objects.create(
                    tenant=quotation.tenant,
                    outlet=quotation.outlet,
                    user=request.user,
                    customer=quotation.customer,
                    subtotal=quotation.subtotal,
                    discount=quotation.discount,
                    tax=quotation.tax,
                    total=quotation.total,
                    payment_method='cash',  # Default, can be changed
                    status='completed',
                    notes=f"Converted from quotation {quotation.quotation_number}",
                )
                
                # Create sale items from quotation items
                for item in quotation.items.all():
                    SaleItem.objects.create(
                        sale=sale,
                        product=item.product,
                        product_name=item.product_name,
                        quantity=item.quantity,
                        price=item.price,
                        total=item.total,
                    )
                
                # Update quotation status
                quotation.status = 'converted'
                quotation.save()
                
                return Response({
                    "sale_id": sale.id,
                    "receipt_number": sale.receipt_number,
                    "message": "Quotation converted to sale successfully"
                })
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

