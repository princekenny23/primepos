"""
Stock management helper functions
Handles batch-aware stock operations with expiry tracking
"""
import logging
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta
from apps.inventory.models import Batch, LocationStock, StockMovement

logger = logging.getLogger(__name__)


def get_available_stock(unit, outlet):
    """
    Get available stock for a product unit at an outlet (excluding expired batches)
    UNITS ONLY ARCHITECTURE: Changed from variation-based to product-based
    
    Args:
        unit: ProductUnit instance (or Product for backward compatibility)
        outlet: Outlet instance
    
    Returns:
        int: Total available quantity (non-expired batches)
    """
    today = timezone.now().date()
    
    # Support both ProductUnit and Product for backward compatibility
    from apps.products.models import ProductUnit, Product
    if isinstance(unit, ProductUnit):
        product = unit.product
    else:
        product = unit
    
    batches = Batch.objects.filter(
        product=product,
        outlet=outlet,
        expiry_date__gt=today,
        quantity__gt=0
    )
    return sum(batch.quantity for batch in batches)


def get_batch_for_sale(product, outlet, required_quantity):
    """
    Get the best batch to deduct from (FIFO - First to Expire, First Out)
    UNITS ONLY ARCHITECTURE: Changed from variation-based to product-based
    
    Args:
        product: Product instance
        outlet: Outlet instance
        required_quantity: int - quantity needed
    
    Returns:
        Batch instance or None if insufficient stock
    """
    today = timezone.now().date()
    
    # Get non-expired batches ordered by expiry date (FIFO)
    batches = Batch.objects.select_for_update().filter(
        product=product,
        outlet=outlet,
        expiry_date__gt=today,
        quantity__gt=0
    ).order_by('expiry_date', 'created_at')
    
    # Check if we have enough stock
    total_available = sum(b.quantity for b in batches)
    if total_available < required_quantity:
        return None
    
    # Return the first batch (earliest expiry)
    return batches.first() if batches.exists() else None


@transaction.atomic
def deduct_stock(product, outlet, quantity, user, reference_id, reason=''):
    """
    Deduct stock from batches using FIFO expiry logic
    UNITS ONLY ARCHITECTURE: Changed from variation-based to product-based
    Optimized to reduce database queries (batch updates + movements collected then bulk-created)
    
    Args:
        product: Product instance
        outlet: Outlet instance
        quantity: int - quantity to deduct
        user: User instance
        reference_id: str - reference to sale/order
        reason: str - reason for deduction
    
    Returns:
        list of (Batch, quantity_deducted) tuples
    
    Raises:
        ValueError: If insufficient stock
    """
    today = timezone.now().date()
    remaining = quantity
    deductions = []
    batches_to_update = []
    movements_to_create = []
    
    # Get batches ordered by expiry (FIFO)
    batches = Batch.objects.select_for_update().filter(
        product=product,
        outlet=outlet,
        expiry_date__gt=today,
        quantity__gt=0
    ).order_by('expiry_date', 'created_at')
    
    # Check total available
    total_available = sum(b.quantity for b in batches)
    if total_available < quantity:
        raise ValueError(
            f"Insufficient stock for product. "
            f"Available: {total_available}, Requested: {quantity}"
        )
    
    # Collect batch updates and movements (don't save individually)
    for batch in batches:
        if remaining <= 0:
            break
        
        # Calculate deduction for this batch
        deduct_qty = min(batch.quantity, remaining)
        batch.quantity -= deduct_qty
        
        # Track for bulk update
        batches_to_update.append(batch)
        deductions.append((batch, deduct_qty))
        remaining -= deduct_qty
        
        # Prepare stock movement (will be bulk created)
        # Prepare stock movement (will be bulk created)
        movements_to_create.append(
            StockMovement(
                tenant=product.tenant,
                batch=batch,
                product=product,
                outlet=outlet,
                user=user,
                movement_type='sale',
                quantity=deduct_qty,
                reference_id=reference_id,
                reason=reason or f"Sale {reference_id}"
            )
        )
        
        logger.info(
            f"Deducting {deduct_qty} from batch {batch.batch_number} "
            f"({product.name}) at {outlet.name}"
        )
    
    # Bulk update all batches (1 query instead of N queries)
    Batch.objects.bulk_update(batches_to_update, ['quantity', 'updated_at'], batch_size=100)
    
    # Bulk create all stock movements (1 query instead of N queries)
    StockMovement.objects.bulk_create(movements_to_create, batch_size=100)
    
    # Update LocationStock once (after all batch updates)
    location_stock, created = LocationStock.objects.get_or_create(
        product=product,
        outlet=outlet,
        tenant=product.tenant,
        defaults={'quantity': 0}
    )
    location_stock.sync_quantity_from_batches()
    
    return deductions


