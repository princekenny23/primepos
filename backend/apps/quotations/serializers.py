from rest_framework import serializers
from .models import Quotation, QuotationItem
from apps.customers.serializers import CustomerSerializer


class QuotationItemSerializer(serializers.ModelSerializer):
    """Serializer for QuotationItem"""
    product_id = serializers.IntegerField(source='product.id', read_only=True, allow_null=True)
    
    class Meta:
        model = QuotationItem
        fields = ['id', 'product', 'product_id', 'product_name', 'quantity', 'price', 'total']
        read_only_fields = ['id', 'total']

    def validate(self, data):
        """Validate item data"""
        if data['quantity'] < 1:
            raise serializers.ValidationError({"quantity": "Quantity must be at least 1"})
        if data['price'] <= 0:
            raise serializers.ValidationError({"price": "Price must be greater than 0"})
        return data


class QuotationSerializer(serializers.ModelSerializer):
    """Serializer for Quotation"""
    items = QuotationItemSerializer(many=True, read_only=False)
    customer = CustomerSerializer(read_only=True)
    customer_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    outlet = serializers.IntegerField(write_only=True, required=True)
    outlet_name = serializers.CharField(source='outlet.name', read_only=True)
    items_count = serializers.IntegerField(source='items.count', read_only=True)
    
    class Meta:
        model = Quotation
        fields = [
            'id', 'quotation_number', 'tenant', 'outlet', 'outlet_name', 'user',
            'customer', 'customer_id', 'customer_name', 'status', 'items',
            'subtotal', 'discount', 'tax', 'total', 'valid_until', 'notes',
            'created_at', 'updated_at', 'items_count'
        ]
        read_only_fields = ['id', 'quotation_number', 'tenant', 'user', 'created_at', 'updated_at']

    def validate_outlet(self, value):
        """Validate outlet exists for the user's tenant"""
        from apps.outlets.models import Outlet
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            tenant = request.user.tenant
            try:
                outlet = Outlet.objects.get(id=value, tenant=tenant)
                return value
            except Outlet.DoesNotExist:
                raise serializers.ValidationError(f'Outlet with id {value} does not exist for your tenant.')
        return value

    def create(self, validated_data):
        """Create quotation with items"""
        items_data = validated_data.pop('items', [])
        customer_id = validated_data.pop('customer_id', None)
        
        # Set tenant and user from request
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['tenant'] = request.user.tenant
            validated_data['user'] = request.user
        
        # Handle outlet - convert to object if needed
        outlet_id = validated_data.pop('outlet')
        from apps.outlets.models import Outlet
        try:
            validated_data['outlet'] = Outlet.objects.get(id=outlet_id, tenant=validated_data['tenant'])
        except Outlet.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'outlet': f'Outlet with id {outlet_id} does not exist for your tenant.'})
        
        # Set customer if provided
        if customer_id:
            from apps.customers.models import Customer
            try:
                validated_data['customer'] = Customer.objects.get(id=customer_id, tenant=validated_data['tenant'])
            except Customer.DoesNotExist:
                pass
        
        # Create quotation
        quotation = Quotation.objects.create(**validated_data)
        
        # Create items
        for item_data in items_data:
            product = item_data.pop('product', None)
            # Handle product ID if provided as integer
            if isinstance(product, int):
                from apps.products.models import Product
                try:
                    product = Product.objects.get(id=product, tenant=validated_data['tenant'])
                except Product.DoesNotExist:
                    product = None
            QuotationItem.objects.create(quotation=quotation, product=product, **item_data)
        
        return quotation

    def update(self, instance, validated_data):
        """Update quotation with items"""
        items_data = validated_data.pop('items', None)
        customer_id = validated_data.pop('customer_id', None)
        
        # Update customer if provided
        if customer_id is not None:
            if customer_id:
                from apps.customers.models import Customer
                try:
                    instance.customer = Customer.objects.get(id=customer_id, tenant=instance.tenant)
                except Customer.DoesNotExist:
                    pass
            else:
                instance.customer = None
        
        # Update quotation fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update items if provided
        if items_data is not None:
            # Delete existing items
            instance.items.all().delete()
            # Create new items
            for item_data in items_data:
                product = item_data.pop('product', None)
                QuotationItem.objects.create(quotation=instance, product=product, **item_data)
        
        return instance

