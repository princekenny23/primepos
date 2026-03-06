from rest_framework import serializers
from .models import Role, Staff, Attendance
from apps.accounts.serializers import UserSerializer
from apps.accounts.models import User
from apps.outlets.serializers import OutletSerializer

# Import Role model with alias to avoid confusion
RoleModel = Role


class RoleSerializer(serializers.ModelSerializer):
    """Role serializer"""
    
    class Meta:
        model = Role
        fields = ('id', 'tenant', 'name', 'description', 'can_sales', 'can_inventory',
                  'can_products', 'can_customers', 'can_reports', 'can_staff',
                  'can_settings', 'can_dashboard', 'is_active', 'created_at', 'updated_at')
        read_only_fields = ('id', 'tenant', 'created_at', 'updated_at')


class StaffSerializer(serializers.ModelSerializer):
    """Staff serializer"""
    user = UserSerializer(read_only=True)
    outlets = OutletSerializer(many=True, read_only=True)
    role = RoleSerializer(read_only=True)  # Use RoleSerializer to return full role object
    outlet_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
        default=list
    )
    role_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)  # For write operations
    
    # User creation fields (for creating new staff)
    name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8, allow_blank=True)
    user_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = Staff
        fields = (
            'id', 'user', 'user_id', 'tenant', 'outlets', 'outlet_ids',
            'role', 'role_id', 'is_active', 'created_at', 'updated_at',
            'name', 'email', 'phone', 'password'  # User creation fields
        )
        read_only_fields = ('id', 'user', 'outlets', 'role', 'tenant', 'created_at', 'updated_at')
        extra_kwargs = {
            'is_active': {'required': False},
        }
    
    def validate_outlet_ids(self, value):
        """Validate that outlets belong to tenant"""
        if value is None:
            return []
        if not value:
            return []
        
        # Ensure value is a list
        if not isinstance(value, list):
            raise serializers.ValidationError("outlet_ids must be a list")
        
        # Filter out any None or invalid values
        value = [v for v in value if v is not None and isinstance(v, (int, str))]
        
        if not value:
            return []
        
        request = self.context.get('request')
        if request:
            tenant = getattr(request, 'tenant', None) or request.user.tenant
            if tenant:
                from apps.outlets.models import Outlet
                # Convert to integers
                try:
                    outlet_ids = [int(v) for v in value]
                except (ValueError, TypeError):
                    raise serializers.ValidationError("outlet_ids must contain valid integers")
                
                outlets = Outlet.objects.filter(id__in=outlet_ids, tenant=tenant)
                if outlets.count() != len(outlet_ids):
                    raise serializers.ValidationError("One or more outlets do not belong to your tenant")
        return value
    
    def validate(self, attrs):
        """Validate that either user_id or user creation fields are provided"""
        if self.instance:
            # Update - user_id or user creation fields not required
            return attrs
        
        # Create - need either user_id or user creation fields
        user_id = attrs.get('user_id')
        name = attrs.get('name', '').strip() if attrs.get('name') else ''
        email = attrs.get('email', '').strip() if attrs.get('email') else ''
        password = attrs.get('password', '') if attrs.get('password') else ''
        has_user_fields = bool(name and email and password)
        
        if not user_id and not has_user_fields:
            raise serializers.ValidationError(
                "Either user_id or user creation fields (name, email, password) are required"
            )
        
        if user_id and has_user_fields:
            raise serializers.ValidationError(
                "Cannot provide both user_id and user creation fields"
            )
        
        # Validate password length if provided
        if password and len(password) < 8:
            raise serializers.ValidationError(
                {"password": "Password must be at least 8 characters long"}
            )
        
        # Update attrs with stripped values
        if name:
            attrs['name'] = name
        if email:
            attrs['email'] = email
        if password:
            attrs['password'] = password
        
        return attrs

    @staticmethod
    def _map_staff_role_to_user_role(role_obj):
        if not role_obj:
            return 'staff'
        role_name = (getattr(role_obj, 'name', '') or '').strip().lower()
        if 'admin' in role_name:
            return 'admin'
        if 'manager' in role_name:
            return 'manager'
        if 'cashier' in role_name:
            return 'cashier'
        return 'staff'
    
    def create(self, validated_data):
        """Create staff member, creating user if needed"""
        from django.db import IntegrityError, transaction
        from apps.outlets.models import Outlet
        from .models import Role
        
        outlet_ids = validated_data.pop('outlet_ids', None) or []
        user_id = validated_data.pop('user_id', None)
        role = validated_data.pop('role', None)
        role_id = validated_data.pop('role_id', None)  # Also check for role_id from frontend
        tenant = validated_data.pop('tenant', None)
        
        # Use role_id if provided, otherwise extract from role
        if role_id is None and role is not None:
            # Import here to avoid circular import
            from .models import Role as RoleModel
            # Extract role ID - handle Role object (from PrimaryKeyRelatedField), integer, or string
            if isinstance(role, RoleModel):
                # DRF's PrimaryKeyRelatedField converts ID to object
                role_id = role.id
            elif isinstance(role, int):
                role_id = role
            elif isinstance(role, str):
                try:
                    role_id = int(role)
                except (ValueError, TypeError):
                    role_id = None
            else:
                # Try to get id attribute if it exists
                try:
                    role_id = int(getattr(role, 'id', None) or role)
                except (ValueError, TypeError, AttributeError):
                    role_id = None
        
        # Ensure outlet_ids is a list
        if outlet_ids is None:
            outlet_ids = []
        if not isinstance(outlet_ids, list):
            outlet_ids = []
        
        if not tenant:
            raise serializers.ValidationError("Tenant is required")
        
        try:
            with transaction.atomic():
                # Create user if user creation fields provided
                if user_id:
                    try:
                        user = User.objects.get(id=user_id)
                    except User.DoesNotExist:
                        raise serializers.ValidationError(f"User with ID {user_id} does not exist")

                    # Keep user tenant aligned with assigned staff tenant.
                    # This prevents tenant users from logging in without tenant context.
                    if not user.is_saas_admin and user.tenant_id != tenant.id:
                        user.tenant = tenant
                        user.save(update_fields=['tenant'])
                else:
                    name = validated_data.pop('name', None)
                    email = validated_data.pop('email', None)
                    password = validated_data.pop('password', None)
                    phone = validated_data.pop('phone', None) or ''
                    
                    if not all([name, email, password]):
                        raise serializers.ValidationError("Name, email, and password are required to create a new user")
                    
                    # Check if user with this email already exists
                    if User.objects.filter(email=email).exists():
                        raise serializers.ValidationError(
                            {"email": f"A user with email {email} already exists"}
                        )
                    
                    # Check if username already exists
                    if User.objects.filter(username=email).exists():
                        # Generate unique username if email is already used as username
                        counter = 1
                        base_username = email.split('@')[0]
                        username = f"{base_username}{counter}"
                        while User.objects.filter(username=username).exists():
                            counter += 1
                            username = f"{base_username}{counter}"
                    else:
                        username = email
                    
                    # Create user
                    try:
                        user = User.objects.create_user(
                            email=email,
                            username=username,
                            name=name,
                            phone=phone if phone else None,
                            password=password,
                            tenant=tenant
                        )
                    except IntegrityError as e:
                        if 'email' in str(e).lower() or 'unique' in str(e).lower():
                            raise serializers.ValidationError(
                                {"email": f"A user with email {email} already exists"}
                            )
                        raise serializers.ValidationError(f"Error creating user: {str(e)}")
                
                # Check if staff profile already exists for this user
                # Note: OneToOneField means a user can only have ONE staff profile globally
                if Staff.objects.filter(user=user).exists():
                    existing_staff = Staff.objects.get(user=user)
                    raise serializers.ValidationError(
                        f"This user already has a staff profile for tenant '{existing_staff.tenant.name}'"
                    )
                
                # Create staff - ensure role_id is an integer or None
                # Remove 'role' from validated_data if it exists (shouldn't, but be safe)
                validated_data.pop('role', None)
                
                staff_data = {
                    'user': user,
                    'tenant': tenant,
                    **validated_data
                }
                
                # Only set role_id if we have a valid integer
                if role_id is not None:
                    try:
                        staff_data['role_id'] = int(role_id)
                    except (ValueError, TypeError):
                        staff_data['role_id'] = None
                else:
                    staff_data['role_id'] = None
                
                # Ensure 'role' is not in staff_data (should use role_id instead)
                staff_data.pop('role', None)
                
                staff = Staff.objects.create(**staff_data)

                # Keep accounts_user.role synchronized with assigned staff role
                if not user.is_saas_admin:
                    mapped_role = self._map_staff_role_to_user_role(staff.role)
                    if user.role != mapped_role:
                        user.role = mapped_role
                        user.save(update_fields=['role'])
                
                # Assign outlets
                if outlet_ids:
                    outlets = Outlet.objects.filter(id__in=outlet_ids, tenant=tenant)
                    if outlets.count() != len(outlet_ids):
                        raise serializers.ValidationError(
                            "One or more outlets do not belong to your tenant"
                        )
                    staff.outlets.set(outlets)
                
                return staff
        except serializers.ValidationError:
            raise
        except Exception as e:
            raise serializers.ValidationError(f"Error creating staff: {str(e)}")
    
    def update(self, instance, validated_data):
        """Update staff member"""
        outlet_ids = validated_data.pop('outlet_ids', None)
        role_id = validated_data.pop('role_id', None)
        role = validated_data.pop('role', None)
        
        # Handle role update - use role_id if provided, otherwise extract from role
        if role_id is not None:
            instance.role_id = role_id if role_id else None
        elif role is not None:
            # If role is a Role object, extract ID
            from .models import Role as RoleModel
            if isinstance(role, RoleModel):
                instance.role_id = role.id
            elif isinstance(role, int):
                instance.role_id = role
            else:
                instance.role_id = None
        
        # Update staff fields
        for attr, value in validated_data.items():
            if attr not in ['name', 'email', 'phone', 'password', 'user_id']:
                setattr(instance, attr, value)
        
        instance.save()

        # Keep accounts_user.role synchronized with assigned staff role
        user = instance.user
        if user and not user.is_saas_admin:
            mapped_role = self._map_staff_role_to_user_role(instance.role)
            if user.role != mapped_role:
                user.role = mapped_role
                user.save(update_fields=['role'])
        
        # Update outlets if provided
        if outlet_ids is not None:
            from apps.outlets.models import Outlet
            outlets = Outlet.objects.filter(id__in=outlet_ids, tenant=instance.tenant)
            instance.outlets.set(outlets)
        
        return instance


class AttendanceSerializer(serializers.ModelSerializer):
    """Attendance serializer"""
    staff = StaffSerializer(read_only=True)
    
    class Meta:
        model = Attendance
        fields = ('id', 'staff', 'outlet', 'check_in', 'check_out', 'notes', 'created_at')
        read_only_fields = ('id', 'created_at')

