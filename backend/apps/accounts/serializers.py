from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """User serializer"""
    tenant = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    staff_role = serializers.SerializerMethodField()
    effective_role = serializers.SerializerMethodField()
    
    def get_tenant(self, obj):
        """Get tenant info without circular import"""
        if not obj.tenant:
            return None
        # Import here to avoid circular dependency
        from apps.tenants.serializers import TenantSerializer
        return TenantSerializer(obj.tenant).data
    
    def get_permissions(self, obj):
        """Get user permissions from their role"""
        return obj.get_permissions()
    
    def get_staff_role(self, obj):
        """Get staff role details if exists"""
        staff_role = obj.staff_role
        if staff_role:
            return {
                'id': staff_role.id,
                'name': staff_role.name,
                'description': staff_role.description,
            }
        return None
    
    def get_effective_role(self, obj):
        """Get the effective role (staff role or user role)"""
        return obj.effective_role
    
    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'name', 'phone', 'tenant', 'role', 
                  'effective_role', 'staff_role', 'permissions', 'is_saas_admin', 
                  'is_active', 'date_joined')
        read_only_fields = ('id', 'date_joined', 'permissions', 'staff_role', 'effective_role')


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom token serializer that includes user info"""
    identifier = serializers.CharField(write_only=True, required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # USERNAME_FIELD is email in this project; make it optional so identifier can drive auth.
        username_field = self.username_field
        if username_field in self.fields:
            self.fields[username_field].required = False
            self.fields[username_field].allow_blank = True
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['email'] = user.email
        token['role'] = user.role
        token['is_saas_admin'] = user.is_saas_admin
        if user.tenant:
            token['tenant_id'] = user.tenant.id
        return token
    
    def validate(self, attrs):
        # Support hybrid login using either email or username.
        identifier = attrs.pop('identifier', None) or attrs.get(self.username_field)
        if identifier:
            user = User.objects.filter(
                Q(email__iexact=identifier) | Q(username__iexact=identifier)
            ).first()
            if user:
                attrs[self.username_field] = getattr(user, self.username_field)
            else:
                # Preserve original input so default auth path can still return standard invalid-credentials response.
                attrs[self.username_field] = identifier

        data = super().validate(attrs)
        # Add user data to response
        data['user'] = UserSerializer(self.user).data
        return data


class RegisterSerializer(serializers.ModelSerializer):
    """Registration serializer"""
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ('email', 'username', 'name', 'password', 'password_confirm', 'phone', 'role')
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords don't match"})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        return user

