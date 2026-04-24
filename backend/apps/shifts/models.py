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

    # PHASE 4: Variance accountability fields
    closed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='closed_shifts',
        help_text="Staff member who closed this shift (may differ from opener)"
    )
    variance_reason = models.TextField(
        blank=True,
        help_text="Explanation required when |variance| > threshold"
    )
    variance_approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='variance_approved_shifts',
        help_text="Manager who signed off the variance"
    )
    
    @property
    def cashier(self):
        """Alias for user (cashier) - for backward compatibility"""
        return self.user

    @property
    def system_total(self):
        """
        Expected till cash: opening balance plus completed cash sales,
        minus cash expenses, minus withdrawals, plus deposits.

        Formula: opening + sales - expenses - withdrawals + deposits
        """
        from apps.sales.models import Sale
        from apps.expenses.models import Expense

        cash_sales = Sale.objects.filter(
            shift=self,
            status='completed',
            is_void=False,
            payment_method='cash',
        ).aggregate(total=models.Sum('total'))['total'] or Decimal('0')

        cash_expenses = Expense.objects.filter(
            shift=self,
            status='approved',
            payment_method='cash',
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')

        # Withdrawals and deposits via CashMovement records
        cash_movements = CashMovement.objects.filter(shift=self)
        withdrawals = (
            cash_movements.filter(movement_type='withdrawal')
            .aggregate(total=models.Sum('amount'))['total'] or Decimal('0')
        )
        deposits = (
            cash_movements.filter(movement_type='deposit')
            .aggregate(total=models.Sum('amount'))['total'] or Decimal('0')
        )

        return (self.opening_cash_balance + cash_sales - cash_expenses - withdrawals + deposits)

    @property
    def difference(self):
        """Cash variance between counted and expected cash."""
        if self.closing_cash_balance is None:
            return None
        return self.closing_cash_balance - self.system_total

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


# ---------------------------------------------------------------------------
# PHASE 4: Cash reconciliation
# ---------------------------------------------------------------------------

class CashMovement(models.Model):
    """
    Records deposits, withdrawals, and other cash movements during a shift.

    Used by system_total property to compute expected cash:
      system_total = opening + sales - expenses - withdrawals + deposits
    """

    MOVEMENT_TYPES = [
        ('deposit', 'Deposit'),
        ('withdrawal', 'Withdrawal'),
        ('float_add', 'Float Add'),
        ('paid_out', 'Paid Out'),
    ]

    shift = models.ForeignKey(
        Shift, on_delete=models.CASCADE, related_name='cash_movements'
    )
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
    )
    note = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cash_movements_recorded',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shifts_cashmovement'
        verbose_name = 'Cash Movement'
        verbose_name_plural = 'Cash Movements'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['shift']),
            models.Index(fields=['movement_type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.get_movement_type_display()} {self.amount} on {self.shift}"

