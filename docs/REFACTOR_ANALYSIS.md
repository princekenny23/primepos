# Units-Only Refactor - Comprehensive Analysis

## CURRENT STATE AUDIT

### Backend Models
- **Product** (lines 28-163)
  - `retail_price`, `cost`, `wholesale_price` (decimal fields)
  - Properties: `default_variation`, `get_price()`, `get_cost()`, `get_sku()`, `get_barcode()`
  - Methods reference variations heavily
  
- **ItemVariation** (lines 166-248)
  - `product` ForeignKey → Product
  - `price`, `cost`, `sku`, `barcode`, `track_inventory`, `unit`, `low_stock_threshold`
  - Related to inventory batches
  
- **ProductUnit** (lines 251-340)
  - `product` ForeignKey → Product  
  - `unit_name`, `conversion_factor`, `retail_price`, `wholesale_price`
  - Methods: `get_price(sale_type)`, `convert_to_base_units()`, `convert_from_base_units()`

### Backend Views & Serializers
- **ItemVariationViewSet** (1399-1582)
  - Full CRUD with tenant filtering
  - Handles sku/barcode validation
  - Prefetches related objects
  
- **ProductUnitViewSet** (1584-1663)
  - Full CRUD with tenant filtering
  - Already production-ready
  
- **ItemVariationSerializer** (lines 21-135)
  - Validates sku, barcode uniqueness
  - Returns total_stock, is_low_stock computed fields

### Frontend Components
- **ProductModalTabs** (product-modal-tabs.tsx)
  - Variations tab with add/edit/delete
  - Units tab with add/edit/delete
  - Sequential save flow: Product → Variations → Units
  
- **ManageVariationsModal** (manage-variations-modal.tsx)
  - Standalone variation management
  - Full CRUD UI
  
- **SelectVariationModal** (select-variation-modal.tsx)
  - Modal to select variation for sales
  - Used in POS/sales screens

- **retail-pos.tsx** (1274 lines)
  - Uses variations in product lookup
  - Associates cart items with variations

### API Endpoints
- `POST /api/v1/variations/` - Create
- `GET /api/v1/variations/` - List
- `PUT /api/v1/variations/{id}/` - Update  
- `DELETE /api/v1/variations/{id}/` - Delete
- `POST /api/v1/units/` - Create
- `GET /api/v1/units/` - List
- `PUT /api/v1/units/{id}/` - Update
- `DELETE /api/v1/units/{id}/` - Delete

### Inventory System Integration
- Variations track inventory via batches (apps.inventory.stock_helpers)
- `get_available_stock(variation, outlet)` checks batch expiry
- Inventory queries use variation as pivot
- Stock deduction uses variation_id

### Business Logic Dependencies
1. **Variation as pricing mechanism** - get_price(), get_cost() from default variation
2. **SKU/Barcode duplication** - product level + variation level
3. **Stock tracking** - variations are tracked, not base product
4. **Wholesale pricing** - per-variation + per-unit pricing layers
5. **POS selection** - users select variations, not units

---

## REFACTOR GOAL

Replace variation-based system with **units-only** architecture:

```
BEFORE:
Product → variations[] → (price, sku, barcode, inventory)
Product → units[] → (conversion_factor)

AFTER:
Product → units[] ONLY → (price, conversion_factor, base_unit flag)
Inventory tracked in BASE UNIT (1.0 conversion_factor)
```

---

## IMPACT ANALYSIS

### Will Be Removed Entirely
1. **ItemVariation model** and all related code
2. **Variation management UI** (modals, forms, tabs)
3. **Variation service** calls to API
4. **Variation selection** in POS (select unit instead)
5. **Default variation** logic on Product

### Will Be Modified
1. **Product model** - remove variation fallback methods
2. **ProductUnitViewSet** - become THE pricing/inventory mechanism
3. **Product serializer** - return units[] instead of variations[]
4. **POS retail interface** - select UNIT not variation
5. **Inventory deduction** - use unit.conversion_factor

### Will Be Unchanged
1. **Tenant isolation** - same pattern
2. **Outlet filtering** - same pattern
3. **Stock calculations** - same logic, different pivot
4. **Batch expiry** - reuse for unit-based tracking
5. **Wholesale pricing** - move to unit level

---

## MIGRATION DATA STRATEGY

For production data with existing variations:

### Step 1: Create Base Unit
For each Product with variations, create ProductUnit with:
- `unit_name` = "Base" or "Single"
- `conversion_factor` = 1.0
- `retail_price` = Product.retail_price
- `wholesale_price` = Product.wholesale_price (if set)

