from rest_framework import serializers
import logging
from .models import Outlet, Till
from .models import Printer

logger = logging.getLogger(__name__)


class TillSerializer(serializers.ModelSerializer):
    """Till serializer"""
    # Use PrimaryKeyRelatedField for outlet to avoid circular import
    # We'll add outlet details via SerializerMethodField
    outlet = serializers.SerializerMethodField(read_only=True)
    outlet_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Till
        fields = ('id', 'name', 'outlet', 'outlet_id', 'is_active', 'is_in_use', 'created_at')
        read_only_fields = ('id', 'outlet', 'is_in_use', 'created_at')
    
    def get_outlet(self, obj):
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
    
    def validate_outlet_id(self, value):
        """Validate that outlet belongs to tenant"""
        if value is None:
            raise serializers.ValidationError("outlet_id is required")
        
        request = self.context.get('request')
        if request:
            tenant = getattr(request, 'tenant', None) or request.user.tenant
            if tenant:
                from .models import Outlet
                try:
                    outlet = Outlet.objects.get(id=value, tenant=tenant)
                    return value
                except Outlet.DoesNotExist:
                    raise serializers.ValidationError("Outlet does not belong to your tenant")
        return value


class OutletSerializer(serializers.ModelSerializer):
    """Outlet serializer"""
    tills = TillSerializer(many=True, read_only=True)
    tenant = serializers.SerializerMethodField(read_only=True)  # Make tenant read-only for security
    business_type_display = serializers.CharField(source='get_business_type_display', read_only=True)
    
    class Meta:
        model = Outlet
        fields = (
            'id', 'tenant', 'name', 'address', 'phone', 'email',
            'business_type', 'business_type_display',
            'settings', 'is_active', 'created_at', 'updated_at', 'tills'
        )
        read_only_fields = ('id', 'tenant', 'created_at', 'updated_at', 'business_type_display')
    
    def get_tenant(self, obj):
        """Return tenant ID as string for frontend compatibility"""
        if obj.tenant:
            return str(obj.tenant.id)
        return None
    
    def validate(self, attrs):
        """
        Validate that tenant from request matches authenticated user's tenant.
        
        During onboarding, user.tenant might not be set in JWT token yet,
        or the tenant might have just been created. We allow tenant ID in request data
        and defer final validation to perform_create which has better onboarding handling.
        """
        request = self.context.get('request')
        if request and not self.instance:  # Only validate on create, not update
            # CRITICAL: Refresh user from DB to ensure tenant is loaded (important during onboarding)
            user = request.user
            if not hasattr(user, '_tenant_loaded'):
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    user = User.objects.select_related('tenant').get(pk=user.pk)
                    request.user = user
                    user._tenant_loaded = True
                except User.DoesNotExist:
                    pass
            
            # Get tenant from request context (set by middleware) or refreshed user
            tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
            
            # If tenant is provided in data, do basic validation
            tenant_id = self.initial_data.get('tenant')
            if tenant_id:
                try:
                    tenant_id = int(tenant_id)
                    logger.info(f"Outlet serializer validation: user.tenant={tenant.id if tenant else None}, requested_tenant_id={tenant_id}")
                    
                    # Basic validation: if user has a tenant and it matches, great
                    # If user has a tenant but it doesn't match, check if it's onboarding
                    # If user doesn't have a tenant yet (onboarding), allow it - perform_create will handle it
                    if tenant:
                        if tenant.id != tenant_id:
                            # Check if tenant was just created (onboarding scenario)
                            # Allow if tenant was created within last 5 minutes
                            from apps.tenants.models import Tenant
                            try:
                                requested_tenant = Tenant.objects.get(pk=tenant_id)
                                from django.utils import timezone
                                from datetime import timedelta
                                time_threshold = timezone.now() - timedelta(minutes=5)
                                
                                logger.info(f"Tenant mismatch: user.tenant.id={tenant.id}, requested_tenant.id={tenant_id}, created_at={requested_tenant.created_at}, threshold={time_threshold}")
                                
                                # If tenant was created recently, allow it (onboarding)
                                if requested_tenant.created_at >= time_threshold:
                                    # Tenant was just created, allow it - perform_create will validate
                                    logger.info(f"Allowing recently created tenant {tenant_id} for onboarding")
                                    pass
                                else:
                                    # Tenant is old and doesn't match user's tenant - reject
                                    logger.warning(f"Rejecting tenant {tenant_id} - doesn't match user tenant {tenant.id} and not recently created")
                                    raise serializers.ValidationError({
                                        'tenant': 'You can only create outlets for your own tenant.'
                                    })
                            except Tenant.DoesNotExist:
                                logger.error(f"Tenant {tenant_id} not found")
                                raise serializers.ValidationError({
                                    'tenant': 'Invalid tenant ID. Tenant not found.'
                                })
                        else:
                            logger.info(f"Tenant IDs match: {tenant.id}")
                    else:
                        # If no tenant yet (onboarding), allow it - will be validated in perform_create
                        logger.info(f"No tenant for user yet, allowing tenant_id {tenant_id} - will be validated in perform_create")
                    # This handles the case where user just created tenant but token not refreshed yet
                    # perform_create will refresh user from DB and validate tenant ID matches
                except (ValueError, TypeError) as e:
                    logger.error(f"Invalid tenant ID format: {tenant_id}, error: {e}")
                    raise serializers.ValidationError({
                        'tenant': 'Invalid tenant ID format.'
                    })
        
        return attrs


class PrinterSerializer(serializers.ModelSerializer):
    """Serializer for Printer model. Validates outlet belongs to tenant and enforces uniqueness."""
    outlet_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Printer
        fields = ('id', 'outlet_id', 'name', 'identifier', 'driver', 'is_default', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_outlet_id(self, value):
        request = self.context.get('request')
        if not request:
            return value
        tenant = getattr(request, 'tenant', None) or getattr(request.user, 'tenant', None)
        from .models import Outlet
        try:
            outlet = Outlet.objects.get(id=value, tenant=tenant)
            return value
        except Outlet.DoesNotExist:
            raise serializers.ValidationError('Outlet does not belong to your tenant')

    def validate(self, attrs):
        # Prevent duplicate identifiers per outlet (though DB unique_together also enforces it)
        outlet_id = attrs.get('outlet_id')
        identifier = attrs.get('identifier')
        if outlet_id and identifier:
            from .models import Printer
            qs = Printer.objects.filter(outlet_id=outlet_id, identifier=identifier)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'identifier': 'This printer is already registered for the outlet.'})
        return attrs

    def create(self, validated_data):
        from .models import Outlet
        outlet = Outlet.objects.get(id=validated_data.pop('outlet_id'))
        printer = Printer.objects.create(outlet=outlet, **validated_data)
        return printer

    def update(self, instance, validated_data):
        # allow changing fields but ensure outlet isn't changed here
        validated_data.pop('outlet_id', None)
        return super().update(instance, validated_data)

