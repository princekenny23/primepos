from rest_framework import serializers  # pyright: ignore[reportMissingImports]
from .models import Product, Category, ProductUnit


class CategorySerializer(serializers.ModelSerializer):
    """Category serializer"""
    product_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Category
        fields = ('id', 'tenant', 'name', 'description', 'created_at', 'product_count')
        read_only_fields = ('id', 'tenant', 'created_at')
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Use prefetched count if available to avoid N+1 query
        if hasattr(instance, '_products_count'):
            representation['product_count'] = instance._products_count
        else:
            representation['product_count'] = instance.products.count()
        return representation


class ProductUnitSerializer(serializers.ModelSerializer):
    """Product Unit serializer - UNITS ONLY ARCHITECTURE
    Each product is sold exclusively through units.
    Base unit (conversion_factor=1.0) represents actual inventory in base form.
    """
    stock_in_base_units = serializers.SerializerMethodField()
    is_base_unit = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = ProductUnit
        fields = (
            'id', 'product', 'unit_name', 'conversion_factor', 'retail_price', 
            'wholesale_price', 'is_active', 'is_base_unit', 'low_stock_threshold',
            'sort_order', 'stock_in_base_units', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at', 'is_base_unit')
        extra_kwargs = {
            'conversion_factor': {'min_value': 1.0},
        }
    
    def get_stock_in_base_units(self, obj):
        """Get total stock in base units for this product"""
        try:
            from apps.inventory.stock_helpers import get_available_stock
            
            outlet = self.context.get('outlet')
            if outlet:
                return get_available_stock(obj, outlet)
            
            # Get stock across all outlets
            from apps.outlets.models import Outlet
            outlets = Outlet.objects.filter(tenant=obj.product.tenant)
            total = sum(get_available_stock(obj, outlet_obj) for outlet_obj in outlets)
            return total
        except Exception:
            return 0
    
    def validate_unit_name(self, value):
        """Ensure unit_name is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Unit name cannot be empty")
        return value.strip()
    
    def validate_conversion_factor(self, value):
        """Ensure conversion_factor is at least 1.0"""
        if value < 1.0:
            raise serializers.ValidationError("Conversion factor must be at least 1.0")
        return value


class ProductSerializer(serializers.ModelSerializer):
    """Product serializer - UNITS ONLY ARCHITECTURE
    
    Products have:
    - Base info (name, sku, barcode, category)
    - At least one ProductUnit with conversion_factor=1.0
    - Optional additional units (dozen, carton, etc.)
    - Pricing and stock tracked through units, not variations
    """
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category',
        write_only=True,
        required=False,
        allow_null=True
    )
    is_low_stock = serializers.SerializerMethodField()
    # selling_units for reading
    selling_units = ProductUnitSerializer(many=True, read_only=True)
    # selling_units_data for writing (accepts raw data)
    selling_units_data = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    
    # Legacy field for backward compatibility
    price = serializers.SerializerMethodField()
    cost_price = serializers.SerializerMethodField()
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Filter category queryset by tenant
        request = self.context.get('request')
        if request:
            tenant = getattr(request, 'tenant', None) or (request.user.tenant if hasattr(request, 'user') else None)
            if tenant and 'category_id' in self.fields:
                self.fields['category_id'].queryset = Category.objects.filter(tenant=tenant)
        
        # Make tenant and outlet read-only (set automatically from request context)
        if 'tenant' in self.fields:
            self.fields['tenant'].read_only = True
        if 'outlet' in self.fields:
            self.fields['outlet'].read_only = True
    
    class Meta:
        model = Product
        fields = (
            'id', 'tenant', 'outlet', 'category', 'category_id', 'name', 'description', 
            'sku', 'barcode', 'retail_price', 'price', 'cost', 'cost_price', 
            'wholesale_price', 'wholesale_enabled', 'minimum_wholesale_quantity', 
            'stock', 'low_stock_threshold', 'unit', 'image', 'is_active', 
            'is_low_stock', 'selling_units', 'selling_units_data',
            'track_expiration', 'manufacturing_date', 'expiry_date',
            'preparation_time', 'volume_ml', 'alcohol_percentage',
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'tenant', 'outlet', 'created_at', 'updated_at', 'price', 'cost_price', 'selling_units')
        extra_kwargs = {
            'sku': {'required': False, 'allow_blank': True},
            'barcode': {'required': False, 'allow_blank': True},
            'retail_price': {'required': False},  # Can come from units instead
            'wholesale_price': {'required': False, 'allow_null': True},
            'stock': {'required': False, 'allow_null': True, 'min_value': 0, 'default': 0},
        }
    
    def get_is_low_stock(self, obj):
        """Check if product has low stock"""
        return obj.is_low_stock
    
    def get_price(self, obj):
        """Get price from base unit (backward compatibility)"""
        return obj.get_price('retail')
    
    def get_cost_price(self, obj):
        """Get cost from product model (backward compatibility)"""
        return obj.cost
    
    def validate(self, data):
        """Validate that product configuration is valid"""
        # Get selling_units_data if provided
        selling_units_data = data.get('selling_units_data')
        
        if selling_units_data:
            # Validate: at least one unit provided
            if not selling_units_data or len(selling_units_data) == 0:
                raise serializers.ValidationError("Product must have at least one unit")
            
            # Validate: at least one base unit (conversion_factor = 1.0)
            base_units = [u for u in selling_units_data if u.get('conversion_factor') == 1.0]
            if not base_units:
                raise serializers.ValidationError("Product must have exactly one base unit (conversion_factor = 1.0)")
            
            # Validate: unique unit names
            unit_names = [u.get('unit_name') for u in selling_units_data]
            if len(unit_names) != len(set(unit_names)):
                raise serializers.ValidationError("Unit names must be unique within product")
            
            # Validate: all units have prices
            for unit in selling_units_data:
                if not unit.get('retail_price') or unit.get('retail_price') <= 0:
                    raise serializers.ValidationError(f"Unit '{unit.get('unit_name')}' must have retail_price > 0")
        
        return data
    
    def create(self, validated_data):
        """Create product with units"""
        selling_units_data = validated_data.pop('selling_units_data', [])
        
        # Create product
        product = Product.objects.create(**validated_data)
        
        # Create units if provided
        if selling_units_data:
            for unit_data in selling_units_data:
                ProductUnit.objects.create(product=product, **unit_data)
        
        return product
    
    def update(self, instance, validated_data):
        """Update product (note: units are updated separately)"""
        selling_units_data = validated_data.pop('selling_units_data', None)
        
        # Update product fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Note: Unit updates should be done through ProductUnitSerializer
        # This prevents accidental unit loss in product update
        
        return instance
    
    def validate_sku(self, value):
        """Ensure SKU is unique per product (if provided)"""
        if not value or (isinstance(value, str) and value.strip() == ""):
            return None
        
        # Check if SKU exists for another product in same tenant/outlet
        request = self.context.get('request')
        if not request:
            return value
        
        tenant = getattr(request, 'tenant', None) or (request.user.tenant if hasattr(request, 'user') else None)
        outlet = getattr(request, 'outlet', None) or (self.instance.outlet if self.instance else None)
        
        existing = Product.objects.filter(sku=value, tenant=tenant)
        if outlet:
            existing = existing.filter(outlet=outlet)
        
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        
        if existing.exists():
            raise serializers.ValidationError("SKU already exists for another product")
        
        return value
    
    def validate_barcode(self, value):
        """Ensure barcode is unique per tenant/outlet"""
        if not value or (isinstance(value, str) and value.strip() == ""):
            return ""
        
        request = self.context.get('request')
        if not request:
            return value
        
        tenant = getattr(request, 'tenant', None) or (request.user.tenant if hasattr(request, 'user') else None)
        outlet = getattr(request, 'outlet', None)
        
        existing = Product.objects.filter(barcode__iexact=str(value).strip(), tenant=tenant)
        if outlet:
            existing = existing.filter(outlet=outlet)
        
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        
        if existing.exists():
            raise serializers.ValidationError("Barcode already exists for another product")
        
        return str(value).strip()

    def create(self, validated_data):
        """Create product with units"""
        selling_units_data = validated_data.pop('selling_units_data', [])
        
        # Create product
        product = Product.objects.create(**validated_data)
        
        # Create units if provided
        if selling_units_data:
            for unit_data in selling_units_data:
                ProductUnit.objects.create(product=product, **unit_data)
        
        return product
    
    def update(self, instance, validated_data):
        """Update product (units are updated separately via ProductUnitSerializer)"""
        selling_units_data = validated_data.pop('selling_units_data', None)
        
        # Update product fields - DRF handles foreign key conversion automatically
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Note: Unit updates should be done through ProductUnitSerializer
        # This prevents accidental unit loss in product update
        
        return instance
