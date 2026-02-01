from rest_framework import serializers
from decimal import Decimal, InvalidOperation
from .models import Sale, SaleItem, Receipt
from .models import ReceiptTemplate
from apps.products.serializers import ProductSerializer


class SaleItemSerializer(serializers.ModelSerializer):
    """Sale item serializer - optimized with minimal product data"""
    # Use minimal product representation instead of full ProductSerializer for performance
    product = serializers.SerializerMethodField()
    product_id = serializers.IntegerField(write_only=True, required=False)
    unit_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    unit_name = serializers.CharField(read_only=True)
    quantity_in_base_units = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = SaleItem
        fields = (
            'id', 'product', 'product_id', 'unit_id', 
            'product_name', 'unit_name', 
            'quantity', 'quantity_in_base_units', 'price', 'total', 
            'kitchen_status', 'notes', 'prepared_at', 'created_at'
        )
        read_only_fields = ('id', 'product', 'product_name', 'unit_name', 'quantity_in_base_units', 'prepared_at', 'created_at')
    
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
    till = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    table_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    guests = serializers.IntegerField(required=False, allow_null=True)
    priority = serializers.ChoiceField(choices=[('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent')], required=False, default='normal')
    
    # Read-only nested representations (optimized to avoid N+1 queries)
    outlet_detail = serializers.SerializerMethodField(read_only=True)
    user_detail = serializers.SerializerMethodField(read_only=True)
    shift_detail = serializers.SerializerMethodField(read_only=True)
    customer_detail = serializers.SerializerMethodField(read_only=True)
    till_detail = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Sale
        fields = (
            'id', 'tenant', 'outlet', 'outlet_detail', 'user', 'user_detail', 
            'shift', 'shift_detail', 'customer', 'customer_detail', 'till', 'till_detail', 'receipt_number',
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
    
    def get_till_detail(self, obj):
        """Return till details as nested object"""
        if obj.till:
            return {
                'id': str(obj.till.id),
                'name': obj.till.name,
                'outlet_id': str(obj.till.outlet.id) if obj.till.outlet else None,
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


class ReceiptSerializer(serializers.ModelSerializer):
    """Receipt serializer"""
    sale_detail = serializers.SerializerMethodField()
    generated_by_email = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Receipt
        fields = (
            'id', 'tenant', 'sale', 'sale_detail', 'receipt_number',
            'format', 'content', 'pdf_file', 'pdf_url',
            'generated_at', 'generated_by', 'generated_by_email',
            'is_sent', 'sent_at', 'sent_via',
            'access_count', 'last_accessed_at'
        )
        read_only_fields = (
            'id', 'tenant', 'sale', 'receipt_number', 'generated_at',
            'generated_by', 'access_count', 'last_accessed_at'
        )
    
    def get_sale_detail(self, obj):
        """Return minimal sale information"""
        if not obj.sale:
            return None
        return {
            'id': obj.sale.id,
            'receipt_number': obj.sale.receipt_number,
            'total': str(obj.sale.total),
            'created_at': obj.sale.created_at.isoformat(),
            'outlet': {
                'id': str(obj.sale.outlet.id) if obj.sale.outlet else None,
                'name': obj.sale.outlet.name if obj.sale.outlet else None,
            } if obj.sale.outlet else None,
        }
    
    def get_generated_by_email(self, obj):
        return obj.generated_by.email if obj.generated_by else None
    
    def get_pdf_url(self, obj):
        if obj.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None


class ReceiptTemplateSerializer(serializers.ModelSerializer):
    """Serializer for per-tenant receipt templates"""
    tenant_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ReceiptTemplate
        fields = (
            'id', 'tenant', 'tenant_detail', 'name', 'format', 'content', 'is_default', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'tenant', 'tenant_detail', 'created_at', 'updated_at')

    def get_tenant_detail(self, obj):
        if obj.tenant:
            return {'id': str(obj.tenant.id), 'name': obj.tenant.name}
        return None

    def create(self, validated_data):
        # Tenant will be set in the view (perform_create) for security; keep behavior safe here
        return super().create(validated_data)

    def validate(self, attrs):
        # Basic validation: ensure content is present for non-json/text formats
        if attrs.get('format') in ['text', 'html'] and not attrs.get('content'):
            raise serializers.ValidationError("Template content cannot be empty for text/html formats")
        return attrs

