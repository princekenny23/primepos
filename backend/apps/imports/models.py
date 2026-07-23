import uuid
from django.conf import settings
from django.db import models
from apps.tenants.models import Tenant
from apps.outlets.models import Outlet
from apps.products.models import Product


class ImportBatch(models.Model):
    ENTITY_PRODUCTS = 'products'
    ENTITY_CHOICES = [
        (ENTITY_PRODUCTS, 'Products'),
    ]

    STATUS_UPLOADED = 'uploaded'
    STATUS_PREVIEW_READY = 'preview_ready'
    STATUS_APPROVED = 'approved'
    STATUS_APPLYING = 'applying'
    STATUS_APPLIED = 'applied'
    STATUS_CANCELLED = 'cancelled'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_UPLOADED, 'Uploaded'),
        (STATUS_PREVIEW_READY, 'Preview Ready'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_APPLYING, 'Applying'),
        (STATUS_APPLIED, 'Applied'),
        (STATUS_CANCELLED, 'Cancelled'),
        (STATUS_FAILED, 'Failed'),
    ]

    MODE_UPSERT_ADJUST = 'upsert_adjust'
    MODE_INVENTORY_SYNC = 'inventory_sync'
    MODE_CHOICES = [
        (MODE_UPSERT_ADJUST, 'Upsert + Adjust'),
        (MODE_INVENTORY_SYNC, 'Inventory Sync'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='import_batches')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='import_batches')
    entity_type = models.CharField(max_length=50, choices=ENTITY_CHOICES, default=ENTITY_PRODUCTS)
    sync_mode = models.CharField(max_length=50, choices=MODE_CHOICES, default=MODE_UPSERT_ADJUST)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default=STATUS_UPLOADED)

    source_filename = models.CharField(max_length=255)
    source_file = models.FileField(upload_to='imports/%Y/%m/%d/', null=True, blank=True)
    idempotency_key = models.CharField(max_length=128, null=True, blank=True)

    total_rows = models.IntegerField(default=0)
    valid_rows = models.IntegerField(default=0)
    invalid_rows = models.IntegerField(default=0)
    warning_rows = models.IntegerField(default=0)
    applied_rows = models.IntegerField(default=0)

    preview_summary = models.JSONField(default=dict, blank=True)
    apply_summary = models.JSONField(default=dict, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_import_batches')
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_import_batches')
    is_approved = models.BooleanField(default=False)
    approved_at = models.DateTimeField(null=True, blank=True)
    apply_idempotency_key = models.CharField(max_length=128, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    previewed_at = models.DateTimeField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'imports_importbatch'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'entity_type', 'status']),
            models.Index(fields=['tenant', 'outlet', 'created_at']),
            models.Index(fields=['idempotency_key']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'entity_type', 'idempotency_key'],
                name='uniq_import_batch_idempotency_per_tenant_entity',
            ),
        ]


class ImportRowResult(models.Model):
    STATUS_VALID = 'valid'
    STATUS_INVALID = 'invalid'
    STATUS_WARNING = 'warning'
    STATUS_CHOICES = [
        (STATUS_VALID, 'Valid'),
        (STATUS_INVALID, 'Invalid'),
        (STATUS_WARNING, 'Warning'),
    ]

    ACTION_CREATE = 'create'
    ACTION_UPDATE = 'update'
    ACTION_SKIP = 'skip'
    ACTION_CHOICES = [
        (ACTION_CREATE, 'Create'),
        (ACTION_UPDATE, 'Update'),
        (ACTION_SKIP, 'Skip'),
    ]

    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name='rows')
    row_number = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, default=ACTION_SKIP)
    identity_key = models.CharField(max_length=255, blank=True)

    errors = models.JSONField(default=list, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    raw_data = models.JSONField(default=dict, blank=True)
    normalized_data = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'imports_importrowresult'
        ordering = ['row_number']
        unique_together = [['batch', 'row_number']]
        indexes = [
            models.Index(fields=['batch', 'status']),
            models.Index(fields=['batch', 'action']),
        ]


class ImportAuditEvent(models.Model):
    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=64)
    message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='import_audit_events')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'imports_importauditevent'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['batch', 'created_at']),
            models.Index(fields=['event_type']),
        ]


class ImportApplyError(models.Model):
    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name='apply_errors')
    row_number = models.IntegerField(null=True, blank=True)
    chunk_index = models.IntegerField(default=0)
    error_code = models.CharField(max_length=64, default='apply_error')
    message = models.TextField()
    details = models.JSONField(default=dict, blank=True)
    raw_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'imports_importapplyerror'
        ordering = ['created_at', 'row_number']
        indexes = [
            models.Index(fields=['batch', 'chunk_index']),
            models.Index(fields=['batch', 'row_number']),
            models.Index(fields=['error_code']),
        ]


class ImportStockMutation(models.Model):
    """Track inventory deltas applied by an inventory sync batch per product row.

    This enables delta-based rollback that preserves later sales/purchases by
    reversing only the sync-applied quantity deltas.
    """

    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name='stock_mutations')
    row_number = models.IntegerField()
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='import_stock_mutations')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='import_stock_mutations')

    before_quantity = models.IntegerField(default=0)
    applied_quantity = models.IntegerField(default=0)
    quantity_delta = models.IntegerField(default=0)
    sync_strategy = models.CharField(max_length=64, blank=True)
    movement_reason = models.CharField(max_length=255, blank=True)

    rolled_back = models.BooleanField(default=False)
    rolled_back_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'imports_importstockmutation'
        ordering = ['row_number', 'created_at']
        unique_together = [['batch', 'row_number', 'product']]
        indexes = [
            models.Index(fields=['batch', 'rolled_back']),
            models.Index(fields=['product', 'outlet']),
            models.Index(fields=['created_at']),
        ]
