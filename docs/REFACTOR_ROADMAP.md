# UNITS-ONLY REFACTOR - EXECUTION ROADMAP

## PHASE 1: BACKEND FOUNDATION (6-8 hours)

### 1.1 Update Models
- **Product model** (models.py ~lines 28-163)
  - Remove: `default_variation` property, `get_price()`, `get_cost()`, `get_sku()`, `get_barcode()` methods
  - These relied on variations fallback - not needed with units-only
  - Keep: `retail_price`, `cost`, `wholesale_price` as DEPRECATED (for backward compat during transition)
  
- **ItemVariation model** 
  - MARK FOR DELETION in migration (not immediate)
  - Keep for data preservation in migration step

### 1.2 Update Serializers
- **ItemVariationSerializer** → DELETE
- **ProductSerializer** (lines 136-275)
  - Remove `variations` field
  - Add `units` field (array of ProductUnitSerializer)
  - Update pricing to pull from base unit
  
- **ProductUnitSerializer** → ENHANCE
  - Add `is_base_unit` field (computed: conversion_factor == 1.0)
  - Update field validation

### 1.3 Update ViewSets
- **ItemVariationViewSet** → DELETE route registration
- **ProductViewSet** → Update to NOT nest variations
- **ProductUnitViewSet** → Already correct, just verify

### 1.4 Create Migration
Safe migration with rollback:
```
1. Add ProductUnit backup table
2. Copy ItemVariation data → ProductUnit (with mapping)
3. Update Inventory batch foreign keys
4. Mark ItemVariation as deprecated
5. Drop endpoints (but keep table for rollback)
```

### 1.5 Update URL Routes
- Remove: `router.register(r'variations', ItemVariationViewSet)`
- Keep: `router.register(r'units', ProductUnitViewSet)`

---

## PHASE 2: INVENTORY INTEGRATION (4-6 hours)

### 2.1 Update Inventory Models
- **Stock/Batch models** (apps/inventory/models.py)
  - Foreign key: ItemVariation → ProductUnit
  - Keep stock tracking logic (same)

### 2.2 Update Stock Helpers
- **stock_helpers.py** (apps/inventory/)
  - `get_available_stock(unit, outlet)` instead of `(variation, outlet)`
  - Conversion factor logic remains

### 2.3 Deduction Logic
- **Sales module** (apps/sales/)
  - When saving SalesItem: use `product_unit_id` not `variation_id`
  - Calculate base units: quantity * unit.conversion_factor

---

## PHASE 3: FRONTEND COMPONENTS (8-12 hours)

### 3.1 Type Definitions
- **lib/types/index.ts**
  - Remove `ItemVariation` type
  - Update `Product` to only reference `units: ProductUnit[]`

### 3.2 Services  
- **lib/services/productService.ts**
  - Remove `variationService` export
  - Import `unitService` instead
  - Update `transformProduct()` to map units

- **lib/services/unitService.ts**
  - Already exists, just verify correctness
  - Add `base_unit()` helper method

### 3.3 Modal Components
- **product-modal-tabs.tsx**
  - REMOVE "Variations" tab entirely
  - Enhance "Units" tab:
    - Require minimum 1 unit
    - Mark first unit as "Base"
    - Prevent deletion of base unit
    - Set conversion_factor = 1.0 for base
    
- **manage-variations-modal.tsx** → DELETE entirely
  - Users manage units in product form now

- **select-variation-modal.tsx** → RENAME to select-unit-modal.tsx
  - Change logic: select unit from product.units
  - NOT from separate variations array

### 3.4 POS Integration
- **retail-pos.tsx** (~1274 lines)
  - Remove variation selection
  - Replace with unit selection
  - Change: "Select Variation" → "Select Unit/Package"
  - Calculate deduction: quantity * unit.conversion_factor

### 3.5 State Management
- **Zustand stores**
  - Remove any variation-related state
  - Update cart items: `variation_id` → `unit_id`

