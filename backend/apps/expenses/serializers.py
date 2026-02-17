from rest_framework import serializers
from .models import Expense
from apps.outlets.serializers import OutletSerializer
from apps.accounts.serializers import UserSerializer


class ExpenseSerializer(serializers.ModelSerializer):
    """Expense serializer"""
    outlet = OutletSerializer(read_only=True)
    outlet_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    user = UserSerializer(read_only=True)
    shift = serializers.PrimaryKeyRelatedField(read_only=True)
    shift_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    outlet_name = serializers.CharField(source='outlet.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    rejected_by_name = serializers.CharField(source='rejected_by.get_full_name', read_only=True)
    
    class Meta:
        model = Expense
        fields = (
            'id', 'tenant', 'outlet', 'outlet_id', 'outlet_name', 'user',
            'shift', 'shift_id',
            'expense_number', 'title', 'category', 'vendor', 'description',
            'amount', 'payment_method', 'payment_reference', 'expense_date',
            'status', 'approved_by', 'approved_by_name', 'approved_at', 
            'approval_notes', 'rejected_by', 'rejected_by_name', 'rejected_at',
            'created_at', 'updated_at'
        )
        read_only_fields = (
            'id', 'tenant', 'user', 'expense_number', 
            'approved_by', 'approved_at', 'rejected_by', 'rejected_at',
            'created_at', 'updated_at'
        )
    
    def validate_outlet_id(self, value):
        """Validate that outlet belongs to tenant"""
        # Handle None, empty string, or 0
        if value is None or value == '' or value == 0:
            return None
        
        request = self.context.get('request')
        if request:
            tenant = getattr(request, 'tenant', None) or request.user.tenant
            if tenant:
                from apps.outlets.models import Outlet
                try:
                    # Convert to int if it's a string
                    outlet_id = int(value) if isinstance(value, str) else value
                    if outlet_id:
                        outlet = Outlet.objects.get(id=outlet_id, tenant=tenant)
                        return outlet_id
                except Outlet.DoesNotExist:
                    raise serializers.ValidationError("Outlet does not belong to your tenant")
                except (ValueError, TypeError):
                    raise serializers.ValidationError("Invalid outlet ID format")
        return None
    
    def create(self, validated_data):
        """Override create to handle outlet_id"""
        # Note: tenant and user are set in perform_create() in views.py
        # Handle outlet_id
        outlet_id = validated_data.pop('outlet_id', None)
        if outlet_id:
            from apps.outlets.models import Outlet
            validated_data['outlet'] = Outlet.objects.get(id=outlet_id)

        shift_id = validated_data.pop('shift_id', None)
        if shift_id:
            from apps.shifts.models import Shift
            validated_data['shift'] = Shift.objects.get(id=shift_id)
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Override update to handle outlet_id"""
        outlet_id = validated_data.pop('outlet_id', None)
        shift_id = validated_data.pop('shift_id', None)
        if outlet_id is not None:
            if outlet_id:
                from apps.outlets.models import Outlet
                instance.outlet = Outlet.objects.get(id=outlet_id)
            else:
                instance.outlet = None
        if shift_id is not None:
            if shift_id:
                from apps.shifts.models import Shift
                instance.shift = Shift.objects.get(id=shift_id)
            else:
                instance.shift = None
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

    def validate(self, attrs):
        request = self.context.get('request')
        is_create = self.instance is None
        if not is_create:
            return attrs

        shift_id = attrs.get('shift_id')
        if not shift_id:
            raise serializers.ValidationError({"shift_id": "Shift is required for expense accuracy."})

        from apps.shifts.models import Shift
        try:
            shift = Shift.objects.select_related('outlet', 'outlet__tenant').get(id=shift_id)
        except Shift.DoesNotExist:
            raise serializers.ValidationError({"shift_id": "Shift not found."})

        tenant = getattr(request, 'tenant', None) or getattr(request.user, 'tenant', None)
        if tenant and shift.outlet.tenant_id != tenant.id:
            raise serializers.ValidationError({"shift_id": "Shift does not belong to your tenant."})

        outlet_id = attrs.get('outlet_id')
        if outlet_id and str(shift.outlet_id) != str(outlet_id):
            raise serializers.ValidationError({"outlet_id": "Outlet must match the selected shift."})

        expense_date = attrs.get('expense_date')
        if expense_date and shift.operating_date != expense_date:
            raise serializers.ValidationError({"expense_date": "Expense date must match the shift operating date."})

        attrs['outlet_id'] = str(shift.outlet_id)
        return attrs

