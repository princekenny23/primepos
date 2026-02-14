from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from apps.outlets.models import Outlet, Till
from apps.accounts.models import User
from apps.tenants.models import Tenant
# Sale imported in methods to avoid circular import


class Shift(models.Model):
    """Day shift management model"""
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('CLOSED', 'Closed'),
    ]

    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='shifts')
    till = models.ForeignKey(Till, on_delete=models.CASCADE, related_name='shifts')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='shifts')
    
    operating_date = models.DateField()
    opening_cash_balance = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    floating_cash = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0'), validators=[MinValueValidator(Decimal('0'))])
    closing_cash_balance = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal('0'))])
    
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='OPEN')
    notes = models.TextField(blank=True)
    
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    
    # Enhanced fields
    device_id = models.CharField(max_length=255, blank=True, help_text="Device identifier for multi-device tracking")
    sync_status = models.CharField(max_length=20, choices=[('synced', 'Synced'), ('pending', 'Pending'), ('conflict', 'Conflict')], default='synced')
    
    @property
    def cashier(self):
        """Alias for user (cashier) - for backward compatibility"""
        return self.user

    class Meta:
        db_table = 'shifts_shift'
        verbose_name = 'Shift'
        verbose_name_plural = 'Shifts'
        ordering = ['-start_time']
        indexes = [
            models.Index(fields=['outlet']),
            models.Index(fields=['till']),
            models.Index(fields=['user']),
            models.Index(fields=['operating_date']),
            models.Index(fields=['status']),
            models.Index(fields=['device_id']),
        ]

    def __str__(self):
        return f"{self.outlet.name} - {self.till.name} - {self.operating_date}"


