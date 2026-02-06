from rest_framework import serializers
from .models import Customer, LoyaltyTransaction, CreditPayment


class LoyaltyTransactionSerializer(serializers.ModelSerializer):
    """Loyalty transaction serializer"""
    
    class Meta:
        model = LoyaltyTransaction
        fields = ('id', 'customer', 'transaction_type', 'points', 'reason', 'created_at')
        read_only_fields = ('id', 'created_at')


class CreditPaymentSerializer(serializers.ModelSerializer):
    """Credit payment serializer"""
    sale_receipt_number = serializers.CharField(source='sale.receipt_number', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    customer = serializers.PrimaryKeyRelatedField(required=False, allow_null=True, queryset=Customer.objects.all())
    
    class Meta:
        model = CreditPayment
        fields = (
            'id', 'tenant', 'customer', 'sale', 'sale_receipt_number',
            'amount', 'payment_method', 'payment_date', 'reference_number',
            'notes', 'user', 'user_name', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'tenant', 'payment_date', 'created_at', 'updated_at')

    def validate(self, attrs):
        sale = attrs.get('sale')
        customer = attrs.get('customer')

        if not sale:
            raise serializers.ValidationError({'sale': 'This field is required.'})

        if not customer:
            if sale.customer:
                attrs['customer'] = sale.customer
            else:
                raise serializers.ValidationError({'customer': 'Customer is required for credit payments.'})

        return attrs


class CustomerSerializer(serializers.ModelSerializer):
    """Customer serializer"""
    outlet_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    loyalty_transactions = LoyaltyTransactionSerializer(many=True, read_only=True)
    outstanding_balance = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    available_credit = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = Customer
        fields = (
            'id', 'tenant', 'outlet', 'outlet_id', 'name', 'email', 'phone', 'address',
            'loyalty_points', 'total_spent', 'last_visit', 'is_active',
            'credit_enabled', 'credit_limit', 'payment_terms_days', 'credit_status', 'credit_notes',
            'outstanding_balance', 'available_credit',
            'loyalty_transactions', 'created_at', 'updated_at'
        )
        read_only_fields = (
            'id', 'tenant', 'outlet', 'loyalty_points', 'total_spent', 'last_visit',
            'outstanding_balance', 'available_credit',
            'created_at', 'updated_at'
        )
    
    def validate_outlet_id(self, value):
        """Validate that outlet belongs to tenant"""
        if value is None or value == "":
            return None
        
        request = self.context.get('request')
        if request:
            tenant = getattr(request, 'tenant', None) or request.user.tenant
            if tenant:
                from apps.outlets.models import Outlet
                try:
                    outlet = Outlet.objects.get(id=value, tenant=tenant)
                    return value
                except Outlet.DoesNotExist:
                    raise serializers.ValidationError("Outlet does not belong to your tenant")
        return value
    
    def create(self, validated_data):
        """Create customer with outlet assignment"""
        outlet_id = validated_data.pop('outlet_id', None)
        if outlet_id:
            from apps.outlets.models import Outlet
            validated_data['outlet'] = Outlet.objects.get(id=outlet_id, tenant=validated_data['tenant'])
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Update customer with outlet assignment"""
        outlet_id = validated_data.pop('outlet_id', None)
        if outlet_id is not None:
            from apps.outlets.models import Outlet
            if outlet_id == "" or outlet_id is None:
                instance.outlet = None
            else:
                instance.outlet = Outlet.objects.get(id=outlet_id, tenant=instance.tenant)
        return super().update(instance, validated_data)

