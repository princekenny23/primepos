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
            first_profile = self.staff_profiles.select_related('role').first()
            if first_profile:
                return first_profile.role
        except Exception:
            pass
        return None
    
    @property
    def effective_role(self):
        """Get effective role - prefers staff_role, falls back to user.role"""
        staff_role = self.staff_role
        if staff_role:
            return staff_role.name.lower()
        return self.role
    
    def has_permission(self, permission):
        """Check if user has a specific permission through their role
        
        Args:
            permission (str): Permission name like 'can_sales', 'can_inventory', etc.
        
        Returns:
            bool: True if user has permission
        """
        # SaaS admins have all permissions
        if self.is_saas_admin or self.is_superuser:
            return True
        
        # Check through staff role — single source of truth
        staff_role = self.staff_role
        if staff_role:
            return getattr(staff_role, permission, False)
        
        # No staff role assigned — deny all non-admin access
        return False
    
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
        
        # SaaS admins have all permissions
        if self.is_saas_admin or self.is_superuser:
            return {key: True for key in permissions}
        
        # Check through staff role — single source of truth
        staff_role = self.staff_role
        if staff_role:
            for key in permissions:
                permissions[key] = getattr(staff_role, key, False)
            return permissions
        
        # No staff role assigned — all permissions denied
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
    for role_name, role_data in default_roles.items():
        role, _ = Role.objects.get_or_create(
            tenant=tenant,
            name=role_name,
            defaults=role_data
        )
        created_roles[role_name] = role
    
    return created_roles
