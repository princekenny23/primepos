from rest_framework import serializers
from django.db.models import Sum
from .models import Shift
from apps.outlets.serializers import OutletSerializer, TillSerializer
from apps.accounts.serializers import UserSerializer
from apps.expenses.models import Expense


class ShiftSerializer(serializers.ModelSerializer):
    """Shift serializer"""
    outlet = OutletSerializer(read_only=True)
    till = TillSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    total_sales = serializers.SerializerMethodField()
    total_expense = serializers.SerializerMethodField()
    outlet_id = serializers.IntegerField(write_only=True)
    till_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Shift
        fields = ('id', 'outlet', 'outlet_id', 'till', 'till_id', 'user', 'operating_date',
                  'opening_cash_balance', 'floating_cash', 'closing_cash_balance',
                  'status', 'notes', 'start_time', 'end_time', 'device_id', 'sync_status',
                  'total_sales', 'total_expense')
        read_only_fields = ('id', 'outlet', 'till', 'user', 'status', 'start_time', 'end_time')

    def get_total_sales(self, obj):
        """Sum completed, non-void sales linked to this shift."""
        total = obj.sales.filter(status='completed', is_void=False).aggregate(sum=Sum('total'))['sum']
        return total or 0

    def get_total_expense(self, obj):
        """Sum approved expenses linked to this shift."""
        total = obj.expenses.filter(status='approved').aggregate(sum=Sum('amount'))['sum']
        return total or 0

