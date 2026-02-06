# Frontend Inventory UI/UX Mockups & Component Updates

**Visual reference for implementation**

---

## 1️⃣ POS Product Grid - CURRENT vs UPDATED

### CURRENT (Simple)
```
┌─────────────────────────────────────────────────────────┐
│                   PRODUCTS                              │
├─────────┬─────────┬─────────┬─────────┬─────────────────┤
│ Coca    │ Fanta   │ Sprite  │ Beer    │ Whiskey         │
│ Cola    │         │         │ Bottle  │                 │
│         │         │         │         │                 │
│ MWK 25  │ MWK 20  │ MWK 25  │ MWK 15  │ MWK 500         │
│ Stock:  │ Stock:  │ Stock:  │ Stock:  │ Stock: 45       │
│ 100     │ 150     │ 200     │ 250     │                 │
│         │         │         │         │                 │
│ [ADD]   │ [ADD]   │ [ADD]   │ [ADD]   │ [ADD]           │
└─────────┴─────────┴─────────┴─────────┴─────────────────┘
```

### UPDATED (With variations + units)
```
┌─────────────────────────────────────────────────────────┐
│                   PRODUCTS                              │
├─────────────────────────────────────────────────────────┤
│
│ 🥤 Coca Cola
│    ├─ Variation: 500ml (or default)
│    ├─ Available Units:
│    │  ○ 🔹 Piece: MWK 25 (100 pcs avail)
│    │  ○ 📦 Dozen: MWK 270 (8 dozen avail)
│    │  ● 📫 Carton: MWK 1,080 (2 cartons avail) ← SELECTED
│    │
│    └─ [SELECT THIS UNIT & QUANTITY]
│
│ 🍺 Beer - Bottle
│    ├─ Variation: Castle (or default)
│    ├─ Available Units:
│    │  ○ 🔹 Bottle: MWK 15 (250 avail)
│    │  ● 📦 Case: MWK 180 (20 cases avail) ← SELECTED
│    │
│    └─ [SELECT THIS UNIT & QUANTITY]
│
└─────────────────────────────────────────────────────────┘
```

---

## 2️⃣ Product Modal - TAB STRUCTURE

### BEFORE (Long scrolling form)
```
┌──────────────────────────────────────────────────────┐
│  ADD PRODUCT                                    [X]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Product Name ____________________________          │
│  Category [Select...]                              │
│  SKU ____________________________                   │
│  Barcode ____________________________               │
│  Description _____________________                 │
│  (scroll down...)                                  │
│  Variation Name ____________________________        │
│  Variation SKU ____________________________         │
│  Variation Barcode ____________________________      │
│  Unit [Select...]                                  │
│  Price ____________________________                 │
│  Cost ____________________________                  │
│  (scroll down...)                                  │
│  [MORE FIELDS...]                                  │
│                                                      │
│  [CANCEL]                           [SAVE PRODUCT]  │
└──────────────────────────────────────────────────────┘
```

### AFTER (Organized tabs)
```
┌──────────────────────────────────────────────────────┐
│  ADD PRODUCT                                    [X]  │
├──────────────────────────────────────────────────────┤
│ [BASIC] [VARIATIONS] [UNITS] [PRICING] [STOCK]      │
├──────────────────────────────────────────────────────┤
│
│  BASIC INFORMATION
│  ───────────────────────────────────────────────────
│
│  Product Name *
│  [_______________________________]
│
│  Category
│  [Select Category ▼]
│
│  SKU
│  [_______________________________]
│
│  Barcode
│  [_______________________________]
│
│  Description
│  [_________________________________]
│  [_________________________________]
│
│                                  [NEXT: VARIATIONS >>]
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  ADD PRODUCT                                    [X]  │
├──────────────────────────────────────────────────────┤
│ [BASIC] [VARIATIONS] [UNITS] [PRICING] [STOCK]      │
├──────────────────────────────────────────────────────┤
│
│  VARIATIONS (Optional - leave empty for single item)
│  ───────────────────────────────────────────────────
│
│  ✓ Variation 1: 500ml
│    ├─ SKU: COKE-500ML
│    ├─ Barcode: 1234567890
│    └─ Unit: pcs
│
│  ✓ Variation 2: 1L
│    ├─ SKU: COKE-1L
│    ├─ Barcode: 1234567891
│    └─ Unit: pcs
│
│  [+ ADD VARIATION]
│
│  [<< BACK]                            [NEXT: UNITS >>]
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  ADD PRODUCT                                    [X]  │
├──────────────────────────────────────────────────────┤
│ [BASIC] [VARIATIONS] [UNITS] [PRICING] [STOCK]      │
├──────────────────────────────────────────────────────┤
│
│  MULTI-UNIT SELLING (Optional)
│  ───────────────────────────────────────────────────
│
│  ✓ Unit 1: Piece
│    ├─ Conversion: 1 pcs
│    └─ Price: MWK 25.00
│
│  ✓ Unit 2: Dozen
│    ├─ Conversion: 12 pcs
│    └─ Price: MWK 270.00
│
│  ✓ Unit 3: Carton
│    ├─ Conversion: 48 pcs
│    └─ Price: MWK 1,080.00
│
│  [+ ADD UNIT]
│
│  [<< BACK]                          [NEXT: PRICING >>]
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  ADD PRODUCT                                    [X]  │
├──────────────────────────────────────────────────────┤
│ [BASIC] [VARIATIONS] [UNITS] [PRICING] [STOCK]      │
├──────────────────────────────────────────────────────┤
│
│  PRICING
│  ───────────────────────────────────────────────────
│
│  Apply to: [All Variations ▼]
│
│  Retail Price * MWK [_______] ← Base price
│  Wholesale Price   MWK [_______] ← Bulk price
│  Cost Price        MWK [_______] ← For reporting
│
│  NOTE: Can override per variation in VARIATIONS tab
│
│  [<< BACK]                           [NEXT: STOCK >>]
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  ADD PRODUCT                                    [X]  │
├──────────────────────────────────────────────────────┤
│ [BASIC] [VARIATIONS] [UNITS] [PRICING] [STOCK]      │
├──────────────────────────────────────────────────────┤
│
│  STOCK & TRACKING
│  ───────────────────────────────────────────────────
│
│  ☑ Track Inventory? (recommended)
│
│  Low Stock Threshold
│  [_____] (Alert when below this)
│
│  Opening Stock
│  Outlet [Select Outlet ▼] Main Store
│  Quantity [______] pcs
│
│  [+ ADD TO ANOTHER OUTLET]
│
│  [<< BACK]                          [SAVE PRODUCT]
└──────────────────────────────────────────────────────┘
```

