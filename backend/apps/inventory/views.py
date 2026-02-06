from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta
import logging
from .models import StockMovement, StockTake, StockTakeItem, LocationStock, Batch
from .serializers import StockMovementSerializer, StockTakeSerializer, StockTakeItemSerializer, LocationStockSerializer, BatchSerializer
from .stock_helpers import get_available_stock, deduct_stock, add_stock, adjust_stock, mark_expired_batches, get_expiring_soon
from apps.products.models import Product
from apps.tenants.permissions import TenantFilterMixin

logger = logging.getLogger(__name__)


class StockMovementViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Stock movement ViewSet - tracks inventory movements"""
    queryset = StockMovement.objects.select_related('product', 'outlet', 'user')
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'product', 'outlet', 'movement_type']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Ensure tenant filtering is applied correctly"""
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
        
        # Use request.tenant first (set by middleware), then fall back to user.tenant
        tenant = request_tenant or user_tenant
        
        logger.info(f"StockMovementViewSet.get_queryset - User: {user.email}, is_saas_admin: {is_saas_admin}, user_tenant_id: {user_tenant.id if user_tenant else None}, request_tenant_id: {request_tenant.id if request_tenant else None}")
        
        # Get base queryset
        queryset = StockMovement.objects.select_related('product', 'outlet', 'user').all()
        
        # Apply tenant filter - CRITICAL for security
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(tenant=tenant)
                count = queryset.count()
                logger.info(f"Applied tenant filter: {tenant.id} ({tenant.name}) - {count} movements found")
            else:
                logger.error(f"CRITICAL: No tenant found for user {user.email} (ID: {user.id}). User must have a tenant assigned to view inventory.")
                logger.error(f"User tenant: {user_tenant}, Request tenant: {request_tenant}")
                # Return empty queryset for security
                return queryset.none()
        
        # Apply outlet filter if provided (for outlet isolation)
        outlet = self.get_outlet_for_request(self.request)
        if outlet:
            queryset = queryset.filter(outlet=outlet)
            logger.info(f"Applied outlet filter: {outlet.id} ({outlet.name})")
        # Also check explicit outlet filter in query params (for backward compatibility)
        elif self.request.query_params.get('outlet'):
            outlet_id = self.request.query_params.get('outlet')
            try:
                queryset = queryset.filter(outlet_id=outlet_id)
                logger.info(f"Applied outlet filter from query params: {outlet_id}")
            except (ValueError, TypeError):
                pass
        
        return queryset
    
    def perform_create(self, serializer):
        """Create stock movement and update batches/LocationStock if product is provided"""
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required")
        
        # UNITS ONLY ARCHITECTURE: Use product instead of variation
        product = serializer.validated_data.get('product')
        outlet = serializer.validated_data.get('outlet')
        movement_type = serializer.validated_data.get('movement_type')
        quantity = serializer.validated_data.get('quantity')
        reason = serializer.validated_data.get('reason', '')
        
        # Handle stock changes using batch-aware logic
        if product and outlet:
            try:
                if movement_type in ['purchase', 'transfer_in', 'return']:
                    # Adding stock - create/update batch
                    # Generate batch number based on movement type
                    today = timezone.now().date()
                    batch_number = f"{movement_type.upper()}-{today.strftime('%Y%m%d')}-{product.id}"
                    expiry_date = today + timedelta(days=365)  # Default 1 year expiry
                    
                    # Allow custom expiry date from request data if provided
                    if 'expiry_date' in self.request.data:
                        try:
                            from datetime import datetime
                            expiry_date = datetime.strptime(self.request.data['expiry_date'], '%Y-%m-%d').date()
                        except (ValueError, TypeError):
                            pass
                    
                    batch = add_stock(
                        product=product,
                        outlet=outlet,
                        quantity=quantity,
                        batch_number=batch_number,
                        expiry_date=expiry_date,
                        user=self.request.user,
                        reason=reason or f"{movement_type} movement"
                    )
                    
                    # Save movement with batch reference
                    movement = serializer.save(tenant=tenant, user=self.request.user, batch=batch)
                    
                elif movement_type in ['sale', 'transfer_out', 'damage', 'expiry']:
                    # Removing stock - deduct from batches (FIFO)
                    deduct_stock(
                        product=product,
                        outlet=outlet,
                        quantity=quantity,
                        user=self.request.user,
                        reference_id=f"MANUAL-{timezone.now().strftime('%Y%m%d%H%M%S')}",
                        reason=reason or f"{movement_type} movement"
                    )
                    
                    # Movement already created in deduct_stock, just return it
                    movement = StockMovement.objects.filter(
                        product=product,
                        outlet=outlet,
                        movement_type=movement_type
                    ).latest('created_at')
                    
                elif movement_type == 'adjustment':
                    # Adjustment - can be positive or negative
                    # For simplicity, treat as add or deduct based on sign
                    current_stock = get_available_stock(product, outlet)
                    # The quantity in adjustment is the change amount, not absolute
                    # For now, we'll just add a new batch or deduct
                    today = timezone.now().date()
                    batch_number = f"ADJ-{today.strftime('%Y%m%d')}-{product.id}"
                    expiry_date = today + timedelta(days=365)
                    
                    batch = add_stock(
                        product=product,
                        outlet=outlet,
                        quantity=quantity,
                        batch_number=batch_number,
                        expiry_date=expiry_date,
                        user=self.request.user,
                        reason=reason or "Stock adjustment"
                    )
                    
                    movement = serializer.save(tenant=tenant, user=self.request.user, batch=batch)
                
                else:
                    # Unknown movement type - save without batch logic
                    movement = serializer.save(tenant=tenant, user=self.request.user)
                
                # Check for low stock after the movement
                available = get_available_stock(product, outlet)
                # For UNITS ONLY architecture, use a default threshold of 10 units
                if available <= 10:
                    try:
                        from apps.notifications.services import NotificationService
                        from apps.notifications.models import Notification
                        
                        # Check if notification already exists to avoid duplicates
                        recent_notification = Notification.objects.filter(
                            tenant=tenant,
                            type='stock',
                            resource_type='Product',
                            resource_id=str(product.id),
                            read=False,
                            created_at__gte=timezone.now() - timedelta(hours=1)
                        ).exists()
                        
                        if not recent_notification:
                            # Notify about low stock
                            logger.warning(f"Low stock alert for {product.name}: only {available} units available")
                    except Exception as e:
                        logger.error(f"Failed to create low stock notification: {str(e)}")
                
            except ValueError as e:
                from rest_framework.exceptions import ValidationError
                raise ValidationError(str(e))
        else:
            # Legacy: Save movement without batch logic (for products without variations or track_inventory=False)
            movement = serializer.save(tenant=tenant, user=self.request.user)
        
        return movement
    
    def list(self, request, *args, **kwargs):
        """Override list to add logging"""
        logger.info(f"Listing stock movements - User: {request.user.email}, Tenant: {getattr(request.user, 'tenant', None)}")
        logger.info(f"Query params: {request.query_params}")
        response = super().list(request, *args, **kwargs)
        logger.info(f"Stock movements response count: {len(response.data.get('results', [])) if isinstance(response.data, dict) else len(response.data)}")
        return response


class StockTakeItemViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Stock take item ViewSet"""
    queryset = StockTakeItem.objects.select_related('product', 'stock_take', 'stock_take__tenant')
    serializer_class = StockTakeItemSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter stock take items by tenant through stock_take"""
        queryset = super().get_queryset()
        # SaaS admins can see all stock take items
        if self.request.user.is_saas_admin:
            queryset = queryset
        else:
            # Regular users only see stock take items from their tenant's stock takes
            tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
            if tenant:
                queryset = queryset.filter(stock_take__tenant=tenant)
            else:
                return queryset.none()
        
        # Filter by stock_take if provided in URL
        stock_take_id = self.kwargs.get('stock_take_pk')
        if stock_take_id:
            queryset = queryset.filter(stock_take_id=stock_take_id)
        
        return queryset
    
    def get_serializer_context(self):
        """Add request to serializer context"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def update(self, request, *args, **kwargs):
        """Override update to add logging and error handling"""
        item_id = kwargs.get('pk')
        logger.info(f"Updating stock take item {item_id} with data: {request.data}")
        logger.info(f"Request method: {request.method}, User: {request.user.email}")
        
        try:
            serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
            if not serializer.is_valid():
                logger.error(f"Stock take item validation errors: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            serializer.save()
            logger.info(f"Stock take item {item_id} updated successfully: {serializer.data}")
            return Response(serializer.data)
        except Exception as e:
            # Log full exception with traceback for debugging, but avoid returning raw exception text to client
            logger.error(f"Error updating stock take item {item_id}: {e}", exc_info=True)
            error_payload = {"detail": "Failed to update stock take item due to an internal error."}
            # Provide minimal debug code for correlating logs with client errors
            try:
                error_code = getattr(e, 'code', None) or type(e).__name__
                error_payload['error_code'] = str(error_code)
            except Exception:
                pass
            return Response(error_payload, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StockTakeViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Stock take ViewSet"""
    queryset = StockTake.objects.select_related('tenant', 'outlet', 'user').prefetch_related('items')
    serializer_class = StockTakeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'outlet', 'status', 'operating_date']
    ordering_fields = ['created_at', 'operating_date']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Ensure tenant filtering is applied correctly"""
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
        queryset = StockTake.objects.select_related('tenant', 'outlet', 'user').prefetch_related('items').all()
        
        # Apply tenant filter - CRITICAL for security
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(tenant=tenant)
            else:
                return queryset.none()
        
        return queryset
    
    def get_serializer_context(self):
        """Add request to serializer context"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def create(self, request, *args, **kwargs):
        """Override create to add logging and better error handling"""
        logger.info(f"Creating stock take with data: {request.data}")
        logger.info(f"User: {request.user}, Tenant: {getattr(request.user, 'tenant', None)}")
        
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"Stock take validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            logger.error(f"Error creating stock take: {e}", exc_info=True)
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def perform_create(self, serializer):
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("User must have a tenant")
        
        # Validate outlet belongs to tenant
        outlet_id = self.request.data.get('outlet')
        if not outlet_id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"outlet": "Outlet is required"})
        
        from apps.outlets.models import Outlet
        try:
            # Convert outlet_id to int if it's a string
            outlet_id_int = int(outlet_id) if isinstance(outlet_id, str) else outlet_id
            outlet = Outlet.objects.get(id=outlet_id_int, tenant=tenant)
            logger.info(f"Found outlet: {outlet.id} ({outlet.name}) for tenant: {tenant.id}")
        except Outlet.DoesNotExist:
            logger.error(f"Outlet {outlet_id} not found for tenant {tenant.id}")
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"outlet": "Outlet not found or does not belong to your tenant"})
        except ValueError:
            logger.error(f"Invalid outlet ID format: {outlet_id}")
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"outlet": "Invalid outlet ID format"})
        
        stock_take = serializer.save(
            tenant=tenant,
            outlet=outlet,
            user=self.request.user, 
            status='running'
        )
        
        # Auto-create stock take items for all active products
        with transaction.atomic():
            products = Product.objects.filter(tenant=tenant, is_active=True)
            for product in products:
                StockTakeItem.objects.create(
                    stock_take=stock_take,
                    product=product,
                    expected_quantity=product.stock,
                    counted_quantity=0,
                    notes=''
                )
    
    def update(self, request, *args, **kwargs):
        """Override update to ensure tenant matches"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to update this stock take."},
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
                {"detail": "You do not have permission to delete this stock take."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Complete stock take and apply adjustments"""
        stock_take = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant

        # CRITICAL: Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and stock_take.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to complete this stock take."},
                status=status.HTTP_403_FORBIDDEN
            )

        if stock_take.status != 'running':
            return Response(
                {"detail": "Stock take is not running"},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Apply adjustments
            for item in stock_take.items.all():
                difference = item.difference
                if difference == 0:
                    continue

                product = item.product
                variation = getattr(item, 'variation', None)

                # If product is missing but variation exists, get product from variation
                if not product and variation:
                    product = variation.product

                if not product:
                    logger.error(f"StockTakeItem {item.id} has no product or variation. Skipping.")
                    continue

                # Tenant safety
                if product.tenant != stock_take.tenant:
                    logger.warning(f"Tenant mismatch for StockTakeItem {item.id} in stock_take {stock_take.id}")
                    continue

                # Update product stock (backward compatibility for legacy products)
                if not variation or not variation.track_inventory:
                    product.stock += difference
                    product.save(update_fields=['stock'])

                # Update batches if variation tracks inventory
                if variation and variation.track_inventory:
                    try:
                        # Use adjust_stock helper to create/update batch
                        current_stock = get_available_stock(variation, stock_take.outlet)
                        new_quantity = item.counted_quantity
                        
                        # Adjust to the counted quantity
                        adjust_stock(
                            variation=variation,
                            outlet=stock_take.outlet,
                            new_quantity=new_quantity,
                            user=request.user,
                            reason=f"Stock take {stock_take.id}: Expected {item.expected_quantity}, Counted {item.counted_quantity}"
                        )
                        
                        logger.info(
                            f"Stock adjusted for {variation.product.name} - {variation.name}: "
                            f"{item.expected_quantity} -> {item.counted_quantity}"
                        )
                    except Exception as e:
                        logger.error(f"Failed to adjust stock for variation {variation.id}: {str(e)}")
                        # Continue with other items even if one fails
                        continue

            # Complete the stock take
            stock_take.status = 'completed'
            stock_take.completed_at = timezone.now()
            stock_take.save(update_fields=['status', 'completed_at'])

        serializer = self.get_serializer(stock_take)
        return Response(serializer.data)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def adjust(request):
    """Manual stock adjustment"""
    logger.info(f"Stock adjustment request: {request.data}")
    
    product_id = request.data.get('product_id')
    outlet_id = request.data.get('outlet_id')
    quantity = request.data.get('quantity')
    reason = request.data.get('reason', '')
    movement_type = request.data.get('type', 'adjustment')
    
    if not all([product_id, outlet_id, quantity]):
        logger.error(f"Missing required fields: product_id={product_id}, outlet_id={outlet_id}, quantity={quantity}")
        return Response(
            {"detail": "product_id, outlet_id, and quantity are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        logger.error("User must have a tenant")
        return Response({"detail": "User must have a tenant"}, status=status.HTTP_400_BAD_REQUEST)
    
    logger.info(f"Processing adjustment for tenant={tenant.id}, product={product_id}, outlet={outlet_id}, quantity={quantity}")
    
    with transaction.atomic():
        try:
            # select_for_update must be inside the transaction
            product = Product.objects.select_for_update().get(id=product_id, tenant=tenant)
            logger.info(f"Found product: {product.name}, current stock: {product.stock}")
        except Product.DoesNotExist:
            logger.error(f"Product {product_id} not found for tenant {tenant.id}")
            return Response({"detail": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Get outlet
        from apps.outlets.models import Outlet
        try:
            outlet = Outlet.objects.get(id=outlet_id, tenant=tenant)
        except Outlet.DoesNotExist:
            logger.error(f"Outlet {outlet_id} not found for tenant {tenant.id}")
            return Response({"detail": "Outlet not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # UNITS ONLY ARCHITECTURE: No variations — track per-Product and Batch
        # Update LocationStock (product-based)
        location_stock, created = LocationStock.objects.get_or_create(
            tenant=tenant,
            product=product,
            outlet=outlet,
            defaults={'quantity': 0}
        )

        old_quantity = location_stock.quantity
        location_stock.quantity = max(0, location_stock.quantity + quantity)
        location_stock.save()
        logger.info(f"LocationStock updated: {old_quantity} -> {location_stock.quantity} for product {product.id} at outlet {outlet.id}")
        
        # Also update legacy Product.stock field for backward compatibility
        old_stock = product.stock
        product.stock = max(0, product.stock + quantity)
        product.save()
        logger.info(f"Product stock updated: {old_stock} -> {product.stock}")
        
        # Record movement (product-based)
        try:
            movement = StockMovement.objects.create(
                tenant=tenant,
                product=product,
                outlet=outlet,
                user=request.user,
                movement_type=movement_type,
                quantity=abs(quantity),
                reason=reason
            )
            logger.info(f"StockMovement created: id={movement.id}, type={movement_type}, quantity={movement.quantity}, product={product.id}")
        except Exception as e:
            logger.error(f"Failed to create StockMovement: {e}", exc_info=True)
            raise
    
    serializer = StockMovementSerializer(movement)
    logger.info(f"Returning movement data: {serializer.data}")
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def transfer(request):
    """Transfer stock between outlets"""
    product_id = request.data.get('product_id')
    from_outlet_id = request.data.get('from_outlet_id')
    to_outlet_id = request.data.get('to_outlet_id')
    quantity = request.data.get('quantity')
    reason = request.data.get('reason', '')
    is_return_raw = request.data.get('is_return', False)
    is_return = str(is_return_raw).lower() in ['true', '1', 'yes']
    return_number = request.data.get('return_number')
    
    if not all([product_id, from_outlet_id, to_outlet_id, quantity]):
        return Response(
            {"detail": "product_id, from_outlet_id, to_outlet_id, and quantity are required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if from_outlet_id == to_outlet_id:
        return Response(
            {"detail": "Source and destination outlets must be different"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        return Response({"detail": "User must have a tenant"}, status=status.HTTP_400_BAD_REQUEST)
    
    with transaction.atomic():
        try:
            # select_for_update must be inside the transaction
            product = Product.objects.select_for_update().get(id=product_id, tenant=tenant)
        except Product.DoesNotExist:
            return Response({"detail": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
        # Note: In a real system, you'd track stock per outlet
        # For now, we just record the movement
        StockMovement.objects.create(
            tenant=tenant,
            product=product,
            outlet_id=from_outlet_id,
            user=request.user,
            movement_type='transfer_out',
            quantity=quantity,
            reason=reason,
            reference_id=to_outlet_id
        )
        
        StockMovement.objects.create(
            tenant=tenant,
            product=product,
            outlet_id=to_outlet_id,
            user=request.user,
            movement_type='transfer_in',
            quantity=quantity,
            reason=reason,
            reference_id=from_outlet_id
        )

        if is_return:
            if not return_number:
                return_number = f"OUTLET-RET-{timezone.now().strftime('%Y%m%d%H%M%S')}"
            StockMovement.objects.create(
                tenant=tenant,
                product=product,
                outlet_id=from_outlet_id,
                user=request.user,
                movement_type='return',
                quantity=quantity,
                reason=reason or 'Outlet return',
                reference_id=return_number
            )
    
    return Response({"message": "Stock transfer recorded"}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def receive(request):
    """Receive inventory from suppliers (purchase)"""
    logger.info(f"Receiving request: {request.data}")
    
    outlet_id = request.data.get('outlet_id')
    supplier = request.data.get('supplier', '')
    items = request.data.get('items', [])
    reason = request.data.get('reason', '')
    
    if not outlet_id:
        logger.error("Missing outlet_id")
        return Response(
            {"detail": "outlet_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not items or not isinstance(items, list) or len(items) == 0:
        logger.error("Missing or empty items list")
        return Response(
            {"detail": "items list is required and must not be empty"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        logger.error("User must have a tenant")
        return Response({"detail": "User must have a tenant"}, status=status.HTTP_400_BAD_REQUEST)
    
    logger.info(f"Processing receiving for tenant={tenant.id} (name: {tenant.name}), outlet={outlet_id}, items={len(items)}, supplier={supplier}")
    
    results = []
    errors = []
    
    with transaction.atomic():
        for item in items:
            product_id = item.get('product_id')
            quantity = item.get('quantity')
            cost = item.get('cost')  # Optional: update product cost
            
            if not all([product_id, quantity]):
                errors.append({
                    "product_id": product_id,
                    "error": "product_id and quantity are required"
                })
                continue
            
            try:
                quantity = int(quantity)
                if quantity <= 0:
                    errors.append({
                        "product_id": product_id,
                        "error": "quantity must be positive"
                    })
                    continue
            except (ValueError, TypeError):
                errors.append({
                    "product_id": product_id,
                    "error": "quantity must be a valid integer"
                })
                continue
            
            try:
                # select_for_update must be inside the transaction
                product = Product.objects.select_for_update().get(id=product_id, tenant=tenant)
                logger.info(f"Found product: {product.name}, current stock: {product.stock}")
            except Product.DoesNotExist:
                logger.error(f"Product {product_id} not found for tenant {tenant.id}")
                errors.append({
                    "product_id": product_id,
                    "error": "Product not found"
                })
                continue
            
            # Get outlet
            from apps.outlets.models import Outlet
            try:
                outlet = Outlet.objects.get(id=outlet_id, tenant=tenant)
            except Outlet.DoesNotExist:
                errors.append({
                    "product_id": product_id,
                    "error": f"Outlet {outlet_id} not found"
                })
                continue
            
            # UNITS ONLY ARCHITECTURE: No variations needed, use Product directly
            # Removed: variation creation block as per architecture migration
            
            # UNITS ONLY ARCHITECTURE: Use Batch for inventory tracking instead of variations
            
            # Also update legacy Product.stock field for backward compatibility
            old_stock = product.stock
            product.stock += quantity
            product.save()
            logger.info(f"Product stock updated: {old_stock} -> {product.stock}")
            
            # Update cost if provided
            if cost is not None:
                try:
                    cost_decimal = Decimal(str(cost))
                    if cost_decimal >= 0:
                        product.cost = cost_decimal
                        product.save()
                        logger.info(f"Product cost updated: {product.cost}")
                except (ValueError, TypeError):
                    logger.warning(f"Invalid cost value: {cost}, skipping cost update")
            
            # Record movement without variation (UNITS ONLY ARCHITECTURE)
            try:
                movement_reason = reason or (f"Purchase from {supplier}" if supplier else "Purchase")
                movement = StockMovement.objects.create(
                    tenant=tenant,
                    product=product,
                    outlet=outlet,
                    user=request.user,
                    movement_type='purchase',
                    quantity=quantity,
                    reason=movement_reason,
                    reference_id=supplier if supplier else ''
                )
                logger.info(f"StockMovement created successfully: id={movement.id}, type=purchase, product={product.name}, quantity={movement.quantity}, tenant={tenant.id}, outlet={outlet_id}, supplier={supplier}")
                
                # Verify the record was created
                verify_movement = StockMovement.objects.get(id=movement.id)
                logger.info(f"Verified StockMovement exists: id={verify_movement.id}, movement_type={verify_movement.movement_type}, tenant={verify_movement.tenant.id}")
                
                serializer = StockMovementSerializer(movement)
                results.append(serializer.data)
            except Exception as e:
                logger.error(f"Failed to create StockMovement: {e}", exc_info=True)
                errors.append({
                    "product_id": product_id,
                    "error": str(e)
                })
    
    # Log final summary
    logger.info(f"Receiving completed: {len(results)} successful, {len(errors)} failed")
    logger.info(f"Total StockMovement records for tenant {tenant.id} with type 'purchase': {StockMovement.objects.filter(tenant=tenant, movement_type='purchase').count()}")
    
    if errors and not results:
        return Response(
            {"detail": "All items failed", "errors": errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    response_data = {
        "message": f"Received {len(results)} product(s)",
        "results": results,
    }
    
    if errors:
        response_data["errors"] = errors
        response_data["message"] += f", {len(errors)} failed"
    
    return Response(response_data, status=status.HTTP_201_CREATED)


class LocationStockViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Location Stock ViewSet - per-location inventory tracking"""
    queryset = LocationStock.objects.select_related('product', 'outlet', 'tenant')
    serializer_class = LocationStockSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'outlet']
    search_fields = ['product__name', 'product__sku', 'product__barcode']
    ordering_fields = ['product__name', 'quantity', 'updated_at']
    ordering = ['product__name']
    
    def get_queryset(self):
        """Filter by tenant"""
        user = self.request.user
        is_saas_admin = getattr(user, 'is_saas_admin', False)
        request_tenant = getattr(self.request, 'tenant', None)
        user_tenant = getattr(user, 'tenant', None)
        tenant = request_tenant or user_tenant
        
        queryset = LocationStock.objects.select_related('product', 'outlet', 'tenant').all()
        
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(tenant=tenant)
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
        
        # Filter by product if provided
        product_id = self.request.query_params.get('product')
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        
        return queryset
    
    def perform_create(self, serializer):
        """Set tenant and validate"""
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required")
        
        product = serializer.validated_data.get('product')
        outlet = serializer.validated_data.get('outlet')
        
        # Verify tenant matches
        if product.tenant != tenant:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Product does not belong to your tenant")
        
        if outlet.tenant != tenant:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Outlet does not belong to your tenant")
        
        serializer.save(tenant=tenant)
    
    def perform_update(self, serializer):
        """Ensure tenant is set and validate on update"""
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required")
        
        instance = serializer.instance
        product = serializer.validated_data.get('product', instance.product)
        outlet = serializer.validated_data.get('outlet', instance.outlet)
        new_quantity = serializer.validated_data.get('quantity', instance.quantity)
        
        # Verify tenant matches
        if product.tenant != tenant:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Product does not belong to your tenant")
        
        if outlet.tenant != tenant:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Outlet does not belong to your tenant")
        
        # Track old quantity before saving
        old_quantity = instance.quantity
        quantity_difference = new_quantity - old_quantity
        
        # Save the update
        serializer.save()
        
        # Update Product.stock for backward compatibility if quantity changed
        if quantity_difference != 0:
            product.stock = max(0, product.stock + quantity_difference)
            product.save(update_fields=['stock'])
            logger.info(f"Updated Product.stock for product {product.id}: {product.stock} (difference: {quantity_difference})")
        
        logger.info(f"LocationStock updated: id={instance.id}, product={product.id}, outlet={outlet.id}, quantity: {old_quantity} -> {new_quantity}")
    
    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """Bulk update stock for multiple variations at specific outlets"""
        updates = request.data.get('updates', [])
        outlet_id = request.data.get('outlet')
        
        if not outlet_id:
            return Response(
                {'error': 'outlet is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from apps.outlets.models import Outlet
            outlet = Outlet.objects.get(pk=outlet_id)
        except Outlet.DoesNotExist:
            return Response(
                {'error': 'Outlet not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        if outlet.tenant != tenant:
            return Response(
                {'error': 'Outlet does not belong to your tenant'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        results = []
        errors = []
        
        with transaction.atomic():
            for update in updates:
                product_id = update.get('product_id') or update.get('variation_id')
                quantity = update.get('quantity', 0)
                movement_type = update.get('movement_type', 'adjustment')
                reason = update.get('reason', 'Bulk update')

                if not product_id:
                    errors.append({'error': 'product_id is required', 'update': update})
                    continue

                try:
                    product = Product.objects.get(pk=product_id, tenant=tenant)
                except Product.DoesNotExist:
                    errors.append({'error': f'Product {product_id} not found', 'update': update})
                    continue

                # Get or create LocationStock (product-based)
                location_stock, created = LocationStock.objects.get_or_create(
                    tenant=tenant,
                    product=product,
                    outlet=outlet,
                    defaults={'quantity': 0}
                )

                # Update quantity
                old_quantity = location_stock.quantity
                location_stock.quantity = max(0, quantity)  # Ensure non-negative
                location_stock.save()

                # Create stock movement record (product-based)
                StockMovement.objects.create(
                    tenant=tenant,
                    product=product,
                    outlet=outlet,
                    user=request.user,
                    movement_type=movement_type,
                    quantity=location_stock.quantity - old_quantity,
                    reason=reason,
                    reference_id=f"BULK-{request.user.id}"
                )

                results.append({
                    'product_id': product_id,
                    'product_name': product.name,
                    'old_quantity': old_quantity,
                    'new_quantity': location_stock.quantity,
                    'difference': location_stock.quantity - old_quantity
                })
        
        return Response({
            'success': len(results),
            'errors': len(errors),
            'results': results,
            'error_details': errors
        }, status=status.HTTP_200_OK)


class BatchViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """
    Batch ViewSet for expiry tracking
    Provides CRUD operations and expiry monitoring
    """
    queryset = Batch.objects.select_related('product', 'outlet')
    serializer_class = BatchSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'product', 'outlet', 'batch_number']
    search_fields = ['batch_number', 'product__name']
    ordering_fields = ['expiry_date', 'created_at', 'quantity']
    ordering = ['expiry_date']
    
    def get_queryset(self):
        """Filter batches by tenant"""
        user = self.request.user
        is_saas_admin = getattr(user, 'is_saas_admin', False)
        request_tenant = getattr(self.request, 'tenant', None)
        user_tenant = getattr(user, 'tenant', None)
        tenant = request_tenant or user_tenant
        
        queryset = Batch.objects.select_related('product', 'outlet').all()
        
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(tenant=tenant)
            else:
                return queryset.none()
        
        # Filter by outlet if provided
        outlet = self.get_outlet_for_request(self.request)
        if outlet:
            queryset = queryset.filter(outlet=outlet)
        
        return queryset
    
    def perform_create(self, serializer):
        """Create batch with tenant"""
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required")
        
        serializer.save(tenant=tenant)
    
    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        """Get batches expiring within specified days (default 30)"""
        days = int(request.query_params.get('days', 30))
        product_id = request.query_params.get('product') or request.query_params.get('variation')
        outlet_id = request.query_params.get('outlet')
        
        product = None
        outlet = None
        if product_id:
            try:
                product = Product.objects.get(pk=product_id)
            except Product.DoesNotExist:
                pass
        
        if outlet_id:
            try:
                from apps.outlets.models import Outlet
                outlet = Outlet.objects.get(pk=outlet_id)
            except:
                pass
        
        expiring = get_expiring_soon(days=days, product=product, outlet=outlet)
        
        # Apply tenant filter
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        if tenant and not request.user.is_saas_admin:
            expiring = expiring.filter(tenant=tenant)
        
        serializer = self.get_serializer(expiring, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def expired(self, request):
        """Get all expired batches with quantity > 0"""
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        today = timezone.now().date()
        
        queryset = Batch.objects.filter(
            expiry_date__lte=today,
            quantity__gt=0
        )
        
        if tenant and not request.user.is_saas_admin:
            queryset = queryset.filter(tenant=tenant)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def mark_expired(self, request):
        """Mark expired batches and create expiry movements"""
        outlet_id = request.query_params.get('outlet')
        
        outlet = None
        
        if outlet_id:
            try:
                from apps.outlets.models import Outlet
                outlet = Outlet.objects.get(pk=outlet_id)
            except:
                return Response(
                    {"detail": "Outlet not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        expired_count = mark_expired_batches(outlet=outlet)
        
        return Response({
            "detail": f"Marked {expired_count} batches as expired",
            "expired_count": expired_count
        })
