"""
Bar Management Serializers - Tabs, Tables, and related operations
"""
from rest_framework import serializers
from django.utils import timezone
from django.db import transaction
from decimal import Decimal

from .models import BarTable, Tab, TabItem, TabTransfer, TabMerge
from apps.products.models import Product, ProductUnit
from apps.customers.models import Customer
from apps.accounts.models import User
from apps.sales.models import Sale, SaleItem


class BarTableSerializer(serializers.ModelSerializer):
    """Serializer for Bar Tables"""
    current_tab_summary = serializers.SerializerMethodField()
    
    class Meta:
        model = BarTable
        fields = [
            'id', 'outlet', 'number', 'table_type', 'capacity', 'status', 
            'location', 'position_x', 'position_y', 'current_tab',
            'current_tab_summary', 'notes', 'is_active', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'current_tab']
    
    def get_current_tab_summary(self, obj):
        """Get summary of current tab if occupied"""
        if not obj.current_tab:
            return None
        tab = obj.current_tab
        return {
            'id': str(tab.id),
            'tab_number': tab.tab_number,
            'customer_name': tab.display_name,
            'total': float(tab.total),
            'item_count': tab.item_count,
            'opened_at': tab.opened_at.isoformat(),
        }


class TabItemSerializer(serializers.ModelSerializer):
    """Serializer for Tab Items"""
    product_name = serializers.CharField(source='product.name', read_only=True)
    added_by_name = serializers.CharField(source='added_by.get_full_name', read_only=True, allow_null=True)
    voided_by_name = serializers.CharField(source='voided_by.get_full_name', read_only=True, allow_null=True)
    
    class Meta:
        model = TabItem
        fields = [
            'id', 'product', 'product_name',
            'unit', 'quantity', 'price', 'discount', 'total',
            'added_by', 'added_by_name', 'is_voided', 'voided_by', 
            'voided_by_name', 'voided_at', 'void_reason', 
            'notes', 'added_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'total', 'added_by', 'added_at', 'updated_at',
            'is_voided', 'voided_by', 'voided_at'
        ]


class TabItemCreateSerializer(serializers.Serializer):
    """Serializer for adding items to a tab"""
    product_id = serializers.IntegerField()
    unit_id = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, default=1)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    discount = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    
    def validate_product_id(self, value):
        try:
            Product.objects.get(id=value)
        except Product.DoesNotExist:
            raise serializers.ValidationError("Product not found")
        return value


class TabSerializer(serializers.ModelSerializer):
    """Full Tab serializer with items"""
    items = TabItemSerializer(many=True, read_only=True)
    table_number = serializers.CharField(source='table.number', read_only=True, allow_null=True)
    customer_display = serializers.CharField(source='display_name', read_only=True)
    opened_by_name = serializers.CharField(source='opened_by.get_full_name', read_only=True, allow_null=True)
    closed_by_name = serializers.CharField(source='closed_by.get_full_name', read_only=True, allow_null=True)
    item_count = serializers.IntegerField(read_only=True)
    is_over_limit = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Tab
        fields = [
            'id', 'tab_number', 'customer', 'customer_name', 'customer_phone',
            'customer_display', 'table', 'table_number', 'status',
            'opened_by', 'opened_by_name', 'closed_by', 'closed_by_name',
            'opened_at', 'closed_at', 'subtotal', 'discount', 'tax', 'total',
            'credit_limit', 'is_over_limit', 'item_count', 'items',
            'sale', 'merged_into', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'tab_number', 'opened_by', 'closed_by', 'opened_at', 
            'closed_at', 'subtotal', 'total', 'sale', 'merged_into',
            'created_at', 'updated_at'
        ]


class TabListSerializer(serializers.ModelSerializer):
    """Lightweight Tab serializer for lists"""
    table_number = serializers.CharField(source='table.number', read_only=True, allow_null=True)
    customer_display = serializers.CharField(source='display_name', read_only=True)
    opened_by_name = serializers.CharField(source='opened_by.get_full_name', read_only=True, allow_null=True)
    item_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Tab
        fields = [
            'id', 'tab_number', 'customer_name', 'customer_display',
            'table', 'table_number', 'status', 'opened_by_name',
            'opened_at', 'total', 'item_count', 'is_over_limit'
        ]


class OpenTabSerializer(serializers.Serializer):
    """Serializer for opening a new tab"""
    customer_id = serializers.UUIDField(required=False, allow_null=True)
    customer_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    customer_phone = serializers.CharField(required=False, allow_blank=True, max_length=50)
    table_id = serializers.UUIDField(required=False, allow_null=True)
    credit_limit = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    
    def validate_table_id(self, value):
        if value:
            try:
                table = BarTable.objects.get(id=value)
                if table.status == 'occupied' and table.current_tab:
                    raise serializers.ValidationError("Table already has an open tab")
                if table.status == 'out_of_service':
                    raise serializers.ValidationError("Table is out of service")
            except BarTable.DoesNotExist:
                raise serializers.ValidationError("Table not found")
        return value
    
    def validate_customer_id(self, value):
        if value:
            try:
                Customer.objects.get(id=value)
            except Customer.DoesNotExist:
                raise serializers.ValidationError("Customer not found")
        return value


