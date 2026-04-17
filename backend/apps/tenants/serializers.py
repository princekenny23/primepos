from rest_framework import serializers
from decimal import Decimal
from django.db.utils import ProgrammingError, OperationalError
from .models import Tenant, TenantPermissions
from apps.outlets.serializers import OutletSerializer


class TenantSerializer(serializers.ModelSerializer):
    """Tenant serializer"""
    outlets = OutletSerializer(many=True, read_only=True)
    # Users will be serialized separately to avoid circular import
    users = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    total_manual_payments = serializers.SerializerMethodField()
    
    class Meta:
        model = Tenant
        fields = ('id', 'name', 'type', 'pos_type', 'currency', 'currency_symbol', 'phone', 'email', 
                  'subdomain', 'domain',
                  'address', 'logo', 'settings', 'has_distribution', 'is_active', 'created_at', 'updated_at', 
                  'outlets', 'users', 'permissions', 'total_manual_payments')
        read_only_fields = ('id', 'created_at', 'updated_at')
    
    def validate_name(self, value):
        """Validate name field"""
        if not value or not value.strip():
            raise serializers.ValidationError("Name is required and cannot be empty.")
        return value.strip()
    
    def validate_type(self, value):
        """Validate type field"""
        valid_types = [choice[0] for choice in Tenant.BUSINESS_TYPES]
        if value not in valid_types:
            raise serializers.ValidationError(
                f"Type must be one of: {', '.join(valid_types)}"
            )
        return value
    
    def validate_pos_type(self, value):
        """Validate pos_type field"""
        valid_pos_types = [choice[0] for choice in Tenant.POS_TYPES]
        if value not in valid_pos_types:
            raise serializers.ValidationError(
                f"POS type must be one of: {', '.join(valid_pos_types)}"
            )
        return value
    
    def validate_settings(self, value):
        """Validate settings field"""
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Settings must be a valid JSON object.")
        
        # Validate language if provided
        language = value.get('language')
        if language and language not in ['en', 'ny']:
            raise serializers.ValidationError(
                "Language must be 'en' (English) or 'ny' (Chichewa)."
            )
        
        return value
    
    def get_users(self, obj):
        """Get users for this tenant with their role and permission information"""
        # Use a simplified serializer to avoid circular dependency
        users = obj.users.select_related('tenant').prefetch_related('staff_profiles__role').all()
        result = []
        
        for user in users:
            staff_profile = user.staff_profiles.filter(tenant_id=obj.id).first()
            outlet_ids = []
            if staff_profile:
                outlet_ids = [
                    str(outlet_id)
                    for outlet_id in staff_profile.outlet_roles.values_list('outlet_id', flat=True)
                    if outlet_id is not None
                ]

            user_data = {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'name': user.name or '',
                'phone': user.phone or '',
                'role': user.role,
                'effective_role': user.effective_role,
                'is_saas_admin': user.is_saas_admin,
                'is_active': user.is_active,
                'date_joined': user.date_joined.isoformat() if user.date_joined else None,
                'permissions': user.get_permissions(),
                'outlet_ids': outlet_ids,
            }
            
            # Add staff role information if available
            staff_role = user.staff_role
            if staff_role:
                user_data['staff_role'] = {
                    'id': staff_role.id,
                    'name': staff_role.name,
                    'description': staff_role.description,
                }
            else:
                user_data['staff_role'] = None
            
            result.append(user_data)
        
        return result

    def get_permissions(self, obj):
        """Get tenant app/feature permissions"""
        permissions_obj = getattr(obj, 'permissions', None)
        if not permissions_obj:
            permissions_obj, _ = TenantPermissions.objects.get_or_create(tenant=obj)
        return TenantPermissionsSerializer(permissions_obj).data

    def get_total_manual_payments(self, obj):
        try:
            total = sum((payment.amount for payment in obj.payment_records.all()), Decimal('0.00'))
            return float(total)
        except (ProgrammingError, OperationalError):
            # Keep auth/session responses stable during rolling deploys before migrations are applied.
            return 0.0


class TenantPermissionsSerializer(serializers.ModelSerializer):
    """Serializer for tenant permissions"""
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    
    class Meta:
        model = TenantPermissions
        fields = '__all__'
        read_only_fields = ('id', 'tenant', 'tenant_name', 'created_at', 'updated_at')
    
    def validate(self, data):
        """Validate that parent app is enabled if any features are enabled"""
        # Sales features depend on allow_sales
        if data.get('allow_sales_create') or data.get('allow_sales_refund') or data.get('allow_sales_reports'):
            if not data.get('allow_sales', getattr(self.instance, 'allow_sales', True)):
                raise serializers.ValidationError(
                    "Cannot enable sales features when Sales app is disabled"
                )
        
        # POS features depend on allow_pos
        if any([data.get('allow_pos_restaurant'), data.get('allow_pos_bar'), 
                data.get('allow_pos_retail'), data.get('allow_pos_discounts')]):
            if not data.get('allow_pos', getattr(self.instance, 'allow_pos', True)):
                raise serializers.ValidationError(
                    "Cannot enable POS features when POS app is disabled"
                )
        
        # Inventory features depend on allow_inventory
        if any([data.get('allow_inventory_products'), data.get('allow_inventory_stock_take'),
                data.get('allow_inventory_transfers'), data.get('allow_inventory_adjustments'),
                data.get('allow_inventory_suppliers')]):
            if not data.get('allow_inventory', getattr(self.instance, 'allow_inventory', True)):
                raise serializers.ValidationError(
                    "Cannot enable inventory features when Inventory app is disabled"
                )
        
        # Office features depend on allow_office
        if any([
            data.get('allow_office_accounting'),
            data.get('allow_office_hr'),
            data.get('allow_office_users'),
            data.get('allow_office_staff'),
            data.get('allow_office_shift_management'),
            data.get('allow_office_reports'),
            data.get('allow_office_analytics')
        ]):
            if not data.get('allow_office', getattr(self.instance, 'allow_office', True)):
                raise serializers.ValidationError(
                    "Cannot enable office features when Office app is disabled"
                )
        
        # Settings features depend on allow_settings
        if any([data.get('allow_settings_users'), data.get('allow_settings_outlets'),
                data.get('allow_settings_integrations'), data.get('allow_settings_advanced')]):
            if not data.get('allow_settings', getattr(self.instance, 'allow_settings', True)):
                raise serializers.ValidationError(
                    "Cannot enable settings features when Settings app is disabled"
                )

        # Storefront features depend on allow_storefront
        if any([
            data.get('allow_storefront_sites'),
            data.get('allow_storefront_orders'),
            data.get('allow_storefront_reports'),
            data.get('allow_storefront_settings')
        ]):
            if not data.get('allow_storefront', getattr(self.instance, 'allow_storefront', True)):
                raise serializers.ValidationError(
                    "Cannot enable storefront features when Storefront app is disabled"
                )
        
        return data