### Step 2: Convert Variations → Units
For each ItemVariation:
- Create ProductUnit with:
  - `unit_name` = variation.name
  - `conversion_factor` = 1.0 (variations didn't have this)
  - `retail_price` = variation.price
  - `wholesale_price` = variation.cost (if applicable)
- Keep inventory data as-is (reattach to base unit)

### Step 3: Remap Inventory References
ItemVariation → id mapping to ProductUnit → id in batches

### Step 4: Cleanup
Drop ItemVariation table

---

## FILES REQUIRING CHANGES

### BACKEND
```
apps/products/
  ├── models.py (remove ItemVariation, update Product)
  ├── serializers.py (remove ItemVariationSerializer, update ProductSerializer)
  ├── views.py (remove ItemVariationViewSet)
  ├── admin.py (remove ItemVariationAdmin)
  └── migrations/ (create new migration)

apps/inventory/
  ├── stock_helpers.py (update to use ProductUnit instead of ItemVariation)
  ├── models.py (update Stock/Batch to reference ProductUnit)
  └── migrations/ (update foreign keys)

primepos/
  └── urls.py (remove /api/v1/variations/ route)
```

### FRONTEND
```
lib/
  ├── types/index.ts (remove ItemVariation type)
  ├── services/
  │   ├── productService.ts (remove variationService)
  │   └── unitService.ts (enhance as primary pricing service)
  └── api.ts (remove variations endpoint)

components/
  ├── modals/
  │   ├── product-modal-tabs.tsx (remove Variations tab, update Units tab)
  │   ├── manage-variations-modal.tsx (DELETE)
  │   └── select-variation-modal.tsx → select-unit-modal.tsx (rename, update)
  ├── pos/
  │   └── retail-pos.tsx (use units instead of variations)
  └── products/ (any variation-specific displays)

stores/ (Zustand)
  └── (any variation state)
```

---

## VALIDATION RULES (NEW)

1. **Every Product requires minimum 1 unit** (not 0)
2. **Exactly ONE base unit per product** (conversion_factor = 1.0)
3. **Unit names unique per product**
4. **conversion_factor >= 1.0** (cannot sell fractional base units)
5. **Price stored ONLY on units**
6. **No sku/barcode on units** (use product level only)

---

## NEW PRODUCT CREATION FLOW

```
1. User fills Basic Info (name, category, description)
2. User creates Units:
   - First unit marked as "Base" (conversion_factor = 1.0)
   - Set retail_price on base unit
   - Optionally add wholesale_price
   - System validates: has base unit, prices > 0
3. User can add variant units:
   - E.g., "Half-Dozen" with conversion_factor = 6.0, different price
   - E.g., "Dozen" with conversion_factor = 12.0, different price
4. Submit:
   - POST /api/v1/products/
   - POST /api/v1/units/ for each unit
   - No variations endpoint called
```

---

## NEW INVENTORY DEDUCTION FLOW

When selling Unit:

```
1. User selects product (e.g., Beer)
2. User selects unit (e.g., "Dozen" with conversion_factor = 12.0)
3. User enters quantity = 2
4. System calculates base units: 2 * 12.0 = 24 pieces
5. Deduct 24 from Product.stock
6. Log in batch/inventory: ProductUnit.id, conversion_factor
```

---

## REFERENCE: Current Variation Usage

### Serializers
- `ItemVariationSerializer` (lines 21-135)
- `ProductSerializer` includes `variations` field

### Views  
- `ItemVariationViewSet` (lines 1399-1582)
- Nested under product: `/api/v1/variations/?product=123`

### Frontend Services
- `variationService.list()`, `.create()`, `.update()`, `.delete()`
- Used in:
  - ProductModalTabs (tabs handling)
  - ManageVariationsModal (standalone)
  - retail-pos.tsx (selection)

### Inventory Integration
- Stock tracked via ItemVariation (PK reference in batches)
- `get_available_stock(variation, outlet)`
- Stock deduction uses `variation_id`

---

## RISK AREAS

1. **Production data migration** - must handle existing variations
2. **Inventory batches** - need to repoint to units
3. **SKU/Barcode** - currently on variations, need to clarify if moving to product only
4. **Wholesale pricing** - currently on both product + variation, need consolidation
5. **Stock calculations** - changing pivot point from variation to unit
6. **POS workflow** - users expect variation selection, need to hide that complexity

---

## BENEFITS FOR MALAWI POS CONTEXT

1. **Simpler UX** - no dual variation/unit concepts
2. **Unified pricing** - one price table per item
3. **Conversion-focused** - dozen, half-dozen, carton naturally fit units
4. **Inventory accuracy** - single base unit prevents confusion
5. **Reporting** - cleaner product-unit relationships
6. **Mobile-friendly** - fewer layers of selection in POS

---

## ROLLBACK STRATEGY

Keep ItemVariation table for X months:
- Archive existing variations to separate table
- Keep foreign keys intact until confirmed working
- Data duplication acceptable during transition

---

## NEXT STEPS

1. ✅ Audit complete
2. Create detailed migration plan
3. Implement backend changes
4. Implement frontend changes
5. Test end-to-end
6. Run migration on test data
7. Deploy with rollback plan
