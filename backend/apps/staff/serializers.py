from rest_framework import serializers
from .models import Role, Staff, Attendance, StaffOutletRole
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
                  'can_settings', 'can_dashboard', 'can_distribution', 'can_storefront',
                  'can_pos_retail', 'can_pos_restaurant', 'can_pos_bar', 'can_switch_outlet',
                  'is_active', 'created_at', 'updated_at')
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
    outlet_roles = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        allow_empty=True,
        default=list,
    )
    outlet_role_assignments = serializers.SerializerMethodField(read_only=True)
    
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
            'role', 'role_id', 'outlet_roles', 'outlet_role_assignments',
            'is_active', 'created_at', 'updated_at',
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

    def validate_outlet_roles(self, value):
        """Validate outlet_roles payload and tenant ownership."""
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("outlet_roles must be a list")

        request = self.context.get('request')
        tenant = None
        if request:
            tenant = getattr(request, 'tenant', None) or getattr(request.user, 'tenant', None)

        normalized = []
        seen_outlets = set()
        for row in value:
            if not isinstance(row, dict):
                raise serializers.ValidationError("Each outlet_roles entry must be an object")

            outlet_id = row.get('outlet_id')
            role_id = row.get('role_id')

            try:
                outlet_id = int(outlet_id)
            except (TypeError, ValueError):
                raise serializers.ValidationError("Each outlet_roles entry requires a valid outlet_id")

            if outlet_id in seen_outlets:
                raise serializers.ValidationError(f"Duplicate outlet_id in outlet_roles: {outlet_id}")
            seen_outlets.add(outlet_id)

            if role_id in [None, '']:
                parsed_role_id = None
            else:
                try:
                    parsed_role_id = int(role_id)
                except (TypeError, ValueError):
                    raise serializers.ValidationError(
                        f"Invalid role_id for outlet {outlet_id}: {role_id}"
                    )

            normalized.append({
                'outlet_id': outlet_id,
                'role_id': parsed_role_id,
            })

        if tenant and normalized:
            from apps.outlets.models import Outlet
            outlet_ids = [r['outlet_id'] for r in normalized]
            outlets = Outlet.objects.filter(id__in=outlet_ids, tenant=tenant)
            if outlets.count() != len(outlet_ids):
                raise serializers.ValidationError(
                    "One or more outlet_ids in outlet_roles do not belong to your tenant"
                )

            role_ids = [r['role_id'] for r in normalized if r['role_id'] is not None]
            if role_ids:
                roles = Role.objects.filter(id__in=role_ids, tenant=tenant)
                if roles.count() != len(set(role_ids)):
                    raise serializers.ValidationError(
                        "One or more role_ids in outlet_roles do not belong to your tenant"
                    )

        return normalized

    def get_outlet_role_assignments(self, obj):
        assignments = obj.outlet_roles.select_related('outlet', 'role').all()
        return [
            {
                'outlet_id': item.outlet_id,
                'outlet_name': item.outlet.name if item.outlet else None,
                'role_id': item.role_id,
                'role_name': item.role.name if item.role else None,
            }
            for item in assignments
        ]

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
        outlet_roles = validated_data.pop('outlet_roles', None) or []
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
                
                # Allow one staff profile per tenant (same user can exist in different tenants).
                # If it already exists, treat create as an upsert to attach/update outlet roles.
                existing_staff = Staff.objects.filter(user=user, tenant=tenant).first()
                if existing_staff:
                    # Apply profile-level role if provided.
                    if role_id is not None:
                        try:
                            existing_staff.role_id = int(role_id)
                        except (ValueError, TypeError):
                            existing_staff.role_id = None

                    # Allow create payload to toggle active status for existing profile.
                    if 'is_active' in validated_data:
                        existing_staff.is_active = bool(validated_data.get('is_active'))

                    existing_staff.save()

                    # Upsert per-outlet role assignments if provided; fallback to outlet_ids.
                    if outlet_roles:
                        for row in outlet_roles:
                            StaffOutletRole.objects.update_or_create(
                                staff=existing_staff,
                                outlet_id=row['outlet_id'],
                                defaults={
                                    'role_id': row['role_id'] if row['role_id'] is not None else existing_staff.role_id,
                                },
                            )
                    elif outlet_ids:
                        outlets = Outlet.objects.filter(id__in=outlet_ids, tenant=tenant)
                        if outlets.count() != len(outlet_ids):
                            raise serializers.ValidationError(
                                "One or more outlets do not belong to your tenant"
                            )
                        for outlet in outlets:
                            StaffOutletRole.objects.update_or_create(
                                staff=existing_staff,
                                outlet=outlet,
                                defaults={'role_id': existing_staff.role_id},
                            )

                    # Keep accounts_user.role synchronized with assigned staff role.
                    if not user.is_saas_admin:
                        mapped_role = self._map_staff_role_to_user_role(existing_staff.role)
                        if user.role != mapped_role:
                            user.role = mapped_role
                            user.save(update_fields=['role'])

                    return existing_staff
                
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
                
                # Assign per-outlet roles if provided; otherwise fallback to outlet_ids + profile role.
                if outlet_roles:
                    for row in outlet_roles:
                        StaffOutletRole.objects.create(
                            staff=staff,
                            outlet_id=row['outlet_id'],
                            role_id=row['role_id'] if row['role_id'] is not None else staff.role_id,
                        )
                elif outlet_ids:
                    outlets = Outlet.objects.filter(id__in=outlet_ids, tenant=tenant)
                    if outlets.count() != len(outlet_ids):
                        raise serializers.ValidationError(
                            "One or more outlets do not belong to your tenant"
                        )
                    for outlet in outlets:
                        StaffOutletRole.objects.create(
                            staff=staff,
                            outlet=outlet,
                            role_id=staff.role_id,
                        )
                
                return staff
        except serializers.ValidationError:
            raise
        except Exception as e:
            raise serializers.ValidationError(f"Error creating staff: {str(e)}")
    
    def update(self, instance, validated_data):
        """Update staff member"""
        outlet_ids = validated_data.pop('outlet_ids', None)
        outlet_roles = validated_data.pop('outlet_roles', None)
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
        
        # Update outlet-role assignments if provided
        if outlet_roles is not None:
            # Replace assignments atomically at serializer scope
            instance.outlet_roles.all().delete()
            for row in outlet_roles:
                StaffOutletRole.objects.create(
                    staff=instance,
                    outlet_id=row['outlet_id'],
                    role_id=row['role_id'] if row['role_id'] is not None else instance.role_id,
                )
        elif outlet_ids is not None:
            from apps.outlets.models import Outlet
            outlets = Outlet.objects.filter(id__in=outlet_ids, tenant=instance.tenant)
            instance.outlet_roles.all().delete()
            for outlet in outlets:
                StaffOutletRole.objects.create(
                    staff=instance,
                    outlet=outlet,
                    role_id=instance.role_id,
                )
        
        return instance


class AttendanceSerializer(serializers.ModelSerializer):
    """Attendance serializer"""
    staff = StaffSerializer(read_only=True)
    
    class Meta:
        model = Attendance
        fields = ('id', 'staff', 'outlet', 'check_in', 'check_out', 'notes', 'created_at')
        read_only_fields = ('id', 'created_at')

