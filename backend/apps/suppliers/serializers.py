from rest_framework import serializers
from decimal import Decimal
from .models import (
    Supplier, PurchaseOrder, SupplierInvoice,
    PurchaseReturn, PurchaseReturnItem, ProductSupplier
)
from apps.outlets.serializers import OutletSerializer
from apps.products.serializers import ProductSerializer
from apps.products.models import Product


class SupplierSerializer(serializers.ModelSerializer):
    """Supplier serializer"""
    outlet = OutletSerializer(read_only=True)
    outlet_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = Supplier
        fields = (
            'id', 'tenant', 'outlet', 'outlet_id', 'name', 'contact_name',
            'email', 'phone', 'address', 'city', 'state', 'zip_code', 'country', 'tax_id',
            'payment_terms', 'notes', 'is_active', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'tenant', 'created_at', 'updated_at')
    
    def validate_outlet_id(self, value):
        """Validate that outlet belongs to tenant"""
        # Convert empty string to None
        if value == '' or value is None:
            return None
        
        request = self.context.get('request')
        if request:
            tenant = getattr(request, 'tenant', None) or request.user.tenant
            if tenant:
                from apps.outlets.models import Outlet
                try:
                    # Convert to int if it's a string
                    outlet_id = int(value) if isinstance(value, str) else value
                    outlet = Outlet.objects.get(id=outlet_id, tenant=tenant)
                    return outlet_id
                except Outlet.DoesNotExist:
                    raise serializers.ValidationError("Outlet does not belong to your tenant")
                except (ValueError, TypeError):
                    raise serializers.ValidationError("Invalid outlet ID format")
        return None
    
    def create(self, validated_data):
        """Override create to handle outlet_id properly"""
        outlet_id = validated_data.pop('outlet_id', None)
        outlet = None
        if outlet_id:
            from apps.outlets.models import Outlet
            outlet = Outlet.objects.get(id=outlet_id)
        
        supplier = Supplier.objects.create(**validated_data, outlet=outlet)
        return supplier
    
    def update(self, instance, validated_data):
        """Override update to handle outlet_id properly"""
        outlet_id = validated_data.pop('outlet_id', None)
        if outlet_id is not None:
            if outlet_id:
                from apps.outlets.models import Outlet
                instance.outlet = Outlet.objects.get(id=outlet_id)
            else:
                instance.outlet = None
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """Purchase Order serializer"""
    supplier = SupplierSerializer(read_only=True)
    supplier_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    outlet = OutletSerializer(read_only=True)
    outlet_id = serializers.IntegerField(write_only=True)
    created_by = serializers.StringRelatedField(read_only=True)
    items_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        help_text="List of items to create for this purchase order"
    )
    
    class Meta:
        model = PurchaseOrder
        fields = (
            'id', 'tenant', 'supplier', 'supplier_id', 'outlet', 'outlet_id',
            'po_number', 'order_date', 'expected_delivery_date', 'status',
            'subtotal', 'tax', 'discount', 'total', 'notes', 'terms',
            'created_by', 'created_at', 'updated_at',
            'approved_at', 'received_at', 'items_data'
        )
        read_only_fields = ('id', 'tenant', 'po_number', 'created_by', 'created_at', 'updated_at', 'approved_at', 'received_at')
    
    def create(self, validated_data):
        """Create purchase order"""
        supplier_id = validated_data.pop('supplier_id', None)
        outlet_id = validated_data.pop('outlet_id')
        items_data = validated_data.pop('items_data', [])
        
        # Pop fields that are set explicitly to avoid duplicate keyword args
        validated_data.pop('tenant', None)
        validated_data.pop('outlet', None)
        validated_data.pop('created_by', None)
        
        from apps.outlets.models import Outlet
        outlet = Outlet.objects.get(id=outlet_id)
        tenant = outlet.tenant  # Get tenant from outlet instead of validated_data
        
        supplier = None
        if supplier_id:
            supplier = Supplier.objects.get(id=supplier_id)
        
        # Generate PO number
        from datetime import date
        today = date.today()
        po_count = PurchaseOrder.objects.filter(tenant=tenant, order_date__year=today.year).count() + 1
        po_number = f"PO-{today.strftime('%Y%m%d')}-{po_count:04d}"
        
        # Determine initial status based on supplier (pop to avoid duplicate keyword arg)
        initial_status = validated_data.pop('status', 'pending_supplier' if supplier is None else 'draft')
        
        purchase_order = PurchaseOrder.objects.create(
            tenant=tenant,
            supplier=supplier,
            outlet=outlet,
            po_number=po_number,
            status=initial_status,
            created_by=self.context['request'].user,
            **validated_data
        )
        
        # Create purchase order items if provided
        if items_data:
            from apps.products.models import Product
            from decimal import Decimal
            from django.apps import apps
            
            # Try to get PurchaseOrderItem model
            try:
                PurchaseOrderItem = apps.get_model('suppliers', 'PurchaseOrderItem')
            except LookupError:
                # If model doesn't exist, skip item creation
                PurchaseOrderItem = None
            
            if PurchaseOrderItem:
                for item_data in items_data:
                    product_id = item_data.get('product_id')
                    quantity = item_data.get('quantity', 1)
                    unit_price = Decimal(str(item_data.get('unit_price', '0')))
                    notes = item_data.get('notes', '')
                    
                    if product_id:
                        try:
                            product = Product.objects.get(id=product_id)
                            total = unit_price * Decimal(str(quantity))
                            
                            # Create PurchaseOrderItem
                            PurchaseOrderItem.objects.create(
                                purchase_order=purchase_order,
                                product=product,
                                quantity=quantity,
                                unit_price=unit_price,
                                total=total,
                                notes=notes,
                                received_quantity=0
                            )
                        except Product.DoesNotExist:
                            # Skip if product doesn't exist
                            pass
        
        return purchase_order


