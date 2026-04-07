import secrets
from decimal import Decimal
from urllib.parse import quote_plus

from django.db import transaction
from django.db.models import Max

from apps.inventory.models import StockMovement
from apps.products.models import Product, ProductUnit
from apps.sales.models import Sale, SaleItem
from apps.sales.services import ReceiptService

from .models import Storefront, StorefrontOrder


def _generate_public_order_ref() -> str:
    return f"ORD-{secrets.token_hex(5).upper()}"


def _build_whatsapp_url(phone: str, message: str) -> str:
    clean_phone = ''.join(ch for ch in phone if ch.isdigit() or ch == '+').replace('+', '')
    if not clean_phone:
        return ''
    return f"https://wa.me/{clean_phone}?text={quote_plus(message)}"


def _generate_sale_receipt_number() -> str:
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


@transaction.atomic
def create_whatsapp_order(storefront: Storefront, payload: dict):
    items = payload.get('items', [])
    if not items:
        raise ValueError('At least one item is required.')

    outlet = storefront.default_outlet
    tenant = storefront.tenant

    subtotal = Decimal('0.00')
    sale_items = []

    for index, item in enumerate(items):
        product_id = int(item.get('product_id'))
        quantity = int(item.get('quantity', 1))
        if quantity <= 0:
            raise ValueError(f'Item {index + 1}: quantity must be greater than 0.')

        try:
            product = Product.objects.select_for_update().get(
                id=product_id,
                tenant=tenant,
                outlet=outlet,
                is_active=True,
            )
        except Product.DoesNotExist as exc:
            raise ValueError(f'Item {index + 1}: invalid product.') from exc

        unit_id = item.get('unit_id')
        unit = None
        quantity_in_base_units = quantity
        unit_name = product.unit
        price = product.retail_price

        if unit_id:
            try:
                unit = ProductUnit.objects.get(id=int(unit_id), product=product, is_active=True)
            except ProductUnit.DoesNotExist as exc:
                raise ValueError(f'Item {index + 1}: invalid unit.') from exc
            quantity_in_base_units = unit.convert_to_base_units(quantity)
            unit_name = unit.unit_name
            price = unit.retail_price

        if product.stock < quantity_in_base_units:
            raise ValueError(
                f"Item {index + 1}: insufficient stock for {product.name}. "
                f"Available: {product.stock}, requested: {quantity_in_base_units}."
            )

        line_total = (Decimal(quantity) * price).quantize(Decimal('0.01'))
        subtotal += line_total

        sale_items.append({
            'product': product,
            'unit': unit,
            'unit_name': unit_name,
            'quantity': quantity,
            'quantity_in_base_units': quantity_in_base_units,
            'price': price,
            'total': line_total,
        })

    receipt_number = _generate_sale_receipt_number()
    notes = (payload.get('notes') or '').strip()

    sale = Sale.objects.create(
        receipt_number=receipt_number,
        tenant=tenant,
        outlet=outlet,
        user=None,
        subtotal=subtotal,
        tax=Decimal('0.00'),
        discount=Decimal('0.00'),
        discount_amount=Decimal('0.00'),
        total=subtotal,
        payment_method='cash',
        status='pending',
        payment_status='unpaid',
        amount_paid=Decimal('0.00'),
        delivery_required=True,
        notes=f"{notes} Channel: whatsapp".strip(),
    )

    for entry in sale_items:
        SaleItem.objects.create(
            sale=sale,
            product=entry['product'],
            unit=entry['unit'],
            product_name=entry['product'].name,
            variation_name='',
            unit_name=entry['unit_name'],
            quantity=entry['quantity'],
            quantity_in_base_units=entry['quantity_in_base_units'],
            price=entry['price'],
            tax_rate_at_sale=Decimal('0.00'),
            total=entry['total'],
            notes='',
            kitchen_status='pending',
        )

        # Reserve stock immediately using the same movement ledger used by existing sales.
        product = entry['product']
        product.stock -= entry['quantity_in_base_units']
        product.save(update_fields=['stock'])

        StockMovement.objects.create(
            tenant=tenant,
            product=product,
            outlet=outlet,
            user=None,
            movement_type='sale',
            quantity=entry['quantity_in_base_units'],
            reference_id=str(sale.id),
            reason=f"Storefront WhatsApp order {sale.receipt_number}",
        )

    customer_name = payload.get('customer_name', '').strip()
    customer_phone = payload.get('customer_phone', '').strip()
    customer_address = payload.get('customer_address', '').strip()

    lines = [
        f"Order Ref: {sale.receipt_number}",
        f"Customer: {customer_name}",
        "Items:",
    ]
    for entry in sale_items:
        lines.append(
            f"- {entry['product'].name} ({entry['unit_name']}): {entry['quantity']} x {entry['price']} = {entry['total']}"
        )
    lines.extend([
        f"Total: {sale.total}",
        "Payment: Cash on delivery",
    ])
    if customer_address:
        lines.append(f"Address: {customer_address}")
    if notes:
        lines.append(f"Notes: {notes}")

    message = '\n'.join(lines)
    wa_phone = storefront.whatsapp_number or storefront.tenant.phone
    whatsapp_url = _build_whatsapp_url(wa_phone, message)

    order = StorefrontOrder.objects.create(
        storefront=storefront,
        sale=sale,
        public_order_ref=_generate_public_order_ref(),
        channel='whatsapp',
        payment_method='cash',
        status='pending',
        customer_name=customer_name,
        customer_phone=customer_phone,
        customer_address=customer_address,
        whatsapp_message=message,
    )

    transaction.on_commit(lambda: ReceiptService.generate_receipt(sale, format='pdf', user=None))

    return order, whatsapp_url
