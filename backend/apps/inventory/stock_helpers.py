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


def _coerce_decimal(value):
    if value is None:
        return Decimal('0.00')
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _resolve_product(product=None, variation=None):
    """Support both the current Product-based API and older variation-based calls."""
    from apps.products.models import Product

    if product is not None:
        if isinstance(product, Product):
            return product
        product_attr = getattr(product, 'product', None)
        if isinstance(product_attr, Product):
            return product_attr
        return product

    if variation is not None:
        if isinstance(variation, Product):
            return variation
        product_attr = getattr(variation, 'product', None)
        if isinstance(product_attr, Product):
            return product_attr
        return variation

    raise TypeError('A product instance is required')


def _get_ledger_quantity_and_cost(product, outlet):
    """Return the current stock quantity and weighted-average acquisition cost from the movement ledger."""
    from django.db.models import Sum

    positive_movements = StockMovement.objects.filter(
        product=product,
        outlet=outlet,
        movement_type__in=['purchase', 'adjustment', 'return', 'transfer_in'],
    ).order_by('created_at')
    negative_movements = StockMovement.objects.filter(
        product=product,
        outlet=outlet,
        movement_type__in=['sale', 'transfer_out', 'damage', 'expiry'],
    ).order_by('created_at')

    total_acquired_qty = int(positive_movements.aggregate(total=Sum('quantity'))['total'] or 0)
    total_acquired_cost = Decimal('0.00')
    for movement in positive_movements:
        unit_cost = _coerce_decimal(
            movement.batch.cost_price if movement.batch_id and movement.batch and movement.batch.cost_price is not None else product.cost
        )
        total_acquired_cost += unit_cost * Decimal(int(movement.quantity or 0))

    sold_qty = int(negative_movements.aggregate(total=Sum('quantity'))['total'] or 0)
    current_qty = max(0, total_acquired_qty - sold_qty)
    return current_qty, total_acquired_cost, total_acquired_qty


def get_stock_valuation(product, outlet):
    """Return current stock quantity and value using the weighted-average cost method."""
    today = timezone.now().date()
    active_batches = list(
        Batch.objects.filter(product=product, outlet=outlet, expiry_date__gt=today, quantity__gt=0).order_by('expiry_date', 'created_at')
    )

    quantity, total_cost, total_acquired_qty = _get_ledger_quantity_and_cost(product, outlet)
    if total_acquired_qty > 0:
        unit_cost = (total_cost / Decimal(total_acquired_qty)).quantize(Decimal('0.01'))
        value = (unit_cost * Decimal(quantity)).quantize(Decimal('0.01')) if quantity else Decimal('0.00')
        return {
            'quantity': quantity,
            'value': value,
            'unit_cost': unit_cost,
            'batches': active_batches,
        }

    if active_batches:
        quantity = sum(int(batch.quantity or 0) for batch in active_batches)
        value = Decimal('0.00')
        for batch in active_batches:
            unit_cost = _coerce_decimal(batch.cost_price if batch.cost_price is not None else product.cost)
            value += unit_cost * Decimal(int(batch.quantity or 0))
        return {
            'quantity': quantity,
            'value': value.quantize(Decimal('0.01')),
            'unit_cost': _coerce_decimal(product.cost),
            'batches': active_batches,
        }

    unit_cost = _coerce_decimal(product.cost)
    return {
        'quantity': 0,
        'value': Decimal('0.00'),
        'unit_cost': unit_cost,
        'batches': [],
    }


def rebuild_stock_state(product, outlet, user=None, reason='Stock state rebuild'):
    """Synchronize the denormalized stock fields from the stock ledger and batches."""
    valuation = get_stock_valuation(product, outlet)
    location_stock, _ = LocationStock.objects.get_or_create(
        product=product,
        outlet=outlet,
        tenant=product.tenant,
        defaults={'quantity': 0},
    )
    location_stock.quantity = valuation['quantity']
    location_stock.save(update_fields=['quantity', 'updated_at'])

    from apps.products.models import Product as _Product
    _Product.objects.filter(id=product.id).update(stock=valuation['quantity'])
    product.stock = valuation['quantity']
    return valuation