class SupplierInvoiceSerializer(serializers.ModelSerializer):
    """Supplier Invoice serializer"""
    supplier = SupplierSerializer(read_only=True)
    supplier_id = serializers.IntegerField(write_only=True)
    purchase_order = PurchaseOrderSerializer(read_only=True)
    purchase_order_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    outlet = OutletSerializer(read_only=True)
    outlet_id = serializers.IntegerField(write_only=True)
    balance = serializers.ReadOnlyField()
    
    class Meta:
        model = SupplierInvoice
        fields = (
            'id', 'tenant', 'supplier', 'supplier_id', 'purchase_order', 'purchase_order_id',
            'outlet', 'outlet_id', 'invoice_number', 'supplier_invoice_number',
            'invoice_date', 'due_date', 'status', 'subtotal', 'tax', 'discount',
            'total', 'amount_paid', 'balance', 'notes', 'payment_terms',
            'created_at', 'updated_at', 'paid_at'
        )
        read_only_fields = ('id', 'tenant', 'invoice_number', 'status', 'balance', 'created_at', 'updated_at', 'paid_at')
    
    def create(self, validated_data):
        """Create supplier invoice"""
        supplier_id = validated_data.pop('supplier_id')
        outlet_id = validated_data.pop('outlet_id')
        purchase_order_id = validated_data.pop('purchase_order_id', None)
        
        from apps.outlets.models import Outlet
        outlet = Outlet.objects.get(id=outlet_id)
        supplier = Supplier.objects.get(id=supplier_id)
        purchase_order = None
        if purchase_order_id:
            purchase_order = PurchaseOrder.objects.get(id=purchase_order_id)
        
        # Generate invoice number
        from datetime import date
        today = date.today()
        inv_count = SupplierInvoice.objects.filter(tenant=validated_data['tenant'], invoice_date__year=today.year).count() + 1
        invoice_number = f"INV-{today.strftime('%Y%m%d')}-{inv_count:04d}"
        
        invoice = SupplierInvoice.objects.create(
            **validated_data,
            supplier=supplier,
            outlet=outlet,
            purchase_order=purchase_order,
            invoice_number=invoice_number
        )
        
        return invoice


