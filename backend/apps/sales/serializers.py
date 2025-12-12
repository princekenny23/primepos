from rest_framework import serializers
from decimal import Decimal, InvalidOperation
from .models import Sale, SaleItem, Delivery, DeliveryItem, DeliveryStatusHistory
from apps.products.serializers import ProductSerializer


class SaleItemSerializer(serializers.ModelSerializer):
    """Sale item serializer - optimized with minimal product data"""
    # Use minimal product representation instead of full ProductSerializer for performance
    product = serializers.SerializerMethodField()
    product_id = serializers.IntegerField(write_only=True, required=False)
    variation_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    unit_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    unit_name = serializers.CharField(read_only=True)
    quantity_in_base_units = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = SaleItem
        fields = (
            'id', 'product', 'product_id', 'variation_id', 'unit_id', 
            'product_name', 'variation_name', 'unit_name', 
            'quantity', 'quantity_in_base_units', 'price', 'total', 
            'kitchen_status', 'notes', 'prepared_at', 'created_at'
        )
        read_only_fields = ('id', 'product', 'product_name', 'variation_name', 'unit_name', 'quantity_in_base_units', 'prepared_at', 'created_at')
    
    def get_product(self, obj):
        """Return minimal product data for performance"""
        if not obj.product:
            return None
        return {
            'id': obj.product.id,
            'name': obj.product.name,
            'sku': obj.product.sku or '',
        }


