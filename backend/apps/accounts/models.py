from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class User(AbstractUser):
    """Custom User model extending Django's AbstractUser"""
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    role = models.CharField(
        max_length=50, choices=[
            ('admin', 'Admin'),
            ('manager', 'Manager'),
            ('cashier', 'Cashier'),
            ('staff', 'Staff'),
            ('saas_admin', 'SaaS Admin'),
        ],
        default='staff'
    )
    is_saas_admin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    def save(self, *args, **kwargs):
        if not self.name and self.username:
            self.name = self.username
        if self.is_saas_admin:
            self.tenant = None
            self.role = 'saas_admin'
        super().save(*args, **kwargs)

    class Meta:
        db_table = 'accounts_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.email
    
    # Role and Permission Helper Methods
    @property
    def staff_role(self):
        """Get the user's Staff Role object (from staff app)"""
        try:
            if self.tenant_id:
                tenant_profile = self.staff_profiles.select_related('role').filter(tenant_id=self.tenant_id).first()
                if tenant_profile and tenant_profile.role:
                    return tenant_profile.role

            first_profile = self.staff_profiles.select_related('role').first()
            if first_profile and first_profile.role:
                return first_profile.role
        except Exception:
            pass
        return None

    def _resolve_permission_role(self):
        """Resolve the role used for permission checks.

        Priority:
        1) Tenant staff profile role
        2) Tenant staff outlet-role assignment
        3) Tenant Role matching accounts_user.role (case-insensitive)
        """
        try:
            from apps.staff.models import Role

            tenant_profile = None
            if self.tenant_id:
                tenant_profile = self.staff_profiles.select_related('role').filter(tenant_id=self.tenant_id).first()

            if tenant_profile and tenant_profile.role and tenant_profile.role.is_active:
                return tenant_profile.role

            if tenant_profile:
                outlet_assignment = tenant_profile.outlet_roles.select_related('role').filter(role__isnull=False).first()
                if outlet_assignment and outlet_assignment.role and outlet_assignment.role.is_active:
                    return outlet_assignment.role

            role_name = (self.role or '').strip()
            if self.tenant_id and role_name:
                fallback_role = Role.objects.filter(
                    tenant_id=self.tenant_id,
                    is_active=True,
                    name__iexact=role_name,
                ).first()
                if fallback_role:
                    return fallback_role
        except Exception:
            pass

        return None
    
    @property
    def effective_role(self):
        """Get effective role - prefers staff_role, falls back to user.role"""
        permission_role = self._resolve_permission_role()
        if permission_role:
            return permission_role.name.lower()
        return self.role
    
    def has_permission(self, permission):
        """Check if user has a specific permission through their role
        
        Args:
            permission (str): Permission name like 'can_sales', 'can_inventory', etc.
        
        Returns:
            bool: True if user has permission
        """
        from .rbac import user_has_legacy_permission, user_has_permission_code

        # Support canonical permission code checks (e.g. users.create).
        if '.' in str(permission):
            return user_has_permission_code(self, str(permission))

        # Legacy can_* compatibility path.
        return user_has_legacy_permission(self, str(permission))

    def get_permission_codes(self):
        """Get canonical permission codes granted to this user."""
        from .rbac import user_permission_codes
        return sorted(user_permission_codes(self))
    
    def get_permissions(self):
        """Get dictionary of all permissions for this user
        
        Returns:
            dict: Dictionary with permission names as keys and boolean values
        """
        permissions = {
            'can_sales': False,
            'can_inventory': False,
            'can_products': False,
            'can_customers': False,
            'can_reports': False,
            'can_staff': False,
            'can_settings': False,
            'can_dashboard': True,
            'can_distribution': False,
            'can_storefront': False,
            'can_pos_retail': False,
            'can_pos_restaurant': False,
            'can_pos_bar': False,
            'can_switch_outlet': True,
        }
        
        for key in permissions:
            permissions[key] = self.has_permission(key)
        return permissions


# Signal to create Staff profile when User is created (if they have a tenant)
@receiver(post_save, sender=User)
def create_staff_profile(sender, instance, created, **kwargs):
    """Automatically create Staff profile for users with a tenant"""
    if created and instance.tenant and not instance.is_superuser:
        # Avoid circular import
        from apps.staff.models import Staff
        
        # Check if staff profile already exists for this tenant
        if not instance.staff_profiles.filter(tenant=instance.tenant).exists():
            try:
                Staff.objects.create(
                    user=instance,
                    tenant=instance.tenant,
                    is_active=True
                )
            except Exception as e:
                # Log but don't fail user creation
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to create staff profile for user {instance.id}: {str(e)}")