---

## 3️⃣ Import Products Modal - STEP-BY-STEP WIZARD

### STEP 1: Download Template
```
┌──────────────────────────────────────────────────────┐
│  IMPORT PRODUCTS                              [X]    │
├──────────────────────────────────────────────────────┤
│
│  Business Type: Wholesale & Retail (set from profile)
│
│  STEP 1 of 3: Download Template
│  ─────────────────────────────────────────────────
│
│  1. Download our template with all required fields:
│
│     Fields needed for your business type:
│     ✓ product_name       (REQUIRED)
     ✓ retail_price       (REQUIRED)
     □ unit_name          (optional - bottle, case, kg, pcs)
     □ conversion_factor  (optional - for multi-unit products)
     □ wholesale_price    (optional - bulk pricing)
     □ category           (optional - for organization)
     □ cost               (optional - for margins)
     □ batch_expiry_date  (optional - stock receive date)
     □ initial_stock_qty  (optional - opening inventory)
     □ outlet             (optional - location)
     □ low_stock_threshold (optional - reorder point)
│
│  [DOWNLOAD EXCEL TEMPLATE]
│
│  2. Fill in your product data
│  3. Import the file
│
│  [NEXT >>]
└──────────────────────────────────────────────────────┘
```

### STEP 2: Select File & Preview
```
┌──────────────────────────────────────────────────────┐
│  IMPORT PRODUCTS                              [X]    │
├──────────────────────────────────────────────────────┤
│
│  STEP 2 of 3: Upload File & Verify
│  ─────────────────────────────────────────────────
│
│  [UPLOAD FILE] or Drag file here
│
│  📄 my-products.xlsx (12.3 KB) ✓ Valid
│
│  PREVIEW (First 3 rows):
│  ┌──────────────┬────────┬────────────┬────────────┐
│  │ product_name │ price  │ category   │ wholesale_ │
│  │              │        │            │ price      │
│  ├──────────────┼────────┼────────────┼────────────┤
│  │ Coca Cola    │ 25.00  │ Beverages  │ 20.00      │
│  │ Fanta        │ 20.00  │ Beverages  │ 18.00      │
│  │ Beer         │ 15.00  │ Alcoholic  │ 12.00      │
│  └──────────────┴────────┴────────────┴────────────┘
│
│  Total rows found: 152 products
│  ⚠️  3 rows have missing required fields
│
│  [<< BACK]                            [NEXT >>]
└──────────────────────────────────────────────────────┘
```

### STEP 3: Confirm & Import
```
┌──────────────────────────────────────────────────────┐
│  IMPORT PRODUCTS                              [X]    │
├──────────────────────────────────────────────────────┤
│
│  STEP 3 of 3: Confirm Import
│  ─────────────────────────────────────────────────
│
│  Ready to import:
│  • 152 new products
│  • 0 products to update
│  • 3 products skipped (missing fields)
│
│  Skipped products:
│  ├─ Row 5: "Sprite" (missing price)
│  ├─ Row 12: "Juice" (missing product_name)
│  └─ Row 47: "Wine" (missing price)
│
│  Target Outlet: [Main Store ▼] (for stock quantities)
│
│  Options:
│  ☑ Create categories if missing
│  ☑ Create variations if names provided
│  ☑ Create units if names provided
│  ☑ Auto-track inventory if quantities provided
│
│  [<< BACK]  [CANCEL]  [IMPORT PRODUCTS >>]
└──────────────────────────────────────────────────────┘
```

### STEP 4: Results
```
┌──────────────────────────────────────────────────────┐
│  IMPORT PRODUCTS                              [X]    │
├──────────────────────────────────────────────────────┤
│
│  IMPORT COMPLETE ✓
│  ─────────────────────────────────────────────────
│
│  ✓ 152 products imported successfully
│  ⚠️  3 products skipped (invalid data)
│  ℹ️  Created 8 new categories
│  ℹ️  Created 24 variations
│  ℹ️  Created 12 units
│
│  Summary:
│  ├─ New Products: 152
│  ├─ Updated Products: 0
│  ├─ New Categories: 8
│  ├─ New Variations: 24
│  └─ New Units: 12
│
│  Skipped:
│  ├─ Row 5: Missing price
│  ├─ Row 12: Missing product name
│  └─ Row 47: Invalid price format
│
│  [DOWNLOAD ERROR REPORT]
│
│  [CLOSE] [VIEW PRODUCTS]
└──────────────────────────────────────────────────────┘
```

---

## 4️⃣ Products List - DETAILED VIEW

### Current
```
┌─────────────────────────────────────────────────────────┐
│ Products                                          [+NEW] │
├─────────────────────────────────────────────────────────┤
│ Search: ________________  Category: [All▼]  [IMPORT]   │
├──────────┬──────────┬────────────┬─────────────────────┤
│ Product  │ Category │ Variations │ Actions             │
├──────────┼──────────┼────────────┼─────────────────────┤
│ Coca Cola│ Beverage │ 3          │ [EDIT] [DELETE]    │
│ Fanta    │ Beverage │ 2          │ [EDIT] [DELETE]    │
│ Beer     │ Alcohol  │ 1          │ [EDIT] [DELETE]    │
└──────────┴──────────┴────────────┴─────────────────────┘
```

### Updated (With stock & units)
```
┌─────────────────────────────────────────────────────────────────┐
│ Products                                         [+NEW][IMPORT]  │
├─────────────────────────────────────────────────────────────────┤
│ Search: ________________  Category: [All▼]  Business: [All▼]   │
├──────────┬──────────┬────────────┬──────────────┬───────────────┤
│ Product  │ Category │ Variations │ Stock Status │ Actions       │
├──────────┼──────────┼────────────┼──────────────┼───────────────┤
│ Coca     │ Beverage │ 3 variants │ 🟢 156 dozen │ [EDIT]        │
│ Cola     │          │            │ (1,872 pcs)  │ [DUPLICATE]   │
│          │          │            │              │ [DELETE]      │
├──────────┼──────────┼────────────┼──────────────┼───────────────┤
│ Fanta    │ Beverage │ 2 variants │ 🟡 25 units  │ [EDIT]        │
│          │          │            │ (LOW)        │ [DUPLICATE]   │
│          │          │            │              │ [DELETE]      │
├──────────┼──────────┼────────────┼──────────────┼───────────────┤
│ Beer     │ Alcohol  │ 1 variant  │ 🔴 0 units   │ [EDIT]        │
│          │          │            │ (OUT)        │ [DUPLICATE]   │
│          │          │            │              │ [DELETE]      │
└──────────┴──────────┴────────────┴──────────────┴───────────────┘

Legend:
🟢 = Good stock (>50% of threshold)
🟡 = Low stock (<50% of threshold)
🔴 = Critical (<10% of threshold or 0)
```

---

## 5️⃣ POS Product Selection Flow

### When cashier selects product
```
USER CLICKS: "Coca Cola"
        ↓
┌──────────────────────────────────────────┐
│   SELECT VARIATIONS & UNITS               │
├──────────────────────────────────────────┤
│                                          │
│ PRODUCT: Coca Cola                       │
│                                          │
│ SELECT SIZE:                             │
│ ○ 500ml Bottle                           │
│ ○ 1L Bottle     ← (default selected)     │
│ ○ 2L Bottle                              │
│                                          │
│ SELECT UNIT:                             │
│ ○ 🔹 Piece     MWK 25                   │
│ ○ 📦 Dozen     MWK 270 (12 pcs)         │
│ ☑ 📫 Carton    MWK 1,080 (48 pcs)       │
│                                          │
│ QUANTITY:                                │
│ [−] 2 [+]     (max: 25 cartons avail)   │
│                                          │
│ SUBTOTAL: MWK 2,160                      │
│                                          │
│ [CANCEL]              [ADD TO CART]      │
└──────────────────────────────────────────┘
        ↓
    ADDED TO CART:
    
    2 × Coca Cola (1L Carton)
    @ MWK 1,080 each
    = MWK 2,160 subtotal
    
    (Note on receipt: "2 cartons = 96 pieces")
```

