from rest_framework import serializers  # pyright: ignore[reportMissingImports]
from .models import StockMovement, StockTake, StockTakeItem, LocationStock, Batch
from apps.products.serializers import ProductSerializer
from apps.products.models import Product


class BatchSerializer(serializers.ModelSerializer):
    """Batch serializer with expiry tracking - UNITS ONLY ARCHITECTURE"""
    outlet_name = serializers.CharField(source='outlet.name', read_only=True)
    product_name = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    sellable_quantity = serializers.SerializerMethodField()
    days_until_expiry = serializers.ReadOnlyField()
    
    def get_product_name(self, obj):
        """Get product name from batch"""
        return obj.product.name if obj.product else "Unknown"
    
    def get_is_expired(self, obj):
        """Check if batch is expired"""
        return obj.is_expired()
    
    def get_sellable_quantity(self, obj):
        """Get sellable quantity (0 if expired)"""
        return obj.sellable_quantity()
    
    class Meta:
        model = Batch
        fields = ('id', 'tenant', 'product', 'product_id', 'outlet', 'outlet_name', 
                  'batch_number', 'expiry_date', 'quantity', 'sellable_quantity', 
                  'cost_price', 'product_name', 'is_expired', 'days_until_expiry',
                  'created_at', 'updated_at')
        read_only_fields = ('id', 'tenant', 'created_at', 'updated_at', 'product_name', 
                            'outlet_name', 'is_expired', 'sellable_quantity', 'days_until_expiry')


class StockMovementSerializer(serializers.ModelSerializer):
    """Stock movement serializer - UNITS ONLY ARCHITECTURE (no variations)"""
    batch = BatchSerializer(read_only=True)
    batch_id = serializers.PrimaryKeyRelatedField(write_only=True, required=False, allow_null=True, source='batch', queryset=Batch.objects.all())
    product = ProductSerializer(read_only=True)
    product_name = serializers.SerializerMethodField()
    product_id = serializers.PrimaryKeyRelatedField(write_only=True, required=False, allow_null=True, source='product', queryset=Product.objects.all())
    user_name = serializers.SerializerMethodField()
    outlet_name = serializers.SerializerMethodField()
    
    def get_product_name(self, obj):
        """Get product name"""
        if obj.product:
            return obj.product.name
        return "Unknown"
    
    def get_user_name(self, obj):
        """Get user name safely, handling null users"""
        if obj.user:
            return obj.user.name if hasattr(obj.user, 'name') else (obj.user.email if hasattr(obj.user, 'email') else "System")
        return "System"
    
    def get_outlet_name(self, obj):
        """Get outlet name safely"""
        if obj.outlet:
            return obj.outlet.name if hasattr(obj.outlet, 'name') else str(obj.outlet.id)
        return "N/A"
    
    def validate(self, attrs):
        instance = getattr(self, 'instance', None)

        product = attrs.get('product') or (instance.product if instance else None)
        
        # UNITS ONLY ARCHITECTURE: No variation support
        if not product:
            raise serializers.ValidationError("product is required")

        return attrs

    
    class Meta:
        model = StockMovement
        fields = ('id', 'tenant', 'batch', 'batch_id', 'product', 'product_id', 'product_name', 
                  'outlet', 'outlet_name', 'user', 'user_name', 
                  'movement_type', 'quantity', 'reason', 'reference_id', 'created_at')
        read_only_fields = ('id', 'created_at', 'product_name', 'user_name', 'outlet_name', 'batch')


class StockTakeItemSerializer(serializers.ModelSerializer):
    """Stock take item serializer - UNITS ONLY ARCHITECTURE (no variations)"""
    product = ProductSerializer(read_only=True)
    product_name = serializers.SerializerMethodField()
    product_id = serializers.PrimaryKeyRelatedField(write_only=True, required=False, allow_null=True, source='product', queryset=Product.objects.all())
    
    def get_product_name(self, obj):
        """Get product name"""
        if obj.product:
            return obj.product.name
        return "Unknown"
    
    def validate(self, attrs):
        """Ensure product is set"""
        instance = getattr(self, 'instance', None)
        product = attrs.get('product') or (instance.product if instance else None)

        if not product:
            raise serializers.ValidationError("product is required")

        return attrs
    
    class Meta:
        model = StockTakeItem
        fields = ('id', 'stock_take', 'product', 'product_id', 'product_name', 
                  'expected_quantity', 'counted_quantity',
                  'difference', 'notes', 'created_at', 'updated_at')
        read_only_fields = ('id', 'difference', 'product_name', 'created_at', 'updated_at')


class LocationStockSerializer(serializers.ModelSerializer):
    """Location stock serializer - UNITS ONLY ARCHITECTURE (no variations)"""
    outlet_name = serializers.CharField(source='outlet.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(write_only=True, source='product', queryset=Product.objects.all(), required=False)
    
    class Meta:
        model = LocationStock
        fields = ('id', 'tenant', 'product', 'product_id', 'outlet', 'outlet_name', 
                  'quantity', 'product_name', 'updated_at')
        read_only_fields = ('id', 'tenant', 'updated_at', 'product_name', 'outlet_name')


class StockTakeSerializer(serializers.ModelSerializer):
    """Stock take serializer"""
    items = StockTakeItemSerializer(many=True, read_only=True)
    user_name = serializers.SerializerMethodField()

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.name if hasattr(obj.user, 'name') else (obj.user.email if hasattr(obj.user, 'email') else str(obj.user))
        return "System"
    
    class Meta:
        model = StockTake
        fields = ('id', 'tenant', 'outlet', 'user', 'user_name', 'operating_date', 'status',
              'description', 'items', 'created_at', 'completed_at')
        read_only_fields = ('id', 'tenant', 'user', 'status', 'created_at', 'completed_at')
    
    def validate_outlet(self, value):
        """Validate that outlet belongs to the tenant"""
        request = self.context.get('request')
        if request:
            tenant = getattr(request, 'tenant', None) or request.user.tenant
            if tenant and value.tenant != tenant:
                from rest_framework.exceptions import ValidationError  # pyright: ignore[reportMissingImports]
                raise ValidationError("Outlet does not belong to your tenant")
        return value

