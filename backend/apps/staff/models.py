from django.db import models
from apps.tenants.models import Tenant
from apps.outlets.models import Outlet
from apps.accounts.models import User


class Role(models.Model):
    """Role/Permission model"""
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='roles')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    # Permissions
    can_sales = models.BooleanField(default=False)
    can_inventory = models.BooleanField(default=False)
    can_products = models.BooleanField(default=False)
    can_customers = models.BooleanField(default=False)
    can_reports = models.BooleanField(default=False)
    can_staff = models.BooleanField(default=False)
    can_settings = models.BooleanField(default=False)
    can_dashboard = models.BooleanField(default=True)
    can_distribution = models.BooleanField(default=False)
    can_storefront = models.BooleanField(default=False)
    can_pos_retail = models.BooleanField(default=True)
    can_pos_restaurant = models.BooleanField(default=True)
    can_pos_bar = models.BooleanField(default=True)
    can_switch_outlet = models.BooleanField(default=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'staff_role'
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'
        ordering = ['name']
        unique_together = ['tenant', 'name']
        indexes = [
            models.Index(fields=['tenant']),
        ]

    def __str__(self):
        return f"{self.tenant.name} - {self.name}"


class Staff(models.Model):
    """Staff member model (links User to Tenant).
    A user can belong to one tenant at most once.
    Per-outlet role assignments are stored in StaffOutletRole.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='staff_profiles',
    )
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='staff_members')
    # outlets is backed by the StaffOutletRole through model (role per outlet)
    outlets = models.ManyToManyField(
        Outlet,
        through='StaffOutletRole',
        related_name='staff_members',
        blank=True,
    )
    # default / fallback role for the whole tenant profile
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff')

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'staff_staff'
        verbose_name = 'Employee'
        verbose_name_plural = 'Employees'
        # One Staff profile per user per tenant
        unique_together = [('user', 'tenant')]
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['role']),
        ]

    def __str__(self):
        return f"{self.user.name} - {self.tenant.name}"


class StaffOutletRole(models.Model):
    """Per-outlet role assignment for a Staff member.
    Allows a staff member to have different roles in different outlets within the same tenant.
    """
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='outlet_roles')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='staff_outlet_roles')
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff_outlet_assignments',
    )

    class Meta:
        db_table = 'staff_outlet_role'
        verbose_name = 'Staff Outlet Role'
        verbose_name_plural = 'Staff Outlet Roles'
        unique_together = [('staff', 'outlet')]
        indexes = [
            models.Index(fields=['staff']),
            models.Index(fields=['outlet']),
        ]

    def __str__(self):
        role_name = self.role.name if self.role else 'No role'
        return f"{self.staff.user.name} @ {self.outlet.name}: {role_name}"


class Attendance(models.Model):
    """Staff attendance tracking"""
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='attendance_records')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='attendance_records')
    check_in = models.DateTimeField()
    check_out = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'staff_attendance'
        verbose_name = 'Attendance'
        verbose_name_plural = 'Attendance Records'
        ordering = ['-check_in']
        indexes = [
            models.Index(fields=['staff']),
            models.Index(fields=['outlet']),
            models.Index(fields=['check_in']),
        ]

    def __str__(self):
        return f"{self.staff.user.name} - {self.check_in}"

