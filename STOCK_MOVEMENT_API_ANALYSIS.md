# Stock Movement API Analysis

## 1. StockMovement Model Definition

**Location:** [backend/apps/inventory/models.py](backend/apps/inventory/models.py#L64-L105)

### Model Fields:
```python
class StockMovement(models.Model):
    MOVEMENT_TYPES = [
        ('sale', 'Sale'),
        ('purchase', 'Purchase'),
        ('adjustment', 'Adjustment'),
        ('transfer_in', 'Transfer In'),
        ('transfer_out', 'Transfer Out'),
        ('return', 'Return'),
        ('damage', 'Damage'),
        ('expiry', 'Expiry'),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='stock_movements')
    batch = models.ForeignKey(Batch, on_delete=models.SET_NULL, null=True, blank=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_movements', null=True, blank=True)
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='stock_movements')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='stock_movements')
    
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity = models.IntegerField(validators=[MinValueValidator(1)])
    reason = models.TextField(blank=True)
    reference_id = models.CharField(max_length=100, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
```

---

## 2. Serializer for POST Requests

**Location:** [backend/apps/inventory/serializers.py](backend/apps/inventory/serializers.py#L29-L76)

```python
class StockMovementSerializer(serializers.ModelSerializer):
    batch = BatchSerializer(read_only=True)
    batch_id = serializers.PrimaryKeyRelatedField(
        write_only=True, 
        required=False, 
        allow_null=True, 
        source='batch', 
        queryset=Batch.objects.all()
    )
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        write_only=True, 
        required=False,           # ⚠️ OPTIONAL but required by validator
        allow_null=True, 
        source='product', 
        queryset=Product.objects.all()
    )
    product_name = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()
    outlet_name = serializers.SerializerMethodField()
    
    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        product = attrs.get('product') or (instance.product if instance else None)
        
        # UNITS ONLY ARCHITECTURE: No variation support
        if not product:
            raise serializers.ValidationError("product is required")  # ⚠️ VALIDATOR ERROR
        
        return attrs
    
    class Meta:
        model = StockMovement
        fields = ('id', 'tenant', 'batch', 'batch_id', 'product', 'product_id', 
                  'product_name', 'outlet', 'outlet_name', 'user', 'user_name', 
                  'movement_type', 'quantity', 'reason', 'reference_id', 'created_at')
        read_only_fields = ('id', 'created_at', 'product_name', 'user_name', 
                            'outlet_name', 'batch')
```

---

## 3. Required vs Optional Fields for Creating a Movement

### ✅ **REQUIRED FIELDS** (must be provided):
| Field | Type | Notes |
|-------|------|-------|
| `product_id` | Integer (ForeignKey ID) | Must reference existing Product. Validated by `validate()` method. |
| `outlet` | Integer (ForeignKey ID) | Outlet where movement occurs. Required by model. |
| `movement_type` | String (choice) | Must be one of: `sale`, `purchase`, `adjustment`, `transfer_in`, `transfer_out`, `return`, `damage`, `expiry` |
| `quantity` | Integer | Must be >= 1. Validated with `MinValueValidator(1)` |

### ⚠️ **SYSTEM-SET FIELDS** (set by backend):
| Field | Set By | Notes |
|-------|--------|-------|
| `tenant` | View/Request | Set in `perform_create()`. Derived from request context. |
| `user` | View/Request | Set in `perform_create()`. Derived from `request.user`. |
| `id` | Database | Auto-generated primary key |
| `created_at` | Database | Auto-generated timestamp |

### ✅ **OPTIONAL FIELDS** (can be omitted):
| Field | Type | Notes |
|-------|------|-------|
| `batch_id` | Integer (ForeignKey ID) | Batch reference. Optional, handled by helper functions. |
| `reason` | String | Description of movement reason. Blank by default. |
| `reference_id` | String | Reference to related transaction (sale ID, transfer ID, etc.). Blank by default. |
| `user` | Integer | User making the movement. System-set if not provided. |

---

## 4. Validators and Custom Create Methods

### Model-Level Validator:
**Location:** [backend/apps/inventory/models.py](backend/apps/inventory/models.py#L98-L110)

```python
def clean(self):
    """Ensure product is set"""
    from django.core.exceptions import ValidationError
    
    if not self.product:
        raise ValidationError("Product must be set")
    
    # Validate batch belongs to same outlet if provided
    if self.batch and self.batch.outlet != self.outlet:
        raise ValidationError("Batch must belong to the same outlet")

def save(self, *args, **kwargs):
    """Validate before saving"""
    self.clean()
    super().save(*args, **kwargs)
```

### Serializer-Level Validator:
```python
def validate(self, attrs):
    instance = getattr(self, 'instance', None)
    product = attrs.get('product') or (instance.product if instance else None)
    
    if not product:
        raise serializers.ValidationError("product is required")  # ⚠️ SOURCE OF ERROR
    
    return attrs
```

### Custom Create Method (perform_create):
**Location:** [backend/apps/inventory/views.py](backend/apps/inventory/views.py#L85-L200)

```python
def perform_create(self, serializer):
    """Create stock movement and update batches/LocationStock if product is provided"""
    tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
    if not tenant:
        raise ValidationError("Tenant is required")
    
    product = serializer.validated_data.get('product')
    outlet = serializer.validated_data.get('outlet')
    movement_type = serializer.validated_data.get('movement_type')
    quantity = serializer.validated_data.get('quantity')
    reason = serializer.validated_data.get('reason', '')
    
    # Handle stock changes using batch-aware logic
    if product and outlet:
        if movement_type in ['purchase', 'transfer_in', 'return']:
            # Create batch and add stock
            batch = add_stock(...)
            movement = serializer.save(tenant=tenant, user=self.request.user, batch=batch)
        elif movement_type in ['sale', 'transfer_out', 'damage', 'expiry']:
            # Deduct from existing batches (FIFO)
            deduct_stock(...)
        elif movement_type == 'adjustment':
            # Handle positive/negative adjustments
            batch = add_stock(...)
            movement = serializer.save(tenant=tenant, user=self.request.user, batch=batch)
```

---

## 5. Frontend Integration

**Location:** [frontend/lib/services/inventoryService.ts](frontend/lib/services/inventoryService.ts#L36-L76)

### CreateMovementData Interface:
```typescript
export interface CreateMovementData {
  product_id: string
  outlet?: string
  outlet_id?: string
  movement_type: string
  quantity: number
  reason?: string
  reference_id?: string
}

async createMovement(data: CreateMovementData): Promise<any> {
  const { outlet_id, outlet, ...rest } = data
  const normalizedOutlet = outlet ?? outlet_id

  if (!normalizedOutlet) {
    throw new Error("Outlet is required to create stock movement")
  }

  return api.post(apiEndpoints.inventory.movements, {
    ...rest,
    outlet: normalizedOutlet,
  })
}
```

---

## 6. API Endpoint Details

**URL:** `/api/v1/inventory/movements/`  
**Method:** `POST`  
**ViewSet:** [StockMovementViewSet](backend/apps/inventory/views.py#L21)

### Example Payload:
```json
{
  "product_id": 123,
  "outlet": 45,
  "movement_type": "sale",
  "quantity": 10,
  "reason": "Customer purchase",
  "reference_id": "SALE-2026-04-30-001"
}
```

### Expected Response (201 Created):
```json
{
  "id": 5001,
  "tenant": 10,
  "batch": null,
  "batch_id": null,
  "product": {
    "id": 123,
    "name": "Product Name",
    ...
  },
  "product_id": 123,
  "product_name": "Product Name",
  "outlet": 45,
  "outlet_name": "Main Store",
  "user": 99,
  "user_name": "John Doe",
  "movement_type": "sale",
  "quantity": 10,
  "reason": "Customer purchase",
  "reference_id": "SALE-2026-04-30-001",
  "created_at": "2026-04-30T14:30:00Z"
}
```

---

## 7. Common "This field is required" Error Diagnosis

### Error Sources:

1. **Missing `product_id`** - Most likely
   - Error: `"product is required"`
   - Fix: Ensure `product_id` is included in POST payload

2. **Missing `outlet`** - Possible if outlet not in request
   - The field is marked as writable but not explicitly required in serializer Meta
   - Fix: Ensure `outlet` (outlet ID) is included

3. **Missing `movement_type`** - Possible
   - Field is required with specific choices
   - Fix: Provide valid movement type from list

4. **Missing `quantity`** - Possible
   - Field is required with MinValueValidator(1)
   - Fix: Provide quantity > 0

5. **Missing `tenant`** - Unlikely (system-set)
   - Fix: Only if acting as SaaS admin with special headers

---

## 8. Test Files

**Location:** `backend/apps/inventory/tests/`
- `test_stock_helpers.py` - Tests FIFO logic and batch management
- `test_performance_integration.py` - Performance benchmarks

### Test Data Structure:
```python
def setUp(self):
    self.tenant = Tenant.objects.create(name="Test Tenant")
    self.user = User.objects.create_user(
        username="testuser",
        email="test@example.com",
        tenant=self.tenant
    )
    self.outlet = Outlet.objects.create(
        tenant=self.tenant,
        name="Main Store"
    )
    self.product = Product.objects.create(
        tenant=self.tenant,
        outlet=self.outlet,
        name="Test Product",
        retail_price=Decimal("10.00")
    )
```

---

## 9. Key Implementation Notes

### UNITS ONLY ARCHITECTURE:
- The system uses **Product** directly (no ItemVariation)
- Batch tracking is for expiry date management, not product variations
- All stock movements must reference a Product

### Batch Handling:
- **Add operations** (purchase, transfer_in, return): Create new batch automatically
- **Remove operations** (sale, transfer_out, damage, expiry): Deduct from FIFO (earliest expiry first)
- **Adjustment operations**: Add or subtract stock

### Stock Helpers:
- `get_available_stock(product, outlet)` - Returns non-expired quantity
- `add_stock(...)` - Creates batch and adds inventory
- `deduct_stock(...)` - FIFO deduction with movement tracking

### Tenant Isolation:
- All queries filtered by user's tenant
- SaaS admins can specify tenant via query params or headers
- Security-critical filtering applied in `get_queryset()`

---

## 10. Recommended Debugging Steps

1. **Check frontend payload:**
   ```typescript
   console.log("Payload:", {
     product_id: 123,
     outlet: 45,
     movement_type: "sale",
     quantity: 10
   })
   ```

2. **Verify backend receives request:**
   - Check Django logs in `perform_create()`
   - Log serializer validation errors

3. **Test with cURL:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/inventory/movements/ \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "product_id": 123,
       "outlet": 45,
       "movement_type": "sale",
       "quantity": 10
     }'
   ```

4. **Check tenant context:**
   - Ensure request.user.tenant is set
   - Verify tenant permissions (allow_inventory module access)

5. **Validate relationships:**
   - Product exists and belongs to tenant
   - Outlet exists and belongs to tenant
   - User has access to outlet

---

## Summary

The `StockMovement` model requires **4 core fields**: `product_id`, `outlet`, `movement_type`, and `quantity`. The serializer includes a validator that explicitly checks for `product` presence. The "field is required" error typically indicates missing `product_id` or improper field mapping between frontend and backend. The frontend correctly sends `product_id` in the payload, but ensure all fields are provided and match the expected types.
