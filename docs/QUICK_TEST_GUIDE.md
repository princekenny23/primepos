# Quick Test Guide - Variations & Units

## ✅ What Was Done

**6 Steps Completed:**
1. ✅ Consolidated type definitions (removed duplicates)
2. ✅ Created unitService.ts (dedicated unit API service)
3. ✅ Cleaned up productService.ts (removed legacy code)
4. ✅ Rewrote modal save logic (clean sequential flow)
5. ✅ Reviewed backend ViewSets (already correct)
6. ✅ Verified field mapping (all aligned)

---

## 🧪 Quick Test - CREATE NEW PRODUCT WITH VARIATIONS & UNITS

### Open Product Modal
1. Go to POS or Inventory
2. Click "Add Product"

### Fill Basic Tab
```
Name: "Water Bottle"
SKU: "WB-001" (optional)
Category: Select one
Barcode: "123456" (optional)
Description: "Refreshing water bottle"
Price: 2.50
```

### Add Variations (Variations Tab)
Click "Add Variation" 3 times:
```
1. Name: "250ml"  → Price: 2.50
2. Name: "500ml"  → Price: 4.50
3. Name: "1L"     → Price: 7.50
```

### Add Units (Units Tab)
Click "Add Unit" 2 times:
```
1. Name: "Piece"
   Conversion: 1
   Price: 2.50
   
2. Name: "Dozen"
   Conversion: 12
   Price: 25.00
```

### Save & Verify
1. Click "Save"
2. Should see: "Product created successfully"
3. Go to Django Admin
4. Check `/admin/products/product/` → Product exists
5. Check `/admin/products/itemvariation/` → 3 variations exist
6. Check `/admin/products/productunit/` → 2 units exist

---

## 🔍 What to Verify in Django Admin

### Product Entry
```
Name: Water Bottle
SKU: WB-001
Price: 2.50
```

### ItemVariation Table (3 entries)
```
| Product | Name | Price | Track Inv | Active |
|---------|------|-------|-----------|--------|
| Water B | 250m | 2.50  | Yes       | Yes    |
| Water B | 500m | 4.50  | Yes       | Yes    |
| Water B | 1L   | 7.50  | Yes       | Yes    |
```

### ProductUnit Table (2 entries)
```
| Product  | Unit Name | Conversion | Retail Price | Wholesale |
|----------|-----------|------------|--------------|-----------|
| Water Bo | Piece     | 1.0000     | 2.50         | -         |
| Water Bo | Dozen     | 12.0000    | 25.00        | -         |
```

---

## ⚠️ Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Product created but no variations appear" | Variation save failed silently | Check browser console for errors |
| Variations show price as string "2.50" | parseFloat() not working | Check that modal sends numbers not strings |
| Units not appearing | Endpoint /api/v1/units/ not found | Check URL config in backend |
| "Outlet is required" error | No outlet selected | Assign outlet in stockForm |
| Prices showing as 0 | Conversion failed | Ensure form inputs are numbers before save |

---

## 📋 Backend Verification

All backend pieces should already be working:

**Routes registered:**
```
/api/v1/variations/      → ItemVariationViewSet
/api/v1/units/           → ProductUnitViewSet
```

**Models exist:**
- `ItemVariation` (with price field, NO sku/barcode/cost)
- `ProductUnit` (with unit_name, conversion_factor, etc.)

**Serializers configured:**
- `ItemVariationSerializer` → Transforms variations
- `ProductUnitSerializer` → Transforms units

---

## 🧠 How It Works Now (Clean Flow)

```
User clicks "Save Product"
        ↓
Step 1: Create/Update Product via productService
        ↓ Returns: product.id
Step 2: For each variation → variationService.create/update
        ↓ Uses: product.id from Step 1
Step 3: For each unit → unitService.create/update
        ↓ Uses: product.id from Step 1
        ↓
Show Success Toast
Close Modal
```

**Key Difference:**
- ❌ OLD: Tried to send variations + units in product payload
- ✅ NEW: Product created first, then variations/units linked via product.id

---

## 📱 Mobile/POS Testing

After variations & units work in modal:

1. **POS Tab** - Select product with variations
   - Should show dropdown with variation options
   - Each variation has correct price

2. **Stock Taking** - Edit product with variations
   - Should load variations correctly
   - Should allow quantity updates

3. **Reports** - Product breakdown
   - Should show individual variation sales
   - Should show unit conversions if used

---

## 🎯 Success Criteria

✅ Complete when:
- [ ] Create product → variations/units saved
- [ ] All prices are numbers (not strings) in database
- [ ] Django admin shows all created records
- [ ] Edit product → update variations/units works
- [ ] POS can select variations correctly
- [ ] No TypeScript errors in console
- [ ] No API 400/500 errors in network tab

---

## 💾 Files Changed

**Frontend (4 files):**
1. `lib/types/index.ts` - Simplified ItemVariation type
2. `lib/services/productService.ts` - Cleaned up, removed legacy code
3. `lib/services/unitService.ts` - NEW service for units
4. `components/modals/product-modal-tabs.tsx` - New save logic

**Backend (0 files):**
- No changes needed - already working!

---

## 🚀 Quick Checklist Before Deploying

- [ ] Test create new product with variations + units
- [ ] Verify data in Django admin
- [ ] Test editing existing product's variations
- [ ] Test POS flow with variations
- [ ] Check browser console - no errors
- [ ] Check network tab - all API calls 200/201
- [ ] Test on mobile viewport
- [ ] Test with multiple outlets if configured

