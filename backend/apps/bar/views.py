"""
Bar Management Views - Tabs, Tables, and all bar operations
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, Count, Max
from decimal import Decimal

from apps.tenants.permissions import TenantFilterMixin
from apps.customers.models import Customer
from apps.sales.models import Sale, SaleItem
from apps.products.models import Product, ProductUnit
from apps.shifts.models import Shift

from .models import BarTable, Tab, TabItem, TabTransfer, TabMerge
from .serializers import (
    BarTableSerializer,
    TabSerializer, TabListSerializer, TabItemSerializer, TabItemCreateSerializer,
    OpenTabSerializer, CloseTabSerializer, TransferTabSerializer,
    MergeTabsSerializer, SplitTabSerializer, VoidItemSerializer,
    TabTransferSerializer, TabMergeSerializer
)


class BarTableViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """
    ViewSet for Bar Tables management
    """
    queryset = BarTable.objects.all()
    serializer_class = BarTableSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'table_type', 'location', 'is_active', 'outlet']
    search_fields = ['number', 'location', 'notes']
    ordering_fields = ['number', 'created_at', 'status']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by outlet if provided
        outlet_id = self.request.query_params.get('outlet')
        if outlet_id:
            queryset = queryset.filter(outlet_id=outlet_id)
        return queryset.select_related('current_tab')
    
    def perform_create(self, serializer):
        """Set tenant when creating a new table"""
        tenant = self.require_tenant(self.request)
        
        # Outlet comes from serializer.validated_data (sent by frontend)
        # Only set tenant - outlet is already in the validated data
        serializer.save(tenant=tenant)
    
    def perform_update(self, serializer):
        """Update table - tenant already set, just save"""
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def set_status(self, request, pk=None):
        """Update table status"""
        table = self.get_object()
        new_status = request.data.get('status')
        
        if new_status not in dict(BarTable.STATUS_CHOICES):
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Don't allow marking as available if there's an open tab
        if new_status == 'available' and table.current_tab:
            return Response(
                {'error': 'Cannot mark as available while tab is open'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        table.status = new_status
        table.save(update_fields=['status', 'updated_at'])
        
        return Response(BarTableSerializer(table).data)
    
    @action(detail=False, methods=['get'])
    def floor_plan(self, request):
        """Get all tables formatted for floor plan display"""
        queryset = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(queryset, many=True)
        
        # Group by location
        locations = {}
        for table in serializer.data:
            location = table.get('location') or 'Main Area'
            if location not in locations:
                locations[location] = []
            locations[location].append(table)
        
        return Response({
            'locations': locations,
            'tables': serializer.data,
            'summary': {
                'total': queryset.count(),
                'available': queryset.filter(status='available').count(),
                'occupied': queryset.filter(status='occupied').count(),
                'reserved': queryset.filter(status='reserved').count(),
            }
        })


class TabViewSet(TenantFilterMixin, viewsets.ModelViewSet):
    """
    ViewSet for Bar Tabs management with all workflows
    """
    queryset = Tab.objects.all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'table', 'customer', 'outlet']
    search_fields = ['tab_number', 'customer_name', 'customer__name']
    ordering_fields = ['opened_at', 'total', 'tab_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return TabListSerializer
        return TabSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by outlet if provided
        outlet_id = self.request.query_params.get('outlet')
        if outlet_id:
            queryset = queryset.filter(outlet_id=outlet_id)
        
        # Filter open tabs only by default (unless specified)
        status_filter = self.request.query_params.get('status')
        if not status_filter and self.action == 'list':
            queryset = queryset.filter(status='open')
        
        return queryset.select_related(
            'customer', 'table', 'opened_by', 'closed_by'
        ).prefetch_related('items__product', 'items__added_by')
    
    # ==================== OPEN TAB ====================
    @action(detail=False, methods=['post'])
    def open(self, request):
        """
        Open a new tab
        Workflow 1: Walk-up customer (no table)
        Workflow 2: Seated customer (with table)
        """
        serializer = OpenTabSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        # Get tenant using the mixin helper
        tenant = self.require_tenant(request)
        outlet = self.get_outlet_for_request(request)
        
        with transaction.atomic():
            # Get customer if provided
            customer = None
            if data.get('customer_id'):
                customer = Customer.objects.get(id=data['customer_id'])
            
            # Get table if provided
            table = None
            if data.get('table_id'):
                table = BarTable.objects.get(id=data['table_id'])
            
            # Create tab
            tab = Tab.objects.create(
                tenant=tenant,
                outlet=outlet,
                customer=customer,
                customer_name=data.get('customer_name', ''),
                customer_phone=data.get('customer_phone', ''),
                table=table,
                opened_by=request.user,
                credit_limit=data.get('credit_limit'),
                notes=data.get('notes', ''),
            )
            
            # Update table status if table was assigned
            if table:
                table.open_tab(tab)
            
            return Response(
                TabSerializer(tab).data,
                status=status.HTTP_201_CREATED
            )
    
    # ==================== ADD ITEMS ====================
    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        """Add an item to the tab"""
        tab = self.get_object()
        
        if tab.status != 'open':
            return Response(
                {'error': 'Cannot add items to a closed tab'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = TabItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        # Get product and unit (variations deprecated)
        product = Product.objects.get(id=data['product_id'])
        variation = None
        unit = None
        if data.get('unit_id'):
            unit = ProductUnit.objects.get(id=data['unit_id'])
        
        # Determine price
        price = data.get('price')
        if price is None:
            if unit:
                price = unit.retail_price
            else:
                price = product.price
        
        # Create tab item
        item = TabItem.objects.create(
            tab=tab,
            product=product,
            unit=unit,
            quantity=data['quantity'],
            price=price,
            discount=data.get('discount', Decimal('0')),
            added_by=request.user,
            notes=data.get('notes', ''),
        )
        
        # Check credit limit warning
        warning = None
        if tab.is_over_limit:
            warning = f"Tab has exceeded credit limit of {tab.credit_limit}"
        
        return Response({
            'item': TabItemSerializer(item).data,
            'tab_total': float(tab.total),
            'warning': warning,
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def add_items(self, request, pk=None):
        """Add multiple items to the tab at once"""
        tab = self.get_object()
        
        if tab.status != 'open':
            return Response(
                {'error': 'Cannot add items to a closed tab'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        items_data = request.data.get('items', [])
        if not items_data:
            return Response(
                {'error': 'No items provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_items = []
        errors = []
        
        with transaction.atomic():
            for idx, item_data in enumerate(items_data):
                serializer = TabItemCreateSerializer(data=item_data)
                if not serializer.is_valid():
                    errors.append({'index': idx, 'errors': serializer.errors})
                    continue
                
                data = serializer.validated_data
                product = Product.objects.get(id=data['product_id'])
                unit = None
                if data.get('unit_id'):
                    unit = ProductUnit.objects.get(id=data['unit_id'])

                price = data.get('price')
                if price is None:
                    price = unit.retail_price if unit else product.price

                item = TabItem.objects.create(
                    tab=tab,
                    product=product,
                    variation=None,
                    unit=unit,
                    quantity=data['quantity'],
                    price=price,
                    discount=data.get('discount', Decimal('0')),
                    added_by=request.user,
                    notes=data.get('notes', ''),
                )
                created_items.append(item)
        
        return Response({
            'items': TabItemSerializer(created_items, many=True).data,
            'tab_total': float(tab.total),
            'errors': errors,
        }, status=status.HTTP_201_CREATED if created_items else status.HTTP_400_BAD_REQUEST)
    
    # ==================== VOID ITEM ====================
    @action(detail=True, methods=['post'], url_path='items/(?P<item_id>[^/.]+)/void')
    def void_item(self, request, pk=None, item_id=None):
        """Void an item from the tab"""
        tab = self.get_object()
        
        if tab.status != 'open':
            return Response(
                {'error': 'Cannot void items from a closed tab'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            item = tab.items.get(id=item_id, is_voided=False)
        except TabItem.DoesNotExist:
            return Response(
                {'error': 'Item not found or already voided'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = VoidItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        item.void(request.user, serializer.validated_data['reason'])
        
        return Response({
            'item': TabItemSerializer(item).data,
            'tab_total': float(tab.total),
        })
    
    # ==================== APPLY DISCOUNT ====================
    @action(detail=True, methods=['post'])
    def apply_discount(self, request, pk=None):
        """
        Apply a discount to the tab (can be updated before closing)
        """
        tab = self.get_object()
        
        if tab.status != 'open':
            return Response(
                {'error': 'Cannot apply discount to a closed tab'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        discount_type = request.data.get('discount_type', 'fixed')
        discount_value = Decimal(str(request.data.get('discount', 0)))
        discount_reason = request.data.get('reason', '')
        
        if discount_value < 0:
            return Response(
                {'error': 'Discount cannot be negative'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate discount amount
        if discount_type == 'percentage':
            if discount_value > 100:
                return Response(
                    {'error': 'Percentage discount cannot exceed 100%'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            discount_amount = (tab.subtotal * discount_value) / 100
        else:
            discount_amount = discount_value
            if discount_amount > tab.subtotal:
                return Response(
                    {'error': 'Discount cannot exceed subtotal'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Update tab
        tab.discount = discount_amount
        tab.total = tab.subtotal - discount_amount + tab.tax
        tab.save(update_fields=['discount', 'total', 'updated_at'])
        
        return Response({
            'tab': TabSerializer(tab).data,
            'discount_applied': float(discount_amount),
            'discount_type': discount_type,
            'discount_value': float(discount_value),
            'reason': discount_reason,
        })
    
    # ==================== CLOSE TAB ====================
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """
        Close tab and create a sale
        Converts tab to final sale record
        """
        tab = self.get_object()
        
        if tab.status != 'open':
            return Response(
                {'error': 'Tab is already closed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if tab.items.filter(is_voided=False).count() == 0:
            return Response(
                {'error': 'Cannot close tab with no items'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = CloseTabSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        # Get tenant and outlet
        tenant = self.require_tenant(request)
        outlet = self.get_outlet_for_request(request)
        
        with transaction.atomic():
            # Apply any additional discount
            additional_discount = data.get('discount', Decimal('0'))
            if data.get('discount_type') == 'percentage':
                additional_discount = (tab.subtotal * additional_discount) / 100
            
            tab.discount = additional_discount
            tab.recalculate_totals()
            
            # Get active shift
            shift = Shift.objects.filter(
                outlet=outlet,
                status='open'
            ).first()
            
            # Generate receipt number
            receipt_number = self._generate_receipt_number(tenant)
            
            # Calculate payment details
            payment_method = data['payment_method']
            cash_received = data.get('cash_received')
            change_given = Decimal('0')
            
            if payment_method == 'cash' and cash_received:
                change_given = cash_received - tab.total
            
            # Payment status for credit
            payment_status = 'paid'
            amount_paid = tab.total
            cash_amount = Decimal('0')
            card_amount = Decimal('0')
            mobile_amount = Decimal('0')
            if payment_method == 'credit':
                payment_status = 'unpaid'
                amount_paid = Decimal('0')
            elif payment_method == 'cash':
                cash_amount = tab.total
            elif payment_method == 'card':
                card_amount = tab.total
            elif payment_method == 'mobile':
                mobile_amount = tab.total
            
            # Create sale record
            sale = Sale.objects.create(
                tenant=tenant,
                outlet=outlet,
                user=request.user,
                shift=shift,
                customer=tab.customer,
                receipt_number=receipt_number,
                subtotal=tab.subtotal,
                discount=tab.discount,
                tax=tab.tax,
                total=tab.total,
                payment_method=payment_method,
                status='completed',
                cash_received=cash_received,
                change_given=change_given,
                due_date=data.get('due_date'),
                amount_paid=amount_paid,
                payment_status=payment_status,
                cash_amount=cash_amount,
                card_amount=card_amount,
                mobile_amount=mobile_amount,
                notes=f"From Tab #{tab.tab_number}. {data.get('notes', '')}",
            )
            
            # Create sale items from tab items
            for tab_item in tab.items.filter(is_voided=False):
                SaleItem.objects.create(
                    sale=sale,
                    product=tab_item.product,
                    unit=tab_item.unit,
                    quantity=tab_item.quantity,
                    price=tab_item.price,
                    discount=tab_item.discount,
                    total=tab_item.total,
                    notes=tab_item.notes,
                )

            try:
                from apps.sales.services import ReceiptService
                ReceiptService.generate_receipt(sale, format='pdf', user=request.user)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to auto-generate receipt for tab sale {sale.id}: {str(e)}")
            
            # Close the tab
            tab.status = 'closed'
            tab.closed_by = request.user
            tab.closed_at = timezone.now()
            tab.sale = sale
            tab.save()
            
            # Release the table
            if tab.table:
                tab.table.close_tab()
        
        return Response({
            'tab': TabSerializer(tab).data,
            'sale': {
                'id': str(sale.id),
                'receipt_number': sale.receipt_number,
                'total': float(sale.total),
                'payment_method': sale.payment_method,
                'change_given': float(change_given),
            }
        })
    
    def _generate_receipt_number(self, tenant):
        """Generate unique receipt number"""
        # Numeric-only receipt numbers (no date/prefix). Use global max to keep uniqueness.
        recent_numbers = Sale.objects.order_by('-created_at').values_list('receipt_number', flat=True)[:1000]
        max_numeric = 0
        for number in recent_numbers:
            if number and str(number).isdigit():
                max_numeric = max(max_numeric, int(number))

        if max_numeric == 0:
            max_id = Sale.objects.aggregate(max_id=Max('id')).get('max_id') or 0
            max_numeric = max_id

        next_number = max_numeric + 1
        while Sale.objects.filter(receipt_number=str(next_number)).exists():
            next_number += 1

        return str(next_number)
    
    # ==================== TRANSFER TAB ====================
    @action(detail=True, methods=['post'])
    def transfer(self, request, pk=None):
        """
        Transfer tab to a different table (or make it walk-up)
        Workflow 3: Tab Transfer
        """
        tab = self.get_object()
        
        if tab.status != 'open':
            return Response(
                {'error': 'Cannot transfer a closed tab'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = TransferTabSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        with transaction.atomic():
            from_table = tab.table
            to_table = None
            
            if data.get('to_table_id'):
                to_table = BarTable.objects.get(id=data['to_table_id'])
            
            # Record the transfer
            TabTransfer.objects.create(
                tab=tab,
                from_table=from_table,
                to_table=to_table,
                transferred_by=request.user,
                reason=data.get('reason', ''),
            )
            
            # Release old table
            if from_table:
                from_table.close_tab()
            
            # Assign to new table
            tab.table = to_table
            tab.save(update_fields=['table', 'updated_at'])
            
            if to_table:
                to_table.open_tab(tab)
        
        return Response(TabSerializer(tab).data)
    
    # ==================== MERGE TABS ====================
    @action(detail=False, methods=['post'])
    def merge(self, request):
        """
        Merge multiple tabs into one
        Workflow 4: Merge Tabs
        """
        serializer = MergeTabsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        with transaction.atomic():
            target_tab = Tab.objects.get(id=data['target_tab_id'])
            source_tabs = Tab.objects.filter(id__in=data['source_tab_ids'])
            
            for source_tab in source_tabs:
                # Record the merge
                TabMerge.objects.create(
                    target_tab=target_tab,
                    source_tab=source_tab,
                    source_total=source_tab.total,
                    merged_by=request.user,
                    reason=data.get('reason', ''),
                )
                
                # Move items to target tab
                for item in source_tab.items.filter(is_voided=False):
                    # Create copy in target tab
                    TabItem.objects.create(
                        tab=target_tab,
                        product=item.product,
                        unit=item.unit,
                        quantity=item.quantity,
                        price=item.price,
                        discount=item.discount,
                        added_by=item.added_by,  # Keep original bartender
                        notes=f"[From Tab #{source_tab.tab_number}] {item.notes}",
                    )
                
                # Release table if assigned
                if source_tab.table:
                    source_tab.table.close_tab()
                
                # Mark source tab as merged
                source_tab.status = 'merged'
                source_tab.merged_into = target_tab
                source_tab.closed_at = timezone.now()
                source_tab.closed_by = request.user
                source_tab.save()
            
            # Recalculate target tab totals
            target_tab.recalculate_totals()
        
        return Response({
            'target_tab': TabSerializer(target_tab).data,
            'merged_count': source_tabs.count(),
        })
    
    # ==================== SPLIT TAB ====================
    @action(detail=True, methods=['post'])
    def split(self, request, pk=None):
        """
        Split tab into multiple tabs
        Workflow 5: Split Tab
        """
        tab = self.get_object()
        
        if tab.status != 'open':
            return Response(
                {'error': 'Cannot split a closed tab'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = SplitTabSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        with transaction.atomic():
            if data['split_type'] == 'equal':
                # Equal split - create payment tabs
                num_splits = data['number_of_splits']
                amount_per_split = tab.total / num_splits
                
                # The original tab keeps all items but we return split amounts for payment
                splits = []
                for i in range(num_splits):
                    splits.append({
                        'split_number': i + 1,
                        'amount': float(amount_per_split),
                    })
                
                return Response({
                    'split_type': 'equal',
                    'original_total': float(tab.total),
                    'splits': splits,
                    'message': 'Process each split payment separately'
                })
            
            else:  # split_by_items
                item_groups = data['item_groups']
                new_tabs = []
                
                for group_idx, item_ids in enumerate(item_groups):
                    # Skip first group - keep on original tab
                    if group_idx == 0:
                        continue
                    
                    # Create new tab
                    new_tab = Tab.objects.create(
                        tenant=tab.tenant,
                        outlet=tab.outlet,
                        customer_name=f"{tab.display_name} (Split {group_idx + 1})",
                        opened_by=request.user,
                        notes=f"Split from Tab #{tab.tab_number}",
                    )
                    
                    # Move items to new tab
                    for item_id in item_ids:
                        try:
                            item = tab.items.get(id=item_id, is_voided=False)
                            # Create copy in new tab
                            TabItem.objects.create(
                                tab=new_tab,
                                product=item.product,
                                unit=item.unit,
                                quantity=item.quantity,
                                price=item.price,
                                discount=item.discount,
                                added_by=item.added_by,
                                notes=item.notes,
                            )
                            # Void from original tab
                            item.void(request.user, f"Split to Tab #{new_tab.tab_number}")
                        except TabItem.DoesNotExist:
                            continue
                    
                    new_tabs.append(new_tab)
                
                # Recalculate original tab
                tab.recalculate_totals()
                
                return Response({
                    'split_type': 'by_items',
                    'original_tab': TabSerializer(tab).data,
                    'new_tabs': TabListSerializer(new_tabs, many=True).data,
                })
    
    # ==================== SUMMARY/STATS ====================
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary of all open tabs"""
        queryset = self.get_queryset().filter(status='open')
        
        # Filter by outlet if provided
        outlet_id = request.query_params.get('outlet')
        if outlet_id:
            queryset = queryset.filter(outlet_id=outlet_id)
        
        stats = queryset.aggregate(
            total_tabs=Count('id'),
            total_amount=Sum('total'),
        )
        
        return Response({
            'open_tabs': stats['total_tabs'] or 0,
            'total_outstanding': float(stats['total_amount'] or 0),
            'tabs': TabListSerializer(queryset[:20], many=True).data,
        })
    
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Get tab history (items, transfers, etc.)"""
        tab = self.get_object()
        
        transfers = TabTransfer.objects.filter(tab=tab).order_by('-transferred_at')
        
        return Response({
            'tab': TabSerializer(tab).data,
            'items_history': TabItemSerializer(tab.items.all(), many=True).data,
            'transfers': TabTransferSerializer(transfers, many=True).data,
        })
