from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction
from django.utils import timezone
from django.template import engines
import logging
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from .models import Sale, SaleItem, Receipt, ReceiptTemplate
from .serializers import SaleSerializer, SaleItemSerializer, ReceiptSerializer, ReceiptTemplateSerializer
from .services import ReceiptService
from apps.products.models import Product, ProductUnit
from apps.inventory.models import StockMovement, LocationStock, Batch
from apps.inventory.stock_helpers import get_available_stock, deduct_stock, add_stock
from apps.tenants.permissions import TenantFilterMixin


class SaleViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Sale ViewSet with atomic transactions"""
    queryset = Sale.objects.select_related('tenant', 'outlet', 'user', 'shift', 'customer').prefetch_related(
        'items',
        'items__product'  # Prefetch product data for sale items to avoid N+1 queries
    )
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'outlet', 'user', 'status', 'payment_method']
    search_fields = ['receipt_number', 'notes']
    ordering_fields = ['created_at', 'total']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Ensure tenant and outlet filtering is applied correctly with strict isolation"""
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
        
        # Get base queryset with optimized prefetching to avoid N+1 queries
        # Using select_related for ForeignKey relationships and prefetch_related for reverse relationships
        queryset = Sale.objects.select_related(
            'tenant', 'outlet', 'user', 'shift', 'customer'
        ).prefetch_related(
            'items',
            'items__product'  # Prefetch product data for sale items to avoid N+1 queries
        ).all()
        
        # Apply tenant filter - CRITICAL for security
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(tenant=tenant)
            else:
                return queryset.none()
        
        # Apply outlet filter for outlet isolation - CRITICAL for data security
        # SaaS admins can see all sales, regular users need outlet filter
        if not is_saas_admin:
            # Always filter by outlet to ensure transactions are isolated per outlet
            outlet = self.get_outlet_for_request(self.request)
            if not outlet:
                # Also check explicit outlet filter in query params (for backward compatibility)
                outlet_id = self.request.query_params.get('outlet')
                if outlet_id:
                    try:
                        # Validate outlet belongs to tenant before filtering
                        from apps.outlets.models import Outlet
                        outlet = Outlet.objects.filter(id=outlet_id, tenant=tenant).first()
                    except (ValueError, TypeError):
                        outlet = None
            
            # STRICT OUTLET ISOLATION: Always filter by outlet if tenant is set
            # This ensures users only see transactions from their current outlet
            if outlet and tenant:
                queryset = queryset.filter(outlet=outlet)
            elif tenant:
                # If tenant exists but no outlet specified, return empty queryset for security
                return queryset.none()
        else:
            # SaaS admin can optionally filter by outlet if provided
            outlet = self.get_outlet_for_request(self.request)
            if outlet:
                queryset = queryset.filter(outlet=outlet)
        
        # Filter by date range if provided
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        # Order by most recent first (default ordering)
        return queryset.order_by('-created_at')
    
    def update(self, request, *args, **kwargs):
        """Override update to ensure tenant matches"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to update this sale."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure tenant matches"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to delete this sale."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create sale with atomic stock deduction"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"Creating sale - User: {request.user.email}, Data: {request.data}")
        
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"Sale validation failed: {serializer.errors}")
            # Return detailed validation errors
            return Response(
                {"detail": "Validation failed", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Set tenant and user
        # SaaS admins can provide tenant_id in request data
        tenant = self.get_tenant_for_request(request)
        if not tenant and not request.user.is_saas_admin:
            logger.error("No tenant found for user")
            return Response({"detail": "User must have a tenant"}, status=status.HTTP_400_BAD_REQUEST)
        if not tenant:
            logger.error("No tenant found - SaaS admin must provide tenant_id in request data")
            return Response({"detail": "Tenant is required. Please provide tenant_id in request data."}, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"Sale validated - Tenant: {tenant.id}, Outlet: {serializer.validated_data.get('outlet')}")
        
        items_data = serializer.validated_data.pop('items_data')
        
        # Extract restaurant-specific fields if present
        table_id = serializer.validated_data.pop('table_id', None)
        guests = serializer.validated_data.pop('guests', None)
        priority = serializer.validated_data.pop('priority', 'normal')
        till_id = serializer.validated_data.pop('till', None)
        
        # Get outlet object (already validated in serializer)
        outlet_id = serializer.validated_data.pop('outlet')
        from apps.outlets.models import Outlet
        outlet = Outlet.objects.get(id=outlet_id, tenant=tenant)
        
        # Validate and get till if provided
        till = None
        if till_id:
            from apps.outlets.models import Till
            try:
                till = Till.objects.get(id=till_id, outlet=outlet)
            except Till.DoesNotExist:
                logger.warning(f"Till {till_id} not found in outlet {outlet.id}")
                return Response(
                    {"detail": f"Till {till_id} does not belong to selected outlet"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Get shift object if provided (already validated in serializer)
        shift = None
        shift_id = serializer.validated_data.pop('shift', None)
        if shift_id:
            from apps.shifts.models import Shift
            shift = Shift.objects.get(id=shift_id, outlet__tenant=tenant)
        
        # Get customer object if provided (already validated in serializer)
        customer = None
        customer_id = serializer.validated_data.pop('customer', None)
        if customer_id:
            from apps.customers.models import Customer
            customer = Customer.objects.get(id=customer_id, tenant=tenant)
        
        # Generate receipt number
        receipt_number = self._generate_receipt_number(tenant)
        
        # Get table if provided
        table = None
        if table_id:
            from apps.restaurant.models import Table
            try:
                table = Table.objects.get(id=table_id, tenant=tenant)
            except Table.DoesNotExist:
                logger.warning(f"Table {table_id} not found, continuing without table")
        
        # Create sale
        sale = Sale.objects.create(
            receipt_number=receipt_number,
            user=request.user,
            tenant=tenant,
            outlet=outlet,
            shift=shift,
            customer=customer,
            table=table,
            guests=guests,
            priority=priority,
            till=till,
            **serializer.validated_data
        )
        
        logger.info(f"Sale created: {sale.id}, Receipt: {receipt_number}")
        
        # Process items and deduct stock
        total_subtotal = Decimal('0')
        sale_type = request.data.get('sale_type', 'retail')  # 'retail' or 'wholesale'
        
        for idx, item_data in enumerate(items_data):
            product_id = item_data.get('product_id')
            variation_id = item_data.get('variation_id')
            unit_id = item_data.get('unit_id')  # Optional: unit for multi-unit selling
            quantity = int(item_data.get('quantity', 1))
            price_str = str(item_data.get('price', '0'))
            
            if not product_id:
                raise serializers.ValidationError(f"Item {idx + 1}: product_id is required")
            
            try:
                price = Decimal(price_str).quantize(Decimal('0.01'))
            except (InvalidOperation, ValueError):
                raise serializers.ValidationError(f"Item {idx + 1}: Invalid price format")
            
            if price <= 0:
                raise serializers.ValidationError(f"Item {idx + 1}: Price must be greater than 0")
            
            if quantity <= 0:
                raise serializers.ValidationError(f"Item {idx + 1}: Quantity must be greater than 0")
            
            try:
                product = Product.objects.select_for_update().get(id=product_id, tenant=tenant, outlet=outlet)
            except Product.DoesNotExist:
                raise serializers.ValidationError(f"Item {idx + 1}: Product {product_id} not found or does not belong to your tenant/outlet")
            
            # UNITS ONLY ARCHITECTURE: No variations, use units instead
            variation = None
            
            # Get unit if provided
            unit = None
            quantity_in_base_units = quantity
            unit_name = product.unit  # Default to product's base unit
            
            if unit_id:
                try:
                    unit = ProductUnit.objects.get(id=unit_id, product=product, is_active=True)
                    # Convert quantity to base units using conversion_factor
                    quantity_in_base_units = unit.convert_to_base_units(quantity)
                    unit_name = unit.unit_name
                    # Use unit price if not explicitly provided
                    if not price_str or price_str == '0':
                        price = unit.get_price(sale_type)
                except ProductUnit.DoesNotExist:
                    raise serializers.ValidationError(f"Item {idx + 1}: Unit {unit_id} not found or inactive")
            
            # Check stock availability and deduct from product stock (UNITS ONLY ARCHITECTURE)
            if product.stock < quantity_in_base_units:
                raise serializers.ValidationError(
                    f"Item {idx + 1}: Insufficient stock for {product.name}. "
                    f"Available: {product.stock} {product.unit}, Requested: {quantity_in_base_units} {product.unit}"
                )
            
            # Deduct from product stock
            product.stock -= quantity_in_base_units
            product.save(update_fields=['stock'])
            
            # Calculate item total - round to 2 decimal places
            item_total = (price * Decimal(quantity)).quantize(Decimal('0.01'))
            total_subtotal += item_total
            
            # Extract item notes and kitchen_status if provided
            item_notes = item_data.get('notes', '')
            kitchen_status = item_data.get('kitchen_status', 'pending')
            
            # Create sale item (UNITS ONLY ARCHITECTURE - no variations)
            sale_item = SaleItem.objects.create(
                sale=sale,
                product=product,
                unit=unit,
                product_name=product.name,
                unit_name=unit_name,
                quantity=quantity,
                quantity_in_base_units=quantity_in_base_units,
                price=price,
                total=item_total,
                notes=item_notes,
                kitchen_status=kitchen_status
            )
            
            # Record stock movement (UNITS ONLY ARCHITECTURE - all inventory is tracked via units)
            StockMovement.objects.create(
                tenant=tenant,
                product=product,
                outlet=sale.outlet,
                user=request.user,
                movement_type='sale',
                quantity=quantity_in_base_units,
                reference_id=str(sale.id),
                reason=f"Sale {sale.receipt_number}"
            )
        
        # Calculate totals - round to 2 decimal places to match DecimalField precision
        tax = sale.tax or Decimal('0')
        discount = sale.discount or Decimal('0')
        # Round subtotal to 2 decimal places
        sale.subtotal = total_subtotal.quantize(Decimal('0.01'))
        # Round total to 2 decimal places
        sale.total = (total_subtotal + tax - discount).quantize(Decimal('0.01'))
        
        # Set status based on payment method and sale type
        # For cash/card/mobile payments, mark as completed immediately
        if sale.payment_method in ['cash', 'card', 'mobile']:
            sale.status = 'completed'
            sale.payment_status = 'paid'
        # For tab/restaurant orders, keep as pending until payment
        elif sale.payment_method == 'tab' and not sale.status:
            sale.status = 'pending'
            sale.payment_status = 'unpaid'
        # For credit sales, handle separately
        elif sale.payment_method == 'credit':
            if not sale.customer:
                return Response(
                    {"detail": "Customer is required for credit sales"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate credit
            can_sell, error_message = sale.customer.can_make_credit_sale(sale.total)
            if not can_sell:
                return Response(
                    {"detail": error_message},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Set due date and payment status
            sale.due_date = timezone.now() + timedelta(days=sale.customer.payment_terms_days)
            sale.amount_paid = Decimal('0')
            sale.payment_status = 'unpaid'
            sale.status = 'completed'  # Credit sales are completed but unpaid
        # If status was explicitly set in request data (e.g., restaurant orders), keep it
        elif not sale.status:
            # Default to completed for any other payment method
            sale.status = 'completed'
            sale.payment_status = 'paid'
        
        sale.save()
        logger.info(f"Sale saved: ID={sale.id}, Receipt={sale.receipt_number}, Status={sale.status}, Total={sale.total}, Payment={sale.payment_method}")
        
        # Create Kitchen Order Ticket (KOT) if this is a restaurant order with a table
        if table and sale.status == 'pending':
            from apps.restaurant.models import KitchenOrderTicket
            
            # Generate unique KOT number (deterministic based on timestamp and count)
            # After a sale is created and saved, don't block on generating receipts here; we use a post-commit
            # signal to generate receipts. We also provide an on-demand endpoint for cases where the client
            # needs to trigger generation synchronously (e.g., print attempts from POS).
            date_str = timezone.now().strftime('%Y%m%d')
            # Get count of KOTs for today to ensure uniqueness
            today_kot_count = KitchenOrderTicket.objects.filter(
                kot_number__startswith=f"KOT-{date_str}"
            ).count()
            kot_number = f"KOT-{date_str}-{today_kot_count + 1:04d}"
            
            # Ensure KOT number is unique (in case of race condition)
            counter = 1
            while KitchenOrderTicket.objects.filter(kot_number=kot_number).exists():
                kot_number = f"KOT-{date_str}-{today_kot_count + 1 + counter:04d}"
                counter += 1
            
            KitchenOrderTicket.objects.create(
                tenant=tenant,
                outlet=sale.outlet,
                sale=sale,
                table=table,
                kot_number=kot_number,
                status='pending',
                priority=priority,
                notes=sale.notes
            )
        
        # Update customer if provided
        if sale.customer:
            sale.customer.total_spent += sale.total
            sale.customer.last_visit = timezone.now()
            sale.customer.save()
        
        # Create notification for completed sale (Square POS-like)
        try:
            from apps.notifications.services import NotificationService
            NotificationService.notify_sale_completed(sale)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create sale notification: {str(e)}")
        
        response_serializer = SaleSerializer(sale)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    @action(detail=False, methods=['post'], url_path='checkout-cash')
    def checkout_cash(self, request):
        """
        Cash-only checkout endpoint
        
        Input:
        {
            "outlet": <outlet_id>,
            "shift": <shift_id>,  # REQUIRED - must be open
            "items": [
                {"product_id": 1, "quantity": 2, "price": "10.00"},
                ...
            ],
            "cash_received": "25.00",
            "subtotal": "20.00",
            "tax": "0.00",
            "discount": "0.00",
            "customer": <customer_id> (optional)
        }
        
        Output:
        {
            "sale_id": <id>,
            "receipt_number": "...",
            "total": "20.00",
            "change": "5.00",
            "items": [...],
            "shift": {...}
        }
        """
        import logging
        logger = logging.getLogger(__name__)
        
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        if not tenant:
            return Response(
                {"detail": "User must have a tenant"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate required fields
        outlet_id = request.data.get('outlet')
        shift_id = request.data.get('shift')
        items = request.data.get('items', [])
        cash_received_str = request.data.get('cash_received')
        
        if not outlet_id:
            return Response(
                {"detail": "outlet is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not shift_id:
            return Response(
                {"detail": "shift is required for cash sales"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not items or len(items) == 0:
            return Response(
                {"detail": "items array cannot be empty"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not cash_received_str:
            return Response(
                {"detail": "cash_received is required for cash checkout"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            cash_received = Decimal(str(cash_received_str))
        except (InvalidOperation, ValueError):
            return Response(
                {"detail": "cash_received must be a valid number"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate outlet belongs to tenant
        from apps.outlets.models import Outlet
        try:
            outlet = Outlet.objects.get(id=outlet_id, tenant=tenant)
        except Outlet.DoesNotExist:
            return Response(
                {"detail": "Outlet not found or does not belong to your tenant"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validate shift exists, belongs to tenant, and is OPEN
        from apps.shifts.models import Shift
        try:
            shift = Shift.objects.select_related('outlet', 'outlet__tenant').get(
                id=shift_id,
                outlet__tenant=tenant
            )
        except Shift.DoesNotExist:
            return Response(
                {"detail": "Shift not found or does not belong to your tenant"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if shift.status != 'OPEN':
            return Response(
                {"detail": f"Cannot process sale. Shift is {shift.status}. Please open a shift first."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Process items and validate stock
        total_subtotal = Decimal('0')
        sale_items_data = []
        
        for idx, item in enumerate(items):
            product_id = item.get('product_id')
            variation_id = item.get('variation_id')  # Support variations in cash checkout
            quantity = int(item.get('quantity', 1))
            price_str = str(item.get('price', '0'))
            
            if not product_id:
                return Response(
                    {"detail": f"Item {idx + 1}: product_id is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                price = Decimal(price_str)
            except (InvalidOperation, ValueError):
                return Response(
                    {"detail": f"Item {idx + 1}: Invalid price format"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if price <= 0:
                return Response(
                    {"detail": f"Item {idx + 1}: Price must be greater than 0"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if quantity <= 0:
                return Response(
                    {"detail": f"Item {idx + 1}: Quantity must be greater than 0"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get product with lock for stock check
            try:
                product = Product.objects.select_for_update().get(id=product_id, tenant=tenant, outlet=outlet)
            except Product.DoesNotExist:
                return Response(
                    {"detail": f"Item {idx + 1}: Product {product_id} not found or does not belong to your tenant/outlet"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # UNITS ONLY ARCHITECTURE: use product/batch-aware stock checks
            variation = None
            try:
                available_stock = get_available_stock(product, outlet)
            except Exception:
                available_stock = 0

            # Fallback to legacy product.stock if no batch stock present
            if available_stock <= 0:
                available_stock = product.stock

            if available_stock < quantity:
                return Response(
                    {"detail": f"Item {idx + 1}: Insufficient stock for {product.name}. Available: {available_stock}, Requested: {quantity}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            item_total = price * Decimal(quantity)
            total_subtotal += item_total
            
            sale_items_data.append({
                'product': product,
                'product_id': product_id,
                'product_name': product.name,
                'quantity': quantity,
                'price': price,
                'total': item_total,
            })
        
        # Calculate totals
        subtotal = Decimal(str(request.data.get('subtotal', total_subtotal)))
        tax = Decimal(str(request.data.get('tax', '0')))
        discount = Decimal(str(request.data.get('discount', '0')))
        total = subtotal + tax - discount
        
        # Validate cash_received >= total
        if cash_received < total:
            return Response(
                {"detail": f"Insufficient cash received. Total: {total}, Received: {cash_received}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        change_given = cash_received - total
        
        # Generate receipt number
        receipt_number = self._generate_receipt_number(tenant)
        
        # Get customer if provided
        customer = None
        customer_id = request.data.get('customer')
        if customer_id:
            from apps.customers.models import Customer
            try:
                customer = Customer.objects.get(id=customer_id, tenant=tenant)
            except Customer.DoesNotExist:
                logger.warning(f"Customer {customer_id} not found, continuing without customer")
        
        # Create sale with atomic transaction
        sale = Sale.objects.create(
            receipt_number=receipt_number,
            user=request.user,
            tenant=tenant,
            outlet=outlet,
            shift=shift,
            customer=customer,
            subtotal=subtotal,
            tax=tax,
            discount=discount,
            total=total,
            payment_method='cash',
            status='completed',
            cash_received=cash_received,
            change_given=change_given,
            notes=request.data.get('notes', '')
        )
        
        # Create sale items and deduct stock
        for item_data in sale_items_data:
            product = item_data['product']
            
            SaleItem.objects.create(
                sale=sale,
                product=product,
                product_name=item_data['product_name'],
                quantity=item_data['quantity'],
                quantity_in_base_units=item_data['quantity'],
                price=item_data['price'],
                total=item_data['total'],
            )
            
            # Deduct stock using batch-aware logic
            if product:
                try:
                    deduct_stock(
                        product=product,
                        outlet=outlet,
                        quantity=item_data['quantity'],
                        user=request.user,
                        reference_id=str(sale.id),
                        reason=f"Cash sale {sale.receipt_number}"
                    )
                except ValueError as e:
                    # This shouldn't happen since we checked earlier, but handle gracefully
                    logger.error(f"Stock deduction failed: {str(e)}")
                    return Response(
                        {"detail": f"Stock deduction failed: {str(e)}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                # Legacy: deduct from product.stock
                product.stock -= item_data['quantity']
                product.save(update_fields=['stock'])
                
                # Record stock movement for legacy products
                StockMovement.objects.create(
                    tenant=tenant,
                    product=product,
                    outlet=outlet,
                    user=request.user,
                    movement_type='sale',
                    quantity=item_data['quantity'],
                    reference_id=str(sale.id),
                    reason=f"Cash sale {sale.receipt_number}"
                )
        
        # Update customer if provided
        if customer:
            customer.total_spent += total
            customer.last_visit = timezone.now()
            customer.save()
        
        # Cash movement creation removed - new payment system will handle this
        
        # Return response
        response_serializer = SaleSerializer(sale)
        shift_serializer = None
        try:
            from apps.shifts.serializers import ShiftSerializer
            shift_serializer = ShiftSerializer(shift)
        except Exception:
            pass
        
        return Response({
            "sale_id": sale.id,
            "receipt_number": sale.receipt_number,
            "total": str(total),
            "change": str(change_given),
            "cash_received": str(cash_received),
            "items": response_serializer.data.get('items', []),
            "shift": shift_serializer.data if shift_serializer else {"id": shift.id, "status": shift.status}
        }, status=status.HTTP_201_CREATED)
    
    def _generate_receipt_number(self, tenant):
        """Generate unique receipt number"""
        prefix = tenant.name[:3].upper().replace(' ', '')
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        return f"{prefix}-{timestamp}"
    
    @action(detail=True, methods=['post'])
    def refund(self, request, pk=None):
        """Process refund for a sale"""
        sale = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and sale.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to refund this sale."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if sale.status == 'refunded':
            return Response(
                {"detail": "Sale is already refunded"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        refund_reason = request.data.get('reason', '')
        
        with transaction.atomic():
            # Restore stock for all items - ensure product belongs to tenant
            for item in sale.items.all():
                if item.product:
                    # CRITICAL: Verify product belongs to tenant
                    product = Product.objects.select_for_update().get(id=item.product.id, tenant=sale.tenant)
                    product.stock += item.quantity
                    product.save()
                    
                    # Record stock movement
                    StockMovement.objects.create(
                        tenant=sale.tenant,
                        product=product,
                        outlet=sale.outlet,
                        user=request.user,
                        movement_type='return',
                        quantity=item.quantity,
                        reason=f"Refund for sale {sale.receipt_number}: {refund_reason}",
                        reference_id=str(sale.id)
                    )
            
            # Update sale status
            sale.status = 'refunded'
            sale.save()
            
            # Update customer if exists
            if sale.customer:
                sale.customer.total_spent = max(0, sale.customer.total_spent - sale.total)
                sale.customer.save()
        
        serializer = self.get_serializer(sale)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def generate_receipt(self, request, pk=None):
        """Generate a receipt for this sale on-demand.

        Useful for POS clients that need an ESC/POS payload immediately when printing.
        This action is idempotent — if a receipt already exists we'll return it.
        """
        sale = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant

        # Permission check: tenant must match unless SaaS admin
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and sale.tenant != tenant:
            return Response({"detail": "You do not have permission to generate a receipt for this sale."}, status=status.HTTP_403_FORBIDDEN)

        fmt = request.query_params.get('format', request.data.get('format', 'escpos')) or 'escpos'
        try:
            receipt = ReceiptService.generate_receipt(sale, format=fmt, user=request.user)
            serializer = ReceiptSerializer(receipt)
            return Response(serializer.data)  
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to generate receipt for sale {sale.id}: {str(e)}", exc_info=True)
            return Response({"detail": "Failed to generate receipt"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='escpos-receipt')
    def escpos_receipt(self, request, pk=None):
        """Convenience endpoint that returns an ESC/POS base64 payload for a sale.

        If an ESC/POS receipt does not exist, this will generate it on-demand and return it.
        """
        sale = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant

        # Permission check: tenant must match unless SaaS admin
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and sale.tenant != tenant:
            return Response({"detail": "You do not have permission to view this sale's receipt."}, status=status.HTTP_403_FORBIDDEN)

        try:
            receipt = ReceiptService.generate_receipt(sale, format='escpos', user=request.user)
            return Response({
                'receipt_number': receipt.receipt_number,
                'format': receipt.format,
                'content': receipt.content,
            })
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to generate escpos receipt for sale {sale.id}: {str(e)}", exc_info=True)
            return Response({"detail": "Failed to generate escpos receipt"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get sales statistics - optimized with database aggregation"""
        from django.db.models import Sum, Count
        
        queryset = self.filter_queryset(self.get_queryset())
        
        # Date range filters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        # Use database aggregation instead of Python iteration (much faster)
        stats = queryset.aggregate(
            total_sales=Count('id'),
            total_revenue=Sum('total'),
        )
        
        today = timezone.now().date()
        today_stats = queryset.filter(created_at__date=today).aggregate(
            today_sales=Count('id'),
            today_revenue=Sum('total'),
        )
        
        return Response({
            'total_sales': stats['total_sales'] or 0,
            'total_revenue': float(stats['total_revenue'] or 0),
            'today_sales': today_stats['today_sales'] or 0,
            'today_revenue': float(today_stats['today_revenue'] or 0),
        })
    
    @action(detail=False, methods=['get'])
    def chart_data(self, request):
        """Get chart data for last 7 days - optimized single query"""
        from django.db.models import Sum, Count
        from django.db.models.functions import TruncDate
        from datetime import timedelta
        
        queryset = self.filter_queryset(self.get_queryset())
        
        # Get outlet filter if provided
        outlet = self.get_outlet_for_request(request)
        if outlet:
            queryset = queryset.filter(outlet=outlet)
        
        # Get date range (last 7 days)
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=6)
        
        # Filter by date range
        queryset = queryset.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
        
        # Aggregate by date using database
        daily_stats = queryset.annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            sales=Sum('total'),
            count=Count('id')
        ).order_by('date')
        
        # Create a map of date -> stats
        stats_map = {str(item['date']): item for item in daily_stats}
        
        # Build response for all 7 days
        chart_data = []
        for i in range(6, -1, -1):
            date = end_date - timedelta(days=i)
            date_str = str(date)
            day_stats = stats_map.get(date_str, {'sales': 0, 'count': 0})
            
            chart_data.append({
                'date': date.strftime('%a'),  # Weekday abbreviation
                'sales': float(day_stats['sales'] or 0),
                'profit': float(day_stats['sales'] or 0) * 0.7,  # TODO: Calculate properly with expenses
            })
        
        return Response(chart_data)
    
    @action(detail=False, methods=['get'])
    def top_selling_items(self, request):
        """Get top selling items - optimized database query"""
        from django.db.models import Sum, F
        
        queryset = self.filter_queryset(self.get_queryset())
        
        # Get outlet filter if provided
        outlet = self.get_outlet_for_request(request)
        if outlet:
            queryset = queryset.filter(outlet=outlet)
        
        # Filter completed sales only
        queryset = queryset.filter(status='completed')
        
        # Get date range (optional)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        # Aggregate sale items by product
        top_items = SaleItem.objects.filter(
            sale__in=queryset
        ).values(
            'product_id'
        ).annotate(
            quantity=Sum('quantity'),
            revenue=Sum(F('price') * F('quantity')),
            product_name=F('product_name')
        ).order_by('-revenue')[:5]
        
        # Get product details
        product_ids = [item['product_id'] for item in top_items if item['product_id']]
        products = {p.id: p for p in Product.objects.filter(id__in=product_ids).only('id', 'name', 'sku')}
        
        # Format response
        result = []
        for item in top_items:
            product = products.get(item['product_id'])
            result.append({
                'id': str(item['product_id']),
                'name': item['product_name'] or (product.name if product else 'Unknown Product'),
                'sku': product.sku if product else 'N/A',
                'quantity': item['quantity'] or 0,
                'revenue': float(item['revenue'] or 0),
                'change': 0,  # TODO: Calculate change from previous period
            })
        
        return Response(result)