class PurchaseReturnSerializer(serializers.ModelSerializer):
    """Purchase Return serializer"""
    supplier = SupplierSerializer(read_only=True)
    supplier_id = serializers.IntegerField(write_only=True)
    purchase_order = PurchaseOrderSerializer(read_only=True)
    purchase_order_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    outlet = OutletSerializer(read_only=True)
    outlet_id = serializers.IntegerField(write_only=True)
    created_by = serializers.StringRelatedField(read_only=True)
    items_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        help_text="List of items to return (for future use)"
    )
    items = serializers.SerializerMethodField(read_only=True, help_text="Return items")
    
    class Meta:
        model = PurchaseReturn
        fields = (
            'id', 'tenant', 'supplier', 'supplier_id', 'purchase_order', 'purchase_order_id',
            'outlet', 'outlet_id', 'return_number', 'return_date', 'status',
            'reason', 'total', 'notes', 'created_by',
            'created_at', 'updated_at', 'returned_at', 'items_data', 'items'
        )
        read_only_fields = ('id', 'tenant', 'return_number', 'created_by', 'created_at', 'updated_at', 'returned_at')
    
    def get_items(self, obj):
        items = obj.items.select_related('product').all()
        return [
            {
                'id': item.id,
                'product_id': item.product_id,
                'product_name': item.product.name if item.product else "Unknown",
                'quantity': item.quantity,
                'unit_price': str(item.unit_price),
                'total': str(item.total),
                'reason': item.reason,
            }
            for item in items
        ]
    
    def create(self, validated_data):
        """Create purchase return"""
        supplier_id = validated_data.pop('supplier_id')
        outlet_id = validated_data.pop('outlet_id', None)
        purchase_order_id = validated_data.pop('purchase_order_id', None)
        items_data = validated_data.pop('items_data', [])

        from apps.outlets.models import Outlet

        outlet = validated_data.pop('outlet', None)
        if not outlet and outlet_id:
            outlet = Outlet.objects.get(id=outlet_id)

        supplier = Supplier.objects.get(id=supplier_id)
        purchase_order = None
        if purchase_order_id:
            purchase_order = PurchaseOrder.objects.get(id=purchase_order_id)

        tenant = validated_data.pop('tenant', None)
        if not tenant:
            request = self.context.get('request')
            if request:
                tenant = getattr(request, 'tenant', None) or request.user.tenant

        from datetime import date
        today = date.today()
        ret_count = PurchaseReturn.objects.filter(tenant=tenant, return_date__year=today.year).count() + 1
        return_number = f"RET-{today.strftime('%Y%m%d')}-{ret_count:04d}"

        user = validated_data.pop('created_by', None)
        if not user:
            request = self.context.get('request')
            user = request.user if request else None

        from django.db import transaction

        with transaction.atomic():
            purchase_return = PurchaseReturn.objects.create(
                **validated_data,
                tenant=tenant,
                supplier=supplier,
                outlet=outlet,
                purchase_order=purchase_order,
                return_number=return_number,
                created_by=user
            )

            total_amount = Decimal('0')
            for item_data in items_data:
                product_id = item_data.get('product_id') or item_data.get('product')
                quantity = item_data.get('quantity', 1)
                unit_price = item_data.get('unit_price', '0')
                reason = item_data.get('reason', '')

                if not product_id:
                    continue

                try:
                    quantity = int(Decimal(str(quantity)))
                except Exception:
                    quantity = 1

                if quantity <= 0:
                    continue

                product = Product.objects.get(id=product_id)
                unit_price_decimal = Decimal(str(unit_price))
                line_total = unit_price_decimal * Decimal(str(quantity))
                total_amount += line_total

                PurchaseReturnItem.objects.create(
                    tenant=tenant,
                    purchase_return=purchase_return,
                    product=product,
                    quantity=quantity,
                    unit_price=unit_price_decimal,
                    total=line_total,
                    reason=reason or ''
                )

            if (purchase_return.total is None or Decimal(str(purchase_return.total)) == Decimal('0')) and total_amount > 0:
                purchase_return.total = total_amount
                purchase_return.save(update_fields=['total'])

        return purchase_return

    def update(self, instance, validated_data):
        """Update purchase return and items"""
        items_data = validated_data.pop('items_data', None)
        supplier_id = validated_data.pop('supplier_id', None)
        outlet_id = validated_data.pop('outlet_id', None)
        purchase_order_id = validated_data.pop('purchase_order_id', None)

        if supplier_id:
            instance.supplier = Supplier.objects.get(id=supplier_id)
        if outlet_id:
            from apps.outlets.models import Outlet
            instance.outlet = Outlet.objects.get(id=outlet_id)
        if purchase_order_id is not None:
            if purchase_order_id:
                instance.purchase_order = PurchaseOrder.objects.get(id=purchase_order_id)
            else:
                instance.purchase_order = None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        from django.db import transaction

        with transaction.atomic():
            instance.save()

            if items_data is not None:
                instance.items.all().delete()
                total_amount = Decimal('0')
                for item_data in items_data:
                    product_id = item_data.get('product_id') or item_data.get('product')
                    quantity = item_data.get('quantity', 1)
                    unit_price = item_data.get('unit_price', '0')
                    reason = item_data.get('reason', '')

                    if not product_id:
                        continue

                    try:
                        quantity = int(Decimal(str(quantity)))
                    except Exception:
                        quantity = 1

                    if quantity <= 0:
                        continue

                    product = Product.objects.get(id=product_id)
                    unit_price_decimal = Decimal(str(unit_price))
                    line_total = unit_price_decimal * Decimal(str(quantity))
                    total_amount += line_total

                    PurchaseReturnItem.objects.create(
                        tenant=instance.tenant,
                        purchase_return=instance,
                        product=product,
                        quantity=quantity,
                        unit_price=unit_price_decimal,
                        total=line_total,
                        reason=reason or ''
                    )

                if total_amount > 0:
                    instance.total = total_amount
                    instance.save(update_fields=['total'])

        return instance


class ProductSupplierSerializer(serializers.ModelSerializer):
    """Product Supplier relationship serializer"""
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True)
    supplier = SupplierSerializer(read_only=True)
    supplier_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = ProductSupplier
        fields = (
            'id', 'tenant', 'product', 'product_id', 'supplier', 'supplier_id',
            'unit_cost', 'is_preferred',
            'is_active', 'notes', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'tenant', 'created_at', 'updated_at')
    
    def create(self, validated_data):
        """Create product-supplier relationship"""
        product_id = validated_data.pop('product_id')
        supplier_id = validated_data.pop('supplier_id')
        
        from apps.products.models import Product
        product = Product.objects.get(id=product_id)
        supplier = Supplier.objects.get(id=supplier_id)
        
        product_supplier = ProductSupplier.objects.create(
            **validated_data,
            product=product,
            supplier=supplier
        )
        return product_supplier
    
    def update(self, instance, validated_data):
        """Update product-supplier relationship"""
        if 'product_id' in validated_data:
            from apps.products.models import Product
            instance.product = Product.objects.get(id=validated_data.pop('product_id'))
        if 'supplier_id' in validated_data:
            instance.supplier = Supplier.objects.get(id=validated_data.pop('supplier_id'))
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance



