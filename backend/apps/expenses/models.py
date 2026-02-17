from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from apps.tenants.models import Tenant
from apps.outlets.models import Outlet
from apps.accounts.models import User
from apps.shifts.models import Shift


class Expense(models.Model):
    """Expense model for tracking business expenses"""
    CATEGORY_CHOICES = [
        ('Supplies', 'Supplies'),
        ('Utilities', 'Utilities'),
        ('Rent', 'Rent'),
        ('Marketing', 'Marketing'),
        ('Travel', 'Travel'),
        ('Equipment', 'Equipment'),
        ('Maintenance', 'Maintenance'),
        ('Other', 'Other'),
    ]
    
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('bank_transfer', 'Bank Transfer'),
        ('check', 'Check'),
        ('other', 'Other'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='expenses')
    outlet = models.ForeignKey(Outlet, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='expenses')
    shift = models.ForeignKey(Shift, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')
    
    expense_number = models.CharField(max_length=50, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    vendor = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    payment_reference = models.CharField(max_length=255, blank=True)
    expense_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Approval tracking
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_expenses')
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_notes = models.TextField(blank=True)
    rejected_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='rejected_expenses')
    rejected_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'expenses_expense'
        verbose_name = 'Expense'
        verbose_name_plural = 'Expenses'
        ordering = ['-expense_date', '-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['outlet']),
            models.Index(fields=['expense_date']),
            models.Index(fields=['status']),
            models.Index(fields=['category']),
        ]
    
    def __str__(self):
        return f"{self.expense_number} - {self.title}"
    
    def save(self, *args, **kwargs):
        """Auto-generate expense number if not provided"""
        if not self.expense_number:
            # Generate expense number: EXP-YYYYMMDD-XXXX
            from django.utils import timezone
            date_str = timezone.now().strftime('%Y%m%d')
            # Get the last expense number for today
            last_expense = Expense.objects.filter(
                expense_number__startswith=f'EXP-{date_str}'
            ).order_by('-expense_number').first()
            
            if last_expense:
                # Extract the sequence number and increment
                try:
                    sequence = int(last_expense.expense_number.split('-')[-1]) + 1
                except (ValueError, IndexError):
                    sequence = 1
            else:
                sequence = 1
            
            self.expense_number = f'EXP-{date_str}-{sequence:04d}'
        
        super().save(*args, **kwargs)