---

## 6️⃣ Stock Display - Color Coding

```
STOCK LEVEL INDICATOR
┌─────────────────────────────────────────────────┐
│ Product: Coca Cola - 500ml                      │
├─────────────────────────────────────────────────┤
│                                                 │
│ STOCK:  156 dozen (1,872 pieces)                │
│ UNIT:   pcs (pieces)                            │
│ LOCATION: Main Store                            │
│ THRESHOLD: 20 dozen (240 pcs)                   │
│ STATUS:  🟢 HEALTHY (156 > 20)                  │
│                                                 │
│ BATCHES:                                        │
│ ├─ Batch COKE-001-2026-01: 100 dozen           │
│ │  Expires: 2026-06-15 (170 days remaining)    │
│ ├─ Batch COKE-002-2026-01: 50 dozen            │
│ │  Expires: 2026-08-20 (206 days remaining)    │
│ └─ Batch COKE-003-2026-02: 6 dozen             │
│    Expires: 2026-03-01 (34 days remaining)     │
│                                                 │
└─────────────────────────────────────────────────┘

CRITICAL STOCK
┌─────────────────────────────────────────────────┐
│ Product: Beer - Bottle                          │
├─────────────────────────────────────────────────┤
│                                                 │
│ STOCK:  2 units (2 pieces)                      │
│ UNIT:   pcs (pieces)                            │
│ LOCATION: Bar 1                                 │
│ THRESHOLD: 50 pieces                            │
│ STATUS:  🔴 CRITICAL (2 < 50)                   │
│                                                 │
│ ACTION NEEDED: Reorder soon                     │
│                                                 │
│ [QUICK REORDER] [VIEW SUPPLIER]                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 7️⃣ Export Feature

### Export Options
```
┌─────────────────────────────────────────────────┐
│  EXPORT PRODUCTS                          [X]   │
├─────────────────────────────────────────────────┤
│                                                 │
│  Business Type: Wholesale & Retail             │
│                                                 │
│  EXPORT FORMAT:                                 │
│  ○ Excel (.xlsx)                               │
│  ○ CSV (.csv) ← (default - safe for all)       │
│                                                 │
│  INCLUDE:                                       │
│  ☑ All fields                                   │
│  ☑ Stock levels                                 │
│  ☑ Batch information                            │
│  ☑ Current prices                               │
│                                                 │
│  FILTER:                                        │
│  Category: [All Categories ▼]                   │
│  Status:   [Active & Inactive ▼]                │
│  Outlet:   [All Locations ▼]                    │
│                                                 │
│  RESULT:                                        │
│  Found: 252 products                            │
│  Estimated size: 2.5 MB                         │
│                                                 │
│ [CANCEL]                        [EXPORT NOW]   │
└─────────────────────────────────────────────────┘
```

---

## 8️⃣ Validation Error Display

### During Import
```
┌─────────────────────────────────────────────────┐
│  IMPORT VALIDATION ERRORS                       │
├─────────────────────────────────────────────────┤
│                                                 │
│  Row 5: "Sprite"                               │
│  ❌ Price is required                          │
│  💡 Tip: Add price in "price" column           │
│                                                 │
│  Row 12: "Juice"                               │
│  ❌ Product name is required                   │
│  ❌ Price is required                          │
│                                                 │
│  Row 47: "Wine"                                │
│  ⚠️  Price format invalid (use numbers only)   │
│  💡 Example: 25.00 (not "MWK 25" or "$25")     │
│                                                 │
│  Row 89: "Water"                               │
│  ⚠️  Barcode "12345" too short (10+ digits)    │
│  ℹ️  Hint: Use full EAN/UPC barcode            │
│                                                 │
│  [DOWNLOAD CORRECTED TEMPLATE]                 │
│  [DOWNLOAD ERROR REPORT]                        │
│                                                 │
│  [BACK]
└─────────────────────────────────────────────────┘
```

---

## Implementation Checklist

For each component update:

```
□ Research current file (read existing code)
□ Plan tab/section structure
□ Define field groupings
□ Create validation rules
□ Design error handling
□ Plan state management
□ Consider mobile responsiveness
□ Add loading states
□ Add success/error feedback
□ Test with sample data
□ Verify field visibility per business type
□ Test import/export round-trip
□ Verify calculations (price per unit, etc.)
□ Document field purposes
□ Get stakeholder review
```

---

**Ready to implement?** Start with Product Modal tabs, then Product Grid units selector, then Import wizard.

