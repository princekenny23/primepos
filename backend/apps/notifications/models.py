from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class Notification(models.Model):
    """
    Notification model for real-time alerts and system messages.
    """
    TYPE_SALE = 'sale'
    TYPE_STOCK = 'stock'
    TYPE_STAFF = 'staff'
    TYPE_SYSTEM = 'system'
    TYPE_PAYMENT = 'payment'
    TYPE_CUSTOMER = 'customer'
    TYPE_REPORT = 'report'

    TYPE_CHOICES = [
        (TYPE_SALE, 'Sale'),
        (TYPE_STOCK, 'Stock'),
        (TYPE_STAFF, 'Staff'),
        (TYPE_SYSTEM, 'System'),
        (TYPE_PAYMENT, 'Payment'),
        (TYPE_CUSTOMER, 'Customer'),
        (TYPE_REPORT, 'Report'),
    ]

    PRIORITY_LOW = 'low'
    PRIORITY_NORMAL = 'normal'
    PRIORITY_HIGH = 'high'
    PRIORITY_URGENT = 'urgent'

    PRIORITY_CHOICES = [
        (PRIORITY_LOW, 'Low'),
        (PRIORITY_NORMAL, 'Normal'),
        (PRIORITY_HIGH, 'High'),
        (PRIORITY_URGENT, 'Urgent'),
    ]

    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        db_index=True,
        help_text="User to whom the notification is directed (if specific)"
    )
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_SYSTEM, db_index=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=PRIORITY_NORMAL, db_index=True)
    title = models.CharField(max_length=255)
    message = models.TextField()
    resource_type = models.CharField(max_length=100, blank=True, null=True, help_text="e.g., 'Sale', 'Product', 'Shift'")
    resource_id = models.CharField(max_length=100, blank=True, null=True, db_index=True, help_text="ID of the resource related to the notification")
    link = models.CharField(max_length=500, blank=True, null=True, help_text="Frontend link to view details of the notification")
    metadata = models.JSONField(default=dict, blank=True)
    read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notifications'
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'read', '-created_at']),
            models.Index(fields=['user', 'read', '-created_at']),
            models.Index(fields=['type', '-created_at']),
            models.Index(fields=['priority', '-created_at']),
        ]

    def __str__(self):
        return f"[{self.get_priority_display()}] {self.title} ({'Read' if self.read else 'Unread'})"


class NotificationPreference(models.Model):
    """
    User notification preferences for controlling which notifications they receive.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='notification_preferences',
        db_index=True
    )
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='notification_preferences',
        db_index=True
    )
    
    # Enable/disable notification types
    enable_sale_notifications = models.BooleanField(default=True)
    enable_stock_notifications = models.BooleanField(default=True)
    enable_staff_notifications = models.BooleanField(default=True)
    enable_system_notifications = models.BooleanField(default=True)
    enable_payment_notifications = models.BooleanField(default=True)
    enable_customer_notifications = models.BooleanField(default=True)
    enable_report_notifications = models.BooleanField(default=True)
    
    # Priority filters
    enable_low_priority = models.BooleanField(default=True)
    enable_normal_priority = models.BooleanField(default=True)
    enable_high_priority = models.BooleanField(default=True)
    enable_urgent_priority = models.BooleanField(default=True)
    
    # Delivery methods (for future use - email, SMS, etc.)
    email_enabled = models.BooleanField(default=False)
    sms_enabled = models.BooleanField(default=False)
    push_enabled = models.BooleanField(default=True)  # In-app notifications
    
    # Quiet hours (for future use)
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notification_preferences'
        verbose_name = 'Notification Preference'
        verbose_name_plural = 'Notification Preferences'
        unique_together = [['user', 'tenant']]

    def __str__(self):
        return f"Notification Preferences for {self.user.email}"