def get_sellable_stock(product, outlet):
    """Return sellable stock for a product at an outlet.

    Prefer non-expired batch quantities when batch records exist. If there are
    no valid batches, use outlet-level location stock. Do not fall back to
    product-level legacy stock.
    """
    today = timezone.now().date()
    batches = Batch.objects.filter(
        product=product,
        outlet=outlet,
        expiry_date__gt=today,
        quantity__gt=0
    )
    batch_total = sum(batch.quantity for batch in batches)

    if batch_total > 0:
        return batch_total

    has_any_batches = Batch.objects.filter(product=product, outlet=outlet).exists()
    if has_any_batches:
        return 0

    location_stock = LocationStock.objects.filter(product=product, outlet=outlet).values_list('quantity', flat=True).first()
    if location_stock is not None:
        return location_stock

    return 0


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
    from apps.products.models import ProductUnit

    if isinstance(unit, ProductUnit):
        product = unit.product
    else:
        product = _resolve_product(product=unit)

    return get_sellable_stock(product, outlet)


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
    product = _resolve_product(product=product)

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
def deduct_stock(product=None, outlet=None, quantity=None, user=None, reference_id='', reason='', movement_type='sale', variation=None):
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
    product = _resolve_product(product=product, variation=variation)

    if quantity is None:
        raise TypeError('quantity is required')

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

    # Check total available. If a legacy/non-expiry product has no batches,
    # fall back to outlet projections so checkout matches the stock value shown in POS.
    batch_total_available = sum(b.quantity for b in batches)
    if batch_total_available < quantity and not batches.exists():
        total_available = get_sellable_stock(product, outlet)
        if total_available < quantity:
            raise ValueError(
                f"Insufficient stock for product. "
                f"Available: {total_available}, Requested: {quantity}"
            )

        location_stock, _ = LocationStock.objects.get_or_create(
            product=product,
            outlet=outlet,
            tenant=product.tenant,
            defaults={'quantity': 0}
        )
        next_quantity = max(0, int(location_stock.quantity or 0) - quantity)
        LocationStock.objects.filter(id=location_stock.id).update(quantity=next_quantity)
        location_stock.quantity = next_quantity

        from apps.products.models import Product as _Product
        next_product_stock = max(0, int(getattr(product, 'stock', 0) or 0) - quantity)
        _Product.objects.filter(id=product.id).update(stock=next_product_stock)
        product.stock = next_product_stock

        StockMovement.objects.create(
            tenant=product.tenant,
            batch=None,
            product=product,
            outlet=outlet,
            user=user,
            movement_type=movement_type,
            quantity=quantity,
            reference_id=reference_id,
            reason=reason or f"{movement_type.title()} {reference_id}"
        )

        logger.info(
            f"Deducted {quantity} from legacy stock projection for {product.name} at {outlet.name}"
        )
        return [(None, quantity)]

    total_available = batch_total_available
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
                movement_type=movement_type,
                quantity=deduct_qty,
                reference_id=reference_id,
                reason=reason or f"{movement_type.title()} {reference_id}"
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

    rebuild_stock_state(product, outlet, user=user, reason=reason or f"{movement_type.title()} stock deduction")

    return deductions


@transaction.atomic
def add_stock(product=None, outlet=None, quantity=None, batch_number=None, expiry_date=None, cost_price=None, user=None, reason='', movement_type='purchase', variation=None):
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
    product = _resolve_product(product=product, variation=variation)

    if quantity is None:
        raise TypeError('quantity is required')
    if batch_number is None or expiry_date is None:
        raise TypeError('batch_number and expiry_date are required')

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
        movement_type=movement_type,
        quantity=quantity,
        reason=reason or f"{movement_type.title()} - Batch {batch_number}"
    )
    
    rebuild_stock_state(product, outlet, user=user, reason=reason or f"{movement_type.title()} stock addition")

    logger.info(
        f"Added {quantity} to batch {batch_number} "
        f"({product.name}) at {outlet.name}, "
        f"expires {expiry_date}"
    )
    
    return batch


@transaction.atomic
def adjust_stock(product=None, outlet=None, new_quantity=None, user=None, reason='Stock adjustment', variation=None):
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
    product = _resolve_product(product=product, variation=variation)

    if new_quantity is None:
        raise TypeError('new_quantity is required')

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
            reason=reason,
            movement_type='adjustment'
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
            reason=reason,
            movement_type='adjustment'
        )
        return None


@transaction.atomic
def mark_expired_batches(product=None, outlet=None, variation=None):
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
    product = _resolve_product(product=product, variation=variation)

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
        
        rebuild_stock_state(batch.product, batch.outlet, user=None, reason=f"Batch expiry cleanup for {batch.batch_number}")

        expired_count += 1
        logger.warning(
            f"Marked {qty_expired} units as expired in batch {batch.batch_number} "
            f"({batch.product.name}) at {batch.outlet.name}"
        )
    
    return expired_count


def get_expiring_soon(days=30, product=None, outlet=None, variation=None):
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
    product = _resolve_product(product=product, variation=variation) if product is not None or variation is not None else None

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


@transaction.atomic
def restore_stock_for_refund(product, outlet, quantity, user, reference_id, reason='Refund'):
    """
    Return stock to inventory after a refund.  Creates a StockMovement of type
    'return' and updates Product.stock.  If an active batch exists we bump its
    quantity; otherwise a new perpetual batch is created.

    Args:
        product: Product instance
        outlet: Outlet instance
        quantity: int – number of base units being returned
        user: User instance
        reference_id: str – refund or sale receipt number
        reason: str

    Returns:
        Batch that received the stock
    """
    from datetime import timedelta

    today = timezone.now().date()

    # Try to restore into the youngest non-expired batch for this product/outlet.
    existing_batch = (
        Batch.objects.select_for_update()
        .filter(product=product, outlet=outlet, expiry_date__gt=today, quantity__gte=0)
        .order_by('-expiry_date')
        .first()
    )

    if existing_batch:
        existing_batch.quantity += quantity
        existing_batch.save(update_fields=['quantity', 'updated_at'])
        target_batch = existing_batch
    else:
        # No usable batch – create a perpetual one with a 1-year expiry.
        batch_number = f"RET-{today.strftime('%Y%m%d')}-{product.id}-{reference_id}"
        target_batch = Batch.objects.create(
            tenant=product.tenant,
            outlet=outlet,
            product=product,
            batch_number=batch_number,
            expiry_date=today + timedelta(days=365),
            quantity=quantity,
            cost_price=product.cost,
        )

    StockMovement.objects.create(
        tenant=product.tenant,
        batch=target_batch,
        product=product,
        outlet=outlet,
        user=user,
        movement_type='return',
        quantity=quantity,
        reference_id=reference_id,
        reason=reason,
    )

    rebuild_stock_state(product, outlet, user=user, reason=reason or 'Refund restoration')

    logger.info(
        f"Restored {quantity} units to batch {target_batch.batch_number} "
        f"({product.name}) at {outlet.name} via refund {reference_id}"
    )
    return target_batch