class ReceiptViewSet(viewsets.ReadOnlyModelViewSet, TenantFilterMixin):
    """Receipt ViewSet - Read-only for retrieving receipts"""
    queryset = Receipt.objects.select_related('sale', 'tenant', 'generated_by', 'sale__outlet', 'sale__customer')
    serializer_class = ReceiptSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'sale', 'format', 'is_sent']
    search_fields = ['receipt_number']
    ordering_fields = ['generated_at', 'access_count']
    ordering = ['-generated_at']
    
    def get_queryset(self):
        """Ensure tenant filtering is applied"""
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
        
        queryset = Receipt.objects.select_related(
            'sale', 'tenant', 'generated_by', 'sale__outlet', 'sale__customer'
        ).all()
        
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(tenant=tenant)
            else:
                queryset = queryset.none()
        
        # Filter by outlet through sale relationship if provided
        outlet_id = self.request.query_params.get('outlet')
        if outlet_id:
            try:
                from apps.outlets.models import Outlet
                # Validate outlet belongs to tenant
                outlet = Outlet.objects.filter(id=outlet_id, tenant=tenant).first()
                if outlet:
                    queryset = queryset.filter(sale__outlet=outlet)
            except (ValueError, TypeError):
                pass
        
        return queryset
    
    @action(detail=False, methods=['get'], url_path='by-number/(?P<receipt_number>[^/.]+)')
    def by_number(self, request, receipt_number=None):
        """Get receipt by receipt number (public access)"""
        try:
            receipt = ReceiptService.get_receipt_by_number(receipt_number)
            
            # Check tenant access if authenticated
            if request.user.is_authenticated:
                tenant = getattr(request, 'tenant', None) or request.user.tenant
                if tenant and receipt.tenant != tenant:
                    return Response(
                        {'error': 'Receipt not found'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            
            serializer = self.get_serializer(receipt)
            return Response(serializer.data)
        except Receipt.DoesNotExist:
            return Response(
                {'error': 'Receipt not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'], url_path='by-sale/(?P<sale_id>[^/.]+)')
    def by_sale(self, request, sale_id=None):
        """Get receipt by sale ID"""
        try:
            receipt = ReceiptService.get_receipt_by_sale(sale_id)
            
            # Verify tenant access
            tenant = getattr(request, 'tenant', None) or request.user.tenant
            if not tenant or receipt.tenant != tenant:
                return Response(
                    {'error': 'Receipt not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = self.get_serializer(receipt)
            return Response(serializer.data)
        except Receipt.DoesNotExist:
            return Response(
                {'error': 'Receipt not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'], url_path='regenerate')
    def regenerate(self, request, pk=None):
        """Regenerate receipt (admin only). This creates a new immutable receipt
        record and voids the previous one to preserve audit history."""
        receipt = self.get_object()
        format_type = request.data.get('format', 'pdf')
        
        try:
            new_receipt = ReceiptService.regenerate_receipt(receipt.id, format=format_type, user=request.user)
            serializer = self.get_serializer(new_receipt)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Failed to regenerate receipt: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # NOTE: Receipts are immutable legal records. The `update-content` endpoint
    # used to allow editing stored receipt content; that is removed to enforce
    # immutability. Use the `regenerate` action which creates a new receipt record
    # (voiding the old one) if you need a new version (admin only).    
    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, pk=None):
        """Download receipt - PDF file if available, ESC/POS content otherwise"""
        receipt = self.get_object()
        
        from django.http import HttpResponse, FileResponse
        
        # If PDF file exists, serve it
        if receipt.pdf_file:
            receipt.increment_access()
            return FileResponse(
                receipt.pdf_file.open('rb'),
                as_attachment=True,
                filename=f"receipt_{receipt.receipt_number}.pdf",
                content_type='application/pdf'
            )
        
        # Otherwise, if ESC/POS content, return as text file
        if receipt.format == 'escpos' and receipt.content:
            receipt.increment_access()
            response = HttpResponse(receipt.content, content_type='text/plain')
            response['Content-Disposition'] = f'attachment; filename="receipt_{receipt.receipt_number}.txt"'
            return response
        
        # Fallback
        return Response(
            {'error': 'No downloadable content available for this receipt'},
            status=status.HTTP_404_NOT_FOUND
        )


class ReceiptTemplateViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Manage per-tenant receipt templates"""
    from .models import ReceiptTemplate as _RT  # local import for typing
    queryset = _RT.objects.all()
    serializer_class = ReceiptTemplateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'is_default']
    search_fields = ['name']
    ordering_fields = ['updated_at', 'created_at']
    ordering = ['-is_default', 'name']

    def get_queryset(self):
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

        qs = ReceiptTemplate.objects.select_related('tenant').all()
        if not is_saas_admin:
            if tenant:
                qs = qs.filter(tenant=tenant)
            else:
                return qs.none()

        return qs.order_by('-is_default', 'name')

    def perform_create(self, serializer):
        # ensure tenant is set from request (do not allow creating templates for other tenants)
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        serializer.save(tenant=tenant)

    def perform_update(self, serializer):
        # prevent changing tenant via update
        serializer.save()

    @action(detail=True, methods=['post'], url_path='preview')
    def preview(self, request, pk=None):
        """Render the template server-side with canned sample data and return the
        rendered content. This ensures preview matches what will be generated for
        actual sales and that rendering errors are caught on the backend.
        """
        template = self.get_object()
        # Small, deterministic sample sale context used for previews
        sample_sale = {
            'receipt_number': 'SAMPLE-0001',
            'created_at': timezone.now().isoformat(),
            'subtotal': '9.99',
            'tax': '0.00',
            'discount': '0.00',
            'total': '9.99',
            'user': {'id': None, 'name': 'Cashier'},
            'items': [
                {'product_name': 'Sample Item', 'quantity': 1, 'price': '9.99', 'total': '9.99'}
            ],
            'outlet_detail': { 'name': getattr(request.tenant, 'name', '') if hasattr(request, 'tenant') else '' }
        }

        try:
            engine = engines['django']
            tpl = engine.from_string(template.content or '')
            rendered = tpl.render({'sale': sample_sale, 'items': sample_sale['items'], 'tenant': {'name': template.tenant.name}})
            return Response({'preview': rendered, 'format': template.format})
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error(f"Template preview failed for template {template.id}: {str(e)}", exc_info=True)
            return Response({'error': 'Failed to render preview'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