class SaleSerializer(serializers.ModelSerializer):
    """Sale serializer with optimized nested data"""
    items = SaleItemSerializer(many=True, read_only=True)
    items_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=True
    )
    kitchen_tickets = serializers.SerializerMethodField()
    
    # Write-only fields for creation/update
    outlet = serializers.IntegerField(write_only=True, required=True)
    shift = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    customer = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    table_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    guests = serializers.IntegerField(required=False, allow_null=True)
    priority = serializers.ChoiceField(choices=[('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent')], required=False, default='normal')
    
    # Read-only nested representations (optimized to avoid N+1 queries)
    outlet_detail = serializers.SerializerMethodField(read_only=True)
    user_detail = serializers.SerializerMethodField(read_only=True)
    shift_detail = serializers.SerializerMethodField(read_only=True)
    customer_detail = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Sale
        fields = (
            'id', 'tenant', 'outlet', 'outlet_detail', 'user', 'user_detail', 
            'shift', 'shift_detail', 'customer', 'customer_detail', 'receipt_number',
            'subtotal', 'tax', 'discount', 'total', 'payment_method', 'status',
            'cash_received', 'change_given',
            'due_date', 'amount_paid', 'payment_status',
            'table', 'table_id', 'guests', 'priority',
            'notes', 'items', 'items_data', 'kitchen_tickets', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'tenant', 'user', 'receipt_number', 'due_date', 'amount_paid', 'payment_status', 'table', 'created_at', 'updated_at')
    
    def get_outlet_detail(self, obj):
        """Return outlet details as nested object"""
        if obj.outlet:
            return {
                'id': str(obj.outlet.id),
                'name': obj.outlet.name,
                'address': obj.outlet.address or '',
                'phone': obj.outlet.phone or '',
                'email': obj.outlet.email or '',
                'is_active': obj.outlet.is_active,
            }
        return None
    
    def get_user_detail(self, obj):
        """Return user details as nested object"""
        if obj.user:
            return {
                'id': str(obj.user.id),
                'email': obj.user.email,
                'first_name': obj.user.first_name or '',
                'last_name': obj.user.last_name or '',
                'full_name': obj.user.get_full_name() or obj.user.email,
            }
        return None
    
    def get_shift_detail(self, obj):
        """Return shift details as nested object"""
        if obj.shift:
            return {
                'id': str(obj.shift.id),
                'operating_date': obj.shift.operating_date.isoformat() if obj.shift.operating_date else None,
                'status': obj.shift.status or '',
                'start_time': obj.shift.start_time.isoformat() if obj.shift.start_time else None,
            }
        return None
    
    def get_customer_detail(self, obj):
        """Return customer details as nested object"""
        if obj.customer:
            return {
                'id': str(obj.customer.id),
                'name': obj.customer.name,
                'email': obj.customer.email or '',
                'phone': obj.customer.phone or '',
            }
        return None
    
    def get_kitchen_tickets(self, obj):
        """Return kitchen order tickets for this sale"""
        if hasattr(obj, 'kitchen_tickets'):
            return [
                {
                    'id': str(kot.id),
                    'kot_number': kot.kot_number,
                    'status': kot.status,
                    'priority': kot.priority,
                    'sent_to_kitchen_at': kot.sent_to_kitchen_at.isoformat() if kot.sent_to_kitchen_at else None,
                }
                for kot in obj.kitchen_tickets.all()
            ]
        return []
    
    def validate_outlet(self, value):
        """Validate outlet exists and belongs to tenant"""
        if not value:
            raise serializers.ValidationError("Outlet is required")
        
        request = self.context.get('request')
        if not request:
            return value
        
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        if not tenant:
            raise serializers.ValidationError("Unable to determine tenant")
        
        from apps.outlets.models import Outlet
        try:
            outlet = Outlet.objects.get(id=value, tenant=tenant)
            return outlet.id
        except Outlet.DoesNotExist:
            raise serializers.ValidationError(f"Outlet {value} not found or does not belong to your tenant")
    
    def validate_shift(self, value):
        """Validate shift exists and belongs to tenant (if provided)"""
        if value is None:
            return None
        
        request = self.context.get('request')
        if not request:
            return value
        
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        if not tenant:
            return value  # Will be validated in validate method
        
        from apps.shifts.models import Shift
        try:
            shift = Shift.objects.get(id=value, outlet__tenant=tenant)
            return shift.id
        except Shift.DoesNotExist:
            raise serializers.ValidationError(f"Shift {value} not found or does not belong to your tenant")
    
    def validate_customer(self, value):
        """Validate customer exists and belongs to tenant (if provided)"""
        if value is None:
            return None
        
        request = self.context.get('request')
        if not request:
            return value
        
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        if not tenant:
            return value
        
        from apps.customers.models import Customer
        try:
            customer = Customer.objects.get(id=value, tenant=tenant)
            return customer.id
        except Customer.DoesNotExist:
            raise serializers.ValidationError(f"Customer {value} not found or does not belong to your tenant")
    
    def validate_items_data(self, value):
        """Validate sale items"""
        if not value or len(value) == 0:
            raise serializers.ValidationError("Sale must have at least one item")
        
        # Validate each item
        for idx, item in enumerate(value):
            if 'product_id' not in item or not item.get('product_id'):
                raise serializers.ValidationError(f"Item {idx + 1}: product_id is required")
            
            if 'quantity' not in item or not item.get('quantity') or item.get('quantity', 0) <= 0:
                raise serializers.ValidationError(f"Item {idx + 1}: quantity must be greater than 0")
            
            # Price can be optional if unit_id is provided (will use unit price)
            if 'price' not in item or item.get('price') is None:
                # Check if unit_id is provided
                if not item.get('unit_id'):
                    raise serializers.ValidationError(f"Item {idx + 1}: price is required if unit_id is not provided")
            
            # Validate price is a valid number if provided
            if 'price' in item and item.get('price') is not None:
                try:
                    price = Decimal(str(item.get('price')))
                    if price <= 0:
                        raise serializers.ValidationError(f"Item {idx + 1}: price must be greater than 0")
                except (InvalidOperation, ValueError, TypeError):
                    raise serializers.ValidationError(f"Item {idx + 1}: price must be a valid number")
        
        return value
    
    def validate(self, attrs):
        """Additional validation"""
        # Ensure outlet is set (should be validated in validate_outlet_id, but double-check)
        if 'outlet' not in attrs or not attrs.get('outlet'):
            raise serializers.ValidationError({"outlet": "Outlet is required"})
        
        # Validate subtotal, tax, discount, total are valid decimals and round to 2 decimal places
        for field in ['subtotal', 'tax', 'discount', 'total']:
            if field in attrs:
                try:
                    value = Decimal(str(attrs[field])).quantize(Decimal('0.01'))
                    if value < 0:
                        raise serializers.ValidationError({field: f"{field} cannot be negative"})
                    attrs[field] = value
                except (InvalidOperation, ValueError, TypeError):
                    raise serializers.ValidationError({field: f"{field} must be a valid number"})
        
        # Ensure payment_method is valid
        if 'payment_method' in attrs:
            valid_methods = ['cash', 'card', 'mobile', 'tab', 'credit']
            if attrs['payment_method'] not in valid_methods:
                raise serializers.ValidationError({
                    "payment_method": f"Invalid payment method. Must be one of: {', '.join(valid_methods)}"
                })
        
        return attrs