# Utility function to create default roles for a tenant
def create_default_roles_for_tenant(tenant):
    """Create default roles for a tenant
    
    Args:
        tenant: Tenant instance
    
    Returns:
        dict: Dictionary with role names as keys and Role instances as values
    """
    from apps.staff.models import Role
    
    default_roles = {
        'Admin': {
            'description': 'Full system access and control',
            'can_sales': True,
            'can_inventory': True,
            'can_products': True,
            'can_customers': True,
            'can_reports': True,
            'can_staff': True,
            'can_settings': True,
            'can_dashboard': True,
            'can_distribution': True,
            'can_storefront': True,
            'can_pos_retail': True,
            'can_pos_restaurant': True,
            'can_pos_bar': True,
            'can_switch_outlet': True,
        },
        'Manager': {
            'description': 'Manage outlet operations and staff',
            'can_sales': True,
            'can_inventory': True,
            'can_products': True,
            'can_customers': True,
            'can_storefront': True,
            'can_switch_outlet': True,
            'can_reports': True,
            'can_staff': True,
            'can_settings': False,
            'can_dashboard': True,
            'can_distribution': True,
            'can_pos_retail': True,
            'can_pos_restaurant': True,
            'can_pos_bar': True,
        },
        'Supervisor': {
            'description': 'Supervise daily operations',
            'can_sales': True,
            'can_inventory': True,
            'can_products': True,
            'can_customers': True,
            'can_reports': True,
            'can_staff': False,
            'can_settings': False,
            'can_dashboard': True,
            'can_distribution': False,
            'can_storefront': False,
            'can_pos_retail': True,
            'can_pos_restaurant': True,
            'can_pos_bar': True,
            'can_switch_outlet': True,
        },
        'Cashier': {
            'description': 'Process sales transactions',
            'can_sales': True,
            'can_inventory': False,
            'can_products': False,
            'can_customers': True,
            'can_reports': False,
            'can_staff': False,
            'can_settings': False,
            'can_dashboard': True,
            'can_distribution': False,
            'can_storefront': False,
            'can_pos_retail': True,
            'can_pos_restaurant': True,
            'can_pos_bar': True,
            'can_switch_outlet': True,
        },
        'Staff': {
            'description': 'Basic staff access',
            'can_sales': True,
            'can_inventory': False,
            'can_products': False,
            'can_customers': False,
            'can_reports': False,
            'can_staff': False,
            'can_settings': False,
            'can_dashboard': True,
            'can_distribution': False,
            'can_storefront': False,
            'can_pos_retail': True,
            'can_pos_restaurant': True,
            'can_pos_bar': True,
            'can_switch_outlet': False,
        },
        'Dispatcher': {
            'description': 'Manage delivery assignments and dispatch workflows',
            'can_sales': True,
            'can_inventory': False,
            'can_products': False,
            'can_customers': True,
            'can_reports': False,
            'can_staff': False,
            'can_settings': False,
            'can_dashboard': True,
            'can_distribution': True,
            'can_storefront': False,
            'can_pos_retail': True,
            'can_pos_restaurant': True,
            'can_pos_bar': True,
            'can_switch_outlet': False,
        },
        'Driver': {
            'description': 'Track and update assigned deliveries only',
            'can_sales': False,
            'can_inventory': False,
            'can_products': False,
            'can_customers': False,
            'can_reports': False,
            'can_staff': False,
            'can_settings': False,
            'can_dashboard': True,
            'can_distribution': True,
            'can_storefront': False,
            'can_pos_retail': False,
            'can_pos_restaurant': False,
            'can_pos_bar': False,
            'can_switch_outlet': False,
        },
    }
    
    created_roles = {}
    from apps.accounts.rbac import ensure_permission_catalog, sync_role_permissions_from_legacy_flags
    ensure_permission_catalog()
    for role_name, role_data in default_roles.items():
        role, _ = Role.objects.get_or_create(
            tenant=tenant,
            name=role_name,
            defaults=role_data
        )
        # Keep canonical role permissions in sync with legacy defaults.
        sync_role_permissions_from_legacy_flags(role)
        created_roles[role_name] = role
    
    return created_roles