class CloseTabSerializer(serializers.Serializer):
    """Serializer for closing a tab and creating a sale"""
    payment_method = serializers.ChoiceField(choices=['cash', 'card', 'mobile', 'credit'])
    discount = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    discount_type = serializers.ChoiceField(choices=['percentage', 'fixed'], required=False)
    discount_reason = serializers.CharField(required=False, allow_blank=True)
    
    # For cash payments
    cash_received = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    
    # For credit payments
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    
    # Optional tip
    tip = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'))
    
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    
    def validate(self, data):
        payment_method = data.get('payment_method')
        
        if payment_method == 'cash':
            cash_received = data.get('cash_received')
            if cash_received is None:
                raise serializers.ValidationError({
                    'cash_received': 'Cash received is required for cash payments'
                })
        
        if payment_method == 'credit':
            due_date = data.get('due_date')
            if not due_date:
                # Default to 30 days from now
                data['due_date'] = timezone.now() + timezone.timedelta(days=30)
        
        return data


class TransferTabSerializer(serializers.Serializer):
    """Serializer for transferring a tab to a different table"""
    to_table_id = serializers.UUIDField(required=False, allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True, default='')
    
    def validate_to_table_id(self, value):
        if value:
            try:
                table = BarTable.objects.get(id=value)
                if table.status == 'occupied' and table.current_tab:
                    raise serializers.ValidationError("Target table already has an open tab")
                if table.status == 'out_of_service':
                    raise serializers.ValidationError("Target table is out of service")
            except BarTable.DoesNotExist:
                raise serializers.ValidationError("Table not found")
        return value


class MergeTabsSerializer(serializers.Serializer):
    """Serializer for merging multiple tabs into one"""
    source_tab_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        help_text="List of tab IDs to merge into target"
    )
    target_tab_id = serializers.UUIDField(help_text="Tab ID to merge into")
    reason = serializers.CharField(required=False, allow_blank=True, default='')
    
    def validate_target_tab_id(self, value):
        try:
            tab = Tab.objects.get(id=value)
            if tab.status != 'open':
                raise serializers.ValidationError("Target tab must be open")
        except Tab.DoesNotExist:
            raise serializers.ValidationError("Target tab not found")
        return value
    
    def validate_source_tab_ids(self, value):
        for tab_id in value:
            try:
                tab = Tab.objects.get(id=tab_id)
                if tab.status != 'open':
                    raise serializers.ValidationError(f"Tab {tab.tab_number} is not open")
            except Tab.DoesNotExist:
                raise serializers.ValidationError(f"Tab {tab_id} not found")
        return value
    
    def validate(self, data):
        # Ensure target is not in source list
        if data['target_tab_id'] in data['source_tab_ids']:
            raise serializers.ValidationError({
                'source_tab_ids': 'Target tab cannot be in source tabs list'
            })
        return data


class SplitTabSerializer(serializers.Serializer):
    """Serializer for splitting a tab"""
    SPLIT_TYPE_CHOICES = [
        ('equal', 'Split Equally'),
        ('by_items', 'Split by Items'),
    ]
    
    split_type = serializers.ChoiceField(choices=SPLIT_TYPE_CHOICES)
    
    # For equal split
    number_of_splits = serializers.IntegerField(min_value=2, max_value=20, required=False)
    
    # For split by items
    item_groups = serializers.ListField(
        child=serializers.ListField(child=serializers.UUIDField()),
        required=False,
        help_text="List of item ID lists, each list becomes a new tab"
    )
    
    def validate(self, data):
        split_type = data.get('split_type')
        
        if split_type == 'equal':
            if not data.get('number_of_splits'):
                raise serializers.ValidationError({
                    'number_of_splits': 'Required for equal split'
                })
        elif split_type == 'by_items':
            if not data.get('item_groups') or len(data['item_groups']) < 2:
                raise serializers.ValidationError({
                    'item_groups': 'At least 2 item groups required for split by items'
                })
        
        return data


class VoidItemSerializer(serializers.Serializer):
    """Serializer for voiding a tab item"""
    reason = serializers.CharField(required=True, max_length=255)


class TabTransferSerializer(serializers.ModelSerializer):
    """Serializer for Tab Transfer history"""
    from_table_number = serializers.CharField(source='from_table.number', read_only=True, allow_null=True)
    to_table_number = serializers.CharField(source='to_table.number', read_only=True, allow_null=True)
    transferred_by_name = serializers.CharField(source='transferred_by.get_full_name', read_only=True)
    
    class Meta:
        model = TabTransfer
        fields = [
            'id', 'tab', 'from_table', 'from_table_number', 
            'to_table', 'to_table_number', 'transferred_by',
            'transferred_by_name', 'reason', 'transferred_at'
        ]
        read_only_fields = ['id', 'transferred_at']


class TabMergeSerializer(serializers.ModelSerializer):
    """Serializer for Tab Merge history"""
    target_tab_number = serializers.CharField(source='target_tab.tab_number', read_only=True)
    source_tab_number = serializers.CharField(source='source_tab.tab_number', read_only=True)
    merged_by_name = serializers.CharField(source='merged_by.get_full_name', read_only=True)
    
    class Meta:
        model = TabMerge
        fields = [
            'id', 'target_tab', 'target_tab_number', 'source_tab',
            'source_tab_number', 'source_total', 'merged_by',
            'merged_by_name', 'reason', 'merged_at'
        ]
        read_only_fields = ['id', 'merged_at']