class DeliveryItemSerializer(serializers.ModelSerializer):
    """Delivery item serializer"""
    sale_item = SaleItemSerializer(read_only=True)
    sale_item_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = DeliveryItem
        fields = ('id', 'delivery', 'sale_item', 'sale_item_id', 'quantity', 'is_delivered', 
                  'delivered_quantity', 'notes', 'created_at')
        read_only_fields = ('id', 'delivery', 'created_at')


class DeliveryStatusHistorySerializer(serializers.ModelSerializer):
    """Delivery status history serializer"""
    changed_by_email = serializers.SerializerMethodField()
    
    class Meta:
        model = DeliveryStatusHistory
        fields = ('id', 'delivery', 'status', 'previous_status', 'changed_by', 'changed_by_email', 
                  'notes', 'created_at')
        read_only_fields = ('id', 'delivery', 'changed_by', 'created_at')
    
    def get_changed_by_email(self, obj):
        return obj.changed_by.email if obj.changed_by else None


class DeliverySerializer(serializers.ModelSerializer):
    """Delivery serializer"""
    delivery_items = DeliveryItemSerializer(many=True, read_only=True)
    sale = SaleSerializer(read_only=True)
    sale_id = serializers.IntegerField(write_only=True, required=True)
    customer_name = serializers.SerializerMethodField()
    outlet_name = serializers.SerializerMethodField()
    created_by_email = serializers.SerializerMethodField()
    assigned_to_email = serializers.SerializerMethodField()
    delivered_by_email = serializers.SerializerMethodField()
    status_history = DeliveryStatusHistorySerializer(many=True, read_only=True)
    
    class Meta:
        model = Delivery
        fields = (
            'id', 'tenant', 'sale', 'sale_id', 'outlet', 'outlet_name', 'customer', 'customer_name',
            'delivery_number', 'status', 'delivery_method',
            'delivery_address', 'delivery_city', 'delivery_state', 'delivery_postal_code', 'delivery_country',
            'delivery_contact_name', 'delivery_contact_phone',
            'scheduled_date', 'scheduled_time_start', 'scheduled_time_end', 'actual_delivery_date',
            'courier_name', 'tracking_number', 'driver_name', 'vehicle_number',
            'delivery_fee', 'shipping_cost',
            'notes', 'customer_notes', 'delivery_instructions',
            'created_by', 'created_by_email', 'assigned_to', 'assigned_to_email', 
            'delivered_by', 'delivered_by_email',
            'created_at', 'updated_at', 'confirmed_at', 'dispatched_at', 'completed_at',
            'delivery_items', 'status_history'
        )
        read_only_fields = (
            'id', 'tenant', 'sale', 'delivery_number', 'outlet_name', 'customer_name',
            'created_by', 'created_by_email', 'assigned_to_email', 'delivered_by_email',
            'created_at', 'updated_at', 'confirmed_at', 'dispatched_at', 'completed_at'
        )
    
    def get_customer_name(self, obj):
        return obj.customer.name if obj.customer else None
    
    def get_outlet_name(self, obj):
        return obj.outlet.name if obj.outlet else None
    
    def get_created_by_email(self, obj):
        return obj.created_by.email if obj.created_by else None
    
    def get_assigned_to_email(self, obj):
        return obj.assigned_to.email if obj.assigned_to else None
    
    def get_delivered_by_email(self, obj):
        return obj.delivered_by.email if obj.delivered_by else None
    
    def validate_sale_id(self, value):
        """Validate sale exists and belongs to tenant"""
        request = self.context.get('request')
        if not request:
            return value
        
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        if not tenant:
            raise serializers.ValidationError("Unable to determine tenant")
        
        try:
            sale = Sale.objects.get(id=value, tenant=tenant)
            return sale.id
        except Sale.DoesNotExist:
            raise serializers.ValidationError(f"Sale {value} not found or does not belong to your tenant")

