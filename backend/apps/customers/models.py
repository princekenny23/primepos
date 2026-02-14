from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from apps.tenants.models import Tenant
from apps.outlets.models import Outlet


class Customer(models.Model):
    """Customer/CRM model"""
    CREDIT_STATUS_CHOICES = [
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('closed', 'Closed'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='customers')
    outlet = models.ForeignKey(Outlet, on_delete=models.SET_NULL, null=True, blank=True, related_name='customers')
    
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    
    loyalty_points = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    total_spent = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    last_visit = models.DateTimeField(null=True, blank=True)
    
    # Credit/Accounts Receivable Fields
    credit_enabled = models.BooleanField(default=False, help_text="Whether this customer can make credit purchases")
    credit_limit = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Maximum credit limit for this customer"
    )
    payment_terms_days = models.IntegerField(
        default=30,
        validators=[MinValueValidator(0)],
        help_text="Payment terms in days (e.g., 30 for Net 30, 60 for Net 60)"
    )
    credit_status = models.CharField(
        max_length=20,
        choices=CREDIT_STATUS_CHOICES,
        default='active',
        help_text="Current credit account status"
    )
    credit_notes = models.TextField(blank=True, help_text="Notes about customer's credit account")
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customers_customer'
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'
        ordering = ['name']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['outlet']),
            models.Index(fields=['email']),
            models.Index(fields=['phone']),
        ]

    def __str__(self):
        return self.name
    
    @property
    def outstanding_balance(self):
        """Calculate total outstanding balance from unpaid credit sales"""
        from django.db.models import Sum, F
        from apps.sales.models import Sale
        # Include both formal credit invoices and customer-linked tabs
        unpaid_sales = Sale.objects.filter(
            customer=self,
            payment_method__in=['credit', 'tab'],
            payment_status__in=['unpaid', 'partially_paid']
        ).aggregate(
            total=Sum(F('total') - F('amount_paid'))
        )['total'] or Decimal('0')
        return unpaid_sales
    
    @property
    def available_credit(self):
        """Calculate available credit (credit_limit - outstanding_balance)"""
        if not self.credit_enabled:
            return Decimal('0')
        available = self.credit_limit - self.outstanding_balance
        return max(Decimal('0'), available)
    
    def can_make_credit_sale(self, sale_amount):
        """Check if customer can make a credit sale of given amount"""
        if not self.credit_enabled:
            return False, "Credit is not enabled for this customer"
        if self.credit_status != 'active':
            return False, f"Credit account is {self.credit_status}"
        if self.outstanding_balance + sale_amount > self.credit_limit:
            return False, f"Credit limit would be exceeded. Available credit: {self.available_credit}"
        return True, "Credit sale allowed"


class LoyaltyTransaction(models.Model):
    """Loyalty points transaction history"""
    TRANSACTION_TYPES = [
        ('earned', 'Earned'),
        ('redeemed', 'Redeemed'),
        ('adjusted', 'Adjusted'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='loyalty_transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    points = models.IntegerField()
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customers_loyaltytransaction'
        verbose_name = 'Loyalty Transaction'
        verbose_name_plural = 'Loyalty Transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.customer.name} - {self.transaction_type} - {self.points}"


class CreditPayment(models.Model):
    """Records payments against credit sales"""
    PAYMENT_METHODS = [
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('mobile', 'Mobile Money'),
        ('bank_transfer', 'Bank Transfer'),
        ('other', 'Other'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='credit_payments')
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='credit_payments')
    sale = models.ForeignKey('sales.Sale', on_delete=models.CASCADE, related_name='payments', help_text="The invoice being paid")
    
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Payment amount"
    )
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash')
    payment_date = models.DateTimeField(auto_now_add=True, help_text="Date payment was recorded")
    reference_number = models.CharField(
        max_length=100,
        blank=True,
        help_text="Receipt number, check number, or other reference"
    )
    notes = models.TextField(blank=True, help_text="Additional notes about the payment")
    user = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='recorded_payments', help_text="User who recorded the payment")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'customers_creditpayment'
        verbose_name = 'Credit Payment'
        verbose_name_plural = 'Credit Payments'
        ordering = ['-payment_date', '-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['customer']),
            models.Index(fields=['sale']),
            models.Index(fields=['payment_date']),
        ]
    
    def __str__(self):
        return f"Payment of {self.amount} for {self.sale.receipt_number} by {self.customer.name}"