@transaction.atomic
def add_stock(product, outlet, quantity, batch_number, expiry_date, cost_price=None, user=None, reason=''):
    """
    Add stock to a batch (creates batch if doesn't exist)
    UNITS ONLY ARCHITECTURE: Changed from variation-based to product-based
    
    Args:
        product: Product instance
        outlet: Outlet instance
        quantity: int - quantity to add
        batch_number: str - batch identifier
        expiry_date: date - when batch expires
        cost_price: Decimal - cost per unit (optional)
        user: User instance
        reason: str - reason for addition
    
    Returns:
        Batch instance
    """
    # Get or create batch
    batch, created = Batch.objects.get_or_create(
        product=product,
        outlet=outlet,
        batch_number=batch_number,
        defaults={
            'tenant': product.tenant,
            'expiry_date': expiry_date,
            'quantity': 0,
            'cost_price': cost_price
        }
    )
    
    if not created:
        # Update existing batch
        batch.quantity += quantity
        if cost_price is not None:
            batch.cost_price = cost_price
        batch.save(update_fields=['quantity', 'cost_price', 'updated_at'])
    else:
        batch.quantity = quantity
        batch.save(update_fields=['quantity'])
    
    # Create stock movement
    StockMovement.objects.create(
        tenant=product.tenant,
        batch=batch,
        product=product,
        outlet=outlet,
        user=user,
        movement_type='purchase',
        quantity=quantity,
        reason=reason or f"Stock addition - Batch {batch_number}"
    )
    
    # Update LocationStock
    location_stock, created = LocationStock.objects.get_or_create(
        product=product,
        outlet=outlet,
        tenant=product.tenant,
        defaults={'quantity': 0}
    )
    location_stock.sync_quantity_from_batches()
    
    logger.info(
        f"Added {quantity} to batch {batch_number} "
        f"({product.name}) at {outlet.name}, "
        f"expires {expiry_date}"
    )
    
    return batch


@transaction.atomic
def adjust_stock(product, outlet, new_quantity, user, reason='Stock adjustment'):
    """
    Adjust stock to a specific quantity (creates adjustment batch)
    UNITS ONLY ARCHITECTURE: Changed from variation-based to product-based
    
    Args:
        product: Product instance
        outlet: Outlet instance
        new_quantity: int - target quantity
        user: User instance
        reason: str - reason for adjustment
    
    Returns:
        Batch instance
    """
    current_quantity = get_available_stock(product, outlet)
    difference = new_quantity - current_quantity
    
    if difference == 0:
        logger.info(f"No adjustment needed for {product.name} at {outlet.name}")
        return None
    
    # Create adjustment batch
    today = timezone.now().date()
    batch_number = f"ADJ-{today.strftime('%Y%m%d')}-{product.id}"
    expiry_date = today + timedelta(days=365)  # 1 year default for adjustments
    
    if difference > 0:
        # Adding stock
        return add_stock(
            product=product,
            outlet=outlet,
            quantity=difference,
            batch_number=batch_number,
            expiry_date=expiry_date,
            user=user,
            reason=reason
        )
    else:
        # Removing stock (treat as negative adjustment)
        # Deduct from oldest batches first
        deduct_stock(
            product=product,
            outlet=outlet,
            quantity=abs(difference),
            user=user,
            reference_id=batch_number,
            reason=reason
        )
        return None


@transaction.atomic
def mark_expired_batches(product=None, outlet=None):
    """
    Mark expired batches and create expiry movements
    UNITS ONLY ARCHITECTURE: Changed from variation-based to product-based
    Can be called for specific product/outlet or for all
    
    Args:
        product: Product instance (optional)
        outlet: Outlet instance (optional)
    
    Returns:
        int: Number of batches marked as expired
    """
    today = timezone.now().date()
    
    # Build query
    query = Batch.objects.filter(
        expiry_date__lte=today,
        quantity__gt=0
    )
    
    if product:
        query = query.filter(product=product)
    if outlet:
        query = query.filter(outlet=outlet)
    
    expired_count = 0
    
    for batch in query.select_for_update():
        qty_expired = batch.quantity
        
        # Create expiry movement
        StockMovement.objects.create(
            tenant=batch.tenant,
            batch=batch,
            product=batch.product,
            outlet=batch.outlet,
            movement_type='expiry',
            quantity=qty_expired,
            reason=f"Batch expired on {batch.expiry_date}"
        )
        
        # Zero out the batch
        batch.quantity = 0
        batch.save(update_fields=['quantity', 'updated_at'])
        
        # Update LocationStock
        location_stock = LocationStock.objects.filter(
            product=batch.product,
            outlet=batch.outlet
        ).first()
        if location_stock:
            location_stock.sync_quantity_from_batches()
        
        expired_count += 1
        logger.warning(
            f"Marked {qty_expired} units as expired in batch {batch.batch_number} "
            f"({batch.product.name}) at {batch.outlet.name}"
        )
    
    return expired_count


def get_expiring_soon(days=30, product=None, outlet=None):
    """
    Get batches expiring within specified days
    UNITS ONLY ARCHITECTURE: Changed from variation-based to product-based
    
    Args:
        days: int - number of days threshold
        product: Product instance (optional)
        outlet: Outlet instance (optional)
    
    Returns:
        QuerySet of Batch instances
    """
    from datetime import timedelta
    today = timezone.now().date()
    threshold = today + timedelta(days=days)
    
    query = Batch.objects.filter(
        expiry_date__gt=today,
        expiry_date__lte=threshold,
        quantity__gt=0
    ).order_by('expiry_date')
    
    if product:
        query = query.filter(product=product)
    if outlet:
        query = query.filter(outlet=outlet)
    
    return query
