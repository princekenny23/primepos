from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db.models import Q
from .serializers import CustomTokenObtainPairSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


class LoginView(TokenObtainPairView):
    """Login endpoint"""
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        """Override post to log login activity"""
        if getattr(settings, 'TENANT_URL_STRICT', False):
            host = (
                request.META.get('HTTP_X_TENANT_HOST')
                or request.META.get('HTTP_HOST')
                or request.get_host()
                or ''
            ).split(':')[0].strip().lower()
            is_local_host = host in {'', 'localhost', '127.0.0.1'}

            # In strict mode, tenant login should come from a tenant-resolved URL.
            if not is_local_host and not getattr(request, 'tenant', None):
                identifier = request.data.get('identifier') or request.data.get('email')
                is_saas_admin_attempt = False
                if identifier:
                    is_saas_admin_attempt = User.objects.filter(
                        Q(email__iexact=identifier) | Q(username__iexact=identifier),
                        is_saas_admin=True,
                    ).exists()

                if not is_saas_admin_attempt:
                    return Response(
                        {'detail': 'Tenant URL not recognized. Please use your tenant login URL.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        response = super().post(request, *args, **kwargs)
        
        # Log login if successful
        if response.status_code == 200:
            try:
                from apps.activity_logs.utils import log_login
                identifier = request.data.get('identifier') or request.data.get('email')
                user = None
                if identifier:
                    user_qs = User.objects.filter(
                        Q(email__iexact=identifier) | Q(username__iexact=identifier)
                    )
                    if getattr(request, 'tenant', None):
                        user_qs = user_qs.filter(tenant=request.tenant)
                    user = user_qs.first()
                if user and user.tenant:
                    # Get IP address
                    ip_address = self._get_client_ip(request)
                    user_agent = request.META.get('HTTP_USER_AGENT', '')
                    log_login(user, ip_address=ip_address, user_agent=user_agent)
            except Exception as e:
                # Don't break login if logging fails
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to log login activity: {str(e)}")
        
        return response
    
    def _get_client_ip(self, request):
        """Get client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class RegisterView(generics.CreateAPIView):
    """Registration endpoint"""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate tokens
        token_serializer = CustomTokenObtainPairSerializer()
        token_data = token_serializer.get_token(user)
        
        return Response({
            'access': str(token_data.access_token),
            'refresh': str(token_data),
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Get current user info"""
    # Refresh user from database to get latest tenant association
    user = User.objects.select_related('tenant').get(pk=request.user.pk)
    serializer = UserSerializer(user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Logout endpoint (token blacklisting can be added here)"""
    # Log logout activity
    try:
        from apps.activity_logs.utils import log_logout
        ip_address = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0] or request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        log_logout(request.user, ip_address=ip_address, user_agent=user_agent)
    except Exception as e:
        # Don't break logout if logging fails
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to log logout activity: {str(e)}")
    
    return Response({"message": "Logged out successfully"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_user(request):
    """Create a user for a tenant (for onboarding/owner creation)"""
    from .serializers import UserSerializer
    from apps.tenants.models import Tenant
    
    # Only allow if user is creating for their own tenant or is SaaS admin
    tenant_id = request.data.get('tenant')
    if not tenant_id:
        return Response(
            {"detail": "tenant is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get Tenant instance (not just ID)
    try:
        tenant = Tenant.objects.get(pk=tenant_id)
    except Tenant.DoesNotExist:
        return Response(
            {"detail": "Tenant not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check permissions
    if not request.user.is_saas_admin:
        # Regular users can only create users for their own tenant
        if not request.user.tenant or request.user.tenant.id != tenant.id:
            return Response(
                {"detail": "You can only create users for your own tenant"},
                status=status.HTTP_403_FORBIDDEN
            )
    
    # Validate required fields
    email = request.data.get('email')
    if not email:
        return Response(
            {"detail": "email is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if user already exists
    if User.objects.filter(email=email).exists():
        return Response(
            {"detail": "User with this email already exists"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get password from request or generate one
    password = request.data.get('password')
    if not password:
        # Generate a temporary password if not provided
        import secrets
        import string
        password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
        temporary_password = password
    else:
        temporary_password = None
    
    # Create user with Tenant instance (not ID)
    user = User.objects.create_user(
        email=email,
        username=request.data.get('username') or email.split('@')[0],
        password=password,
        name=request.data.get('name', ''),
        phone=request.data.get('phone', ''),
        role=request.data.get('role', 'admin'),
        tenant=tenant,  # Pass Tenant instance, not ID
    )
    
    # Optionally create Staff record if outlet_id is provided
    outlet_id = request.data.get('outlet')
    if outlet_id:
        try:
            from apps.staff.models import Staff, StaffOutletRole, Role
            from apps.outlets.models import Outlet
            
            outlet = Outlet.objects.get(pk=outlet_id, tenant=tenant)
            # Reuse the auto-created staff profile when present and assign the selected outlet.
            staff, _ = Staff.objects.get_or_create(
                user=user,
                tenant=tenant,
                defaults={"is_active": True},
            )

            # Keep Staff role aligned with the role chosen during onboarding/user creation.
            role_keyword_map = {
                'admin': 'admin',
                'manager': 'manager',
                'cashier': 'cashier',
                'staff': 'staff',
            }
            role_keyword = role_keyword_map.get((user.role or '').lower())
            if role_keyword:
                matched_role = Role.objects.filter(
                    tenant=tenant,
                    is_active=True,
                    name__icontains=role_keyword,
                ).first()
                if matched_role and staff.role_id != matched_role.id:
                    staff.role = matched_role
                    staff.save(update_fields=['role', 'updated_at'])

            StaffOutletRole.objects.update_or_create(
                staff=staff,
                outlet=outlet,
                defaults={'role_id': staff.role_id},
            )
        except Exception as e:
            # Log error but don't fail user creation
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to assign outlet for user {user.id}: {str(e)}")
    
    serializer = UserSerializer(user)
    response_data = {
        'user': serializer.data,
    }
    
    # Only return temporary password if it was auto-generated
    if temporary_password:
        response_data['temporary_password'] = temporary_password
    
    return Response(response_data, status=status.HTTP_201_CREATED)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_user(request, user_id):
    """Update a user"""
    from .serializers import UserSerializer
    
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response(
            {"detail": "User not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check permissions
    if not request.user.is_saas_admin:
        # Regular users can only update users in their own tenant
        if not request.user.tenant or user.tenant != request.user.tenant:
            return Response(
                {"detail": "You can only update users in your own tenant"},
                status=status.HTTP_403_FORBIDDEN
            )
    
    # Update user fields
    if 'name' in request.data:
        user.name = request.data['name']
    if 'phone' in request.data:
        user.phone = request.data.get('phone', '')
    if 'role' in request.data:
        user.role = request.data['role']
    if 'password' in request.data and request.data['password']:
        user.set_password(request.data['password'])
    
    user.save()
    
    serializer = UserSerializer(user)
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_user(request, user_id):
    """Delete a user"""
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response(
            {"detail": "User not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check permissions
    if not request.user.is_saas_admin:
        # Regular users can only delete users in their own tenant
        if not request.user.tenant or user.tenant != request.user.tenant:
            return Response(
                {"detail": "You can only delete users in your own tenant"},
                status=status.HTTP_403_FORBIDDEN
            )
    
    # Prevent deleting yourself
    if user.id == request.user.id:
        return Response(
            {"detail": "You cannot delete your own account"},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user_email = user.email
    user.delete()
    
    return Response(
        {"message": f"User {user_email} has been deleted successfully"},
        status=status.HTTP_200_OK
    )