### 3.6 API Calls
- **lib/api.ts**
  - Remove `variations` endpoint
  - Verify `units` endpoint exists

---

## PHASE 4: DATA MIGRATION (2-4 hours)

Create Django management command:
```python
# backend/apps/products/management/commands/migrate_variations_to_units.py

def migrate_variations_to_units():
    """
    1. For each Product:
       - Create base unit (conversion_factor=1.0) if needed
       - Migrate price from Product.retail_price
    
    2. For each ItemVariation:
       - Create ProductUnit
       - Map attributes: name, price, cost
       - Set conversion_factor = 1.0 (variations had no conversion)
    
    3. Update inventory:
       - Remap Stock/Batch records
       - ItemVariation.id → ProductUnit.id
    
    4. Verify:
       - Every product has ≥1 unit
       - Exactly 1 base unit per product
       - No orphaned stock records
    
    5. Rollback:
       - Archive ItemVariation table
       - Keep inventory intact
    """
```

---

## ESTIMATED TIMELINE

| Phase | Hours | Tasks |
|-------|-------|-------|
| Phase 1: Backend | 6-8 | Models, Serializers, Views, Migration |
| Phase 2: Inventory | 4-6 | Stock integration, Deduction logic |
| Phase 3: Frontend | 8-12 | Components, Services, POS |
| Phase 4: Migration | 2-4 | Data cleanup, Rollback plan |
| **Testing** | **4-6** | E2E tests, Regression tests |
| **TOTAL** | **24-36 hours** | ~3-4 days of focused work |

---

## RISK MITIGATION

1. **Data Loss Prevention**
   - Keep ItemVariation table (archive mode)
   - Test migration on copy of production DB first
   - Create backup before running migration

2. **Backward Compatibility**
   - API still returns `units` array
   - Old variation IDs archived in migration
   - Rollback script available if needed

3. **Testing Before Deploy**
   - Unit tests for new unit selection logic
   - Integration tests for stock deduction
   - POS smoke tests

---

## DECISION POINTS FOR USER

### Q1: SKU/Barcode Handling
**Current**: Can be on Product OR ItemVariation
**New**: Move to Product level ONLY (simplify)
**Action**: Existing variation SKUs → consolidate to product SKU in migration

### Q2: Existing Variation Data
**Current**: ~X products with Y variations in production
**Option A**: Migrate all to units (1-time operation)
**Option B**: Archive variations table (keep old data accessible)
**Recommendation**: Both (migrate + archive for rollback)

### Q3: Wholesale Pricing
**Current**: Can be on Product AND ItemVariation
**New**: Only on ProductUnit
**Action**: Use highest specificity (variation → unit during migration)

### Q4: Conversion Factors
**Current**: Variations had none (all were 1:1 with base)
**New**: Units can have conversion_factor > 1
**Action**: Set all migrated variations to conversion_factor = 1.0

---

## SUCCESS CRITERIA

- ✅ No ItemVariation references in views/serializers
- ✅ Every product has ≥1 unit with conversion_factor=1.0
- ✅ Product create/edit uses ONLY units
- ✅ POS selects units not variations
- ✅ Inventory deduction uses conversion_factor
- ✅ Existing data migrated without loss
- ✅ Rollback procedure tested

---

## QUESTIONS FOR CONFIRMATION

Before implementing, please clarify:

1. **Are you ready for this 24-36 hour refactor?**
2. **Should SKUs be moved to product level or removed entirely?**
3. **Do you have a test database for migration testing?**
4. **Should variations archive be kept indefinitely or purged after 30 days?**
5. **Any production data preservation requirements?**

---

## RECOMMENDED APPROACH

**Recommended**: Start with Phase 1 (Backend) immediately
- Models/serializers are lower risk
- Migration strategy can be refined while frontend work proceeds in parallel
- Frontend changes can start once backend API is clear

Would you like to:
- [ ] Start Phase 1 now (backend refactor)
- [ ] Get clarification on decision points first
- [ ] Adjust timeline/scope
