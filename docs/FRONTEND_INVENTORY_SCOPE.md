# Frontend Inventory & Product Management Scope

**Date:** January 26, 2026  
**Status:** Discovery & Planning Phase  
**Focus:** UI/UX for inventory management across business types

---

## 🎯 Executive Overview

The frontend inventory system manages product data across **4 distinct business types** with unique requirements. We need to:

1. **Display products** with multiple units for cashier selection
2. **Handle import/export** with business-specific field validation
3. **Show inventory** differently based on business type
4. **Manage units** (piece, box, carton, ml, kg, etc.)
5. **Display stock levels** with visual indicators

---

## 📁 Frontend Structure

```
frontend/
├── app/
│   ├── dashboard/
│   │   ├── inventory/
│   │   │   ├── products/
│   │   │   │   ├── page.tsx              (Product overview)
│   │   │   │   ├── items/
│   │   │   │   │   └── page.tsx          (Product list with variations)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx          (Product details)
│   │   │   ├── stock-control/            (Stock management)
│   │   │   ├── stock-taking/             (Physical counts)
│   │   │   ├── expiry/                   (Expiry tracking)
│   │   │   ├── low-stock/                (Low stock alerts)
│   │   │   └── suppliers/                (Supplier management)
│   │   └── pos/
│   │       ├── bar/page.tsx
│   │       ├── retail/page.tsx
│   │       ├── restaurant/page.tsx
│   │       └── wholesale/page.tsx
│   │
│   └── admin/pos/
│       ├── bar/
│       ├── retail/
│       ├── restaurant/
│       └── wholesale/
│
├── components/
│   ├── modals/
│   │   ├── add-edit-product-modal.tsx    (Product creation/editing)
│   │   ├── import-products-modal.tsx     (Bulk import)
│   │   ├── add-edit-variation-modal.tsx  (Variation management)
│   │   └── outlet-selection-modal.tsx    (Multi-outlet selection)
│   │
│   └── pos/
│       ├── product-grid.tsx              (Product display for POS)
│       ├── bar-pos.tsx                   (Bar-specific POS)
│       ├── retail-pos.tsx                (Retail-specific POS)
│       ├── restaurant-pos.tsx            (Restaurant-specific POS)
│       ├── single-product-pos.tsx        (Single product variant selector)
│       └── cart-panel.tsx                (Shopping cart)
│
└── lib/
    ├── services/
    │   ├── productService.ts             (API calls for products)
    │   └── inventoryService.ts           (API calls for inventory)
    │
    ├── utils/
    │   └── excel-import-fields.ts        (Field definitions per business type)
    │
    ├── types/
    │   └── product.ts                    (Type definitions)
    │
    └── hooks/
        ├── useBusinessStore.ts           (Business context)
        └── useTenant.ts                  (Tenant context)
```

---

## 🏪 Business Types & Inventory Handling

### **1. Wholesale & Retail**
```
Purpose: Sell to both wholesale buyers (bulk) and retail customers
├─ Pricing: 2 levels (wholesale_price, retail_price)
├─ Units: Piece, Box, Dozen, Carton, etc.
├─ Stock: Track per-variation, per-outlet
├─ Display: Grid with price tiers
└─ Import Fields:
    • product_name ✓ REQUIRED
    • price ✓ REQUIRED
    • cost
    • wholesale_price (wholesale level)
    • variation_name (size, pack, etc.)
    • variation_sku
    • variation_barcode
    • track_inventory (Yes/No)
    • quantity (per outlet)
    • outlet (location)
    • unit (piece, box, dozen, carton)
    • low_stock_threshold
    • category
    • is_active
```

### **2. Bar**
```
Purpose: Sell drinks with recipes and mixed items
├─ Pricing: Single price per drink/item
├─ Units: Glass, Bottle, ml, Liter
├─ Stock: Track per-variation, per-outlet
├─ Display: Category-based (Beers, Spirits, Mixers, etc.)
├─ Features: Recipes, Ingredients, Cost calculation
└─ Import Fields:
    • product_name ✓ REQUIRED
    • category (Beer, Spirit, Mixer, Wine, etc.)
    • price ✓ REQUIRED
    • cost
    • variation_name (bottle size, type)
    • variation_sku
    • unit (glass, bottle, ml, liter)
    • track_inventory
    • quantity (per outlet)
    • outlet
    • low_stock_threshold
    • alcohol_volume (ABV %)
    • is_active
```

### **3. Restaurant**
```
Purpose: Prepare and serve dishes with ingredients
├─ Pricing: Single price per dish
├─ Units: Portion, Unit, etc.
├─ Stock: Ingredient tracking, not finished goods
├─ Display: Menu categories (Appetizers, Mains, Desserts, etc.)
├─ Features: Recipes with ingredients, Prep instructions
└─ Import Fields:
    • product_name ✓ REQUIRED (dish name)
    • category (Appetizers, Mains, Desserts, etc.)
    • price ✓ REQUIRED
    • description (dish description)
    • preparation_time
    • is_ingredient (Yes/No - track separately)
    • ingredient_unit (for ingredient tracking)
    • track_inventory
    • is_active
```

### **4. Single Location/Basic**
```
Purpose: Small store with single outlet
├─ Pricing: Basic single price
├─ Units: Standard (pcs, ml, kg)
├─ Stock: Simple inventory tracking
├─ Display: Grid/List view
└─ Import Fields:
    • product_name ✓ REQUIRED
    • price ✓ REQUIRED
    • cost
    • track_inventory
    • quantity
    • unit (pcs, ml, kg)
    • low_stock_threshold
    • is_active
```

---

## 📊 Product Data Structure (Current)

```typescript
// Backend Model: Product + ItemVariation + ProductUnit
{
  // Product (Master)
  id: number
  tenant_id: number
  outlet_id: number
  name: string                    // "Coca Cola"
  sku: string                     // "COKE-MAIN"
  barcode: string
  category_id: number
  retail_price: number            // Main price
  cost: number
  wholesale_price: number         // Wholesale tier
  image: string | null
  description: string
  created_at: datetime
  updated_at: datetime

  // ItemVariation (Size/flavor variations)
  variations: [
    {
      id: number
      product_id: number
      name: string                // "500ml Bottle"
      sku: string                 // "COKE-500ML"
      barcode: string             // "1234567890"
      price: number               // 25.00 (variation price)
      cost: number
      unit: "pcs" | "ml" | "kg" | "box" | "bottle"
      track_inventory: boolean
      low_stock_threshold: number
      
      // Stock per location
      location_stocks: [
        {
          outlet_id: number
          outlet_name: string
          quantity: number        // Current stock
          available_quantity: number  // Non-expired
        }
      ]
      
      // Batches (with expiry)
      batches: [
        {
          batch_number: string
          quantity: number
          expiry_date: date
          cost_price: number
        }
      ]
    }
  ]

  // ProductUnit (Multi-unit selling)
  units: [
    {
      id: number
      unit: "piece" | "box" | "dozen" | "carton"
      conversion_factor: number   // How many pieces in this unit
      retail_price: number
      wholesale_price: number
    }
  ]
}
```

---

## 🛒 POS Display: Multi-Unit Selection

### **Current Challenge:**
When cashier selects a product, they need to see:
1. ✓ Product name
2. ✓ Available units to sell in (piece, box, dozen, carton)
3. ✓ Price for each unit type
4. ✓ Current stock level
5. ❓ Which unit is being selected?
6. ❓ How to display "1 box = 12 pieces"?

### **Example Flow:**

```
PRODUCT: "Coca Cola"
├─ VARIATIONS:
│   ├─ 500ml Bottle
│   ├─ 1L Bottle
│   └─ 2L Bottle
│
└─ UNITS (for any variation):
    ├─ 🔹 Piece: MWK 25 (stock: 1200 pcs)
    ├─ 📦 Dozen (12 pieces): MWK 270 (stock: 100 dozen)
    ├─ 📫 Carton (48 pieces): MWK 1,080 (stock: 25 cartons)
    └─ 🚛 Pallet (500 pieces): MWK 11,250 (stock: 2 pallets)
```

**What's missing in frontend:**
- Product detail modal doesn't show units
- Cart doesn't indicate which unit was selected
- Receipt doesn't show conversion (e.g., "2 dozen = 24 pieces")

---

## 📥 Import/Export Functionality

### **Current Structure:**

**File:** `frontend/lib/utils/excel-import-fields.ts`

Defines per-business-type fields:
- ✓ Universal fields (all business types)
- ✓ Wholesale-specific fields
- ✓ Bar-specific fields
- ✓ Restaurant-specific fields
- ✓ Required vs Optional fields

**Key Fields by Business Type:**

#### Wholesale & Retail
```
REQUIRED:
  • product_name
  • price

OPTIONAL:
  • category
  • variation_name (for sizes)
  • variation_sku
  • variation_barcode
  • cost
  • wholesale_price
  • unit (piece, box, dozen)
  • track_inventory (Yes/No)
  • quantity (opening stock)
  • outlet (location)
  • low_stock_threshold
  • description
  • is_active (Yes/No)
  • sort_order
```

#### Bar
```
REQUIRED:
  • product_name
  • price

OPTIONAL:
  • category (Beer, Spirit, Wine, Mixer)
  • variation_name (Bottle, Draft, etc.)
  • cost
  • unit (glass, bottle, ml, liter)
  • track_inventory
  • quantity (per outlet)
  • outlet
  • low_stock_threshold
  • alcohol_volume (for tracking)
  • is_active
```

#### Restaurant
```
REQUIRED:
  • product_name (dish name)
  • price

OPTIONAL:
  • category (Menu section)
  • description (dish description)
  • preparation_time (minutes)
  • is_ingredient (ingredient vs dish)
  • ingredient_unit (if ingredient)
  • cost (estimated recipe cost)
  • is_active
```

---

## 🔍 Frontend Components Needing Updates

### **1. Product Grid (POS Display)**
**File:** `components/pos/product-grid.tsx`

**Current:**
```tsx
interface Product {
  id: string
  name: string
  price: number        // Single price
  barcode: string
  sku: string
  stock: number        // Simple number
}
```

**Needed Changes:**
- Add `variations` array with multiple options
- Add `units` array for multi-unit pricing
- Add `selectedVariation` state
- Add `selectedUnit` state
- Display unit selector in product card
- Show "1 dozen = 12 pcs" conversion info
- Show stock per unit

**Updated Interface:**
```tsx
interface ProductVariation {
  id: string
  name: string                    // "500ml"
  price: number
  cost: number
  sku: string
  barcode: string
  unit: string                    // "ml", "pcs", etc.
  stock: number
  availableStock: number
}

interface ProductUnit {
  id: string
  name: string                    // "Dozen"
  conversionFactor: number        // 12
  retailPrice: number
  wholesalePrice?: number
}

interface Product {
  id: string
  name: string
  description?: string
  category?: string
  image?: string
  variations: ProductVariation[]
  units: ProductUnit[]
  track_inventory: boolean
  active: boolean
}
```

---

### **2. Add/Edit Product Modal**
**File:** `components/modals/add-edit-product-modal.tsx`

**Needs:**
- Separate tabs/sections for:
  - Basic info (name, category, description)
  - Variations (sizes, flavors)
  - Units (piece, box, dozen, carton)
  - Pricing (retail/wholesale per variation + unit)
  - Stock (initial quantity per location)
  - Business-specific fields

**Field Organization by Section:**
```
📝 BASIC INFORMATION
  ├─ Product Name *REQUIRED
  ├─ Category
  ├─ SKU
  ├─ Barcode
  └─ Description

📦 VARIATIONS (Optional)
  ├─ Variation Name (e.g., "500ml", "Large", "Red")
  ├─ Variation SKU
  ├─ Variation Barcode
  ├─ Unit of Measurement
  └─ [Add Variation] button

💵 PRICING (per variation)
  ├─ Retail Price *REQUIRED
  ├─ Cost Price
  └─ Wholesale Price (if applicable)

🏭 UNITS (Multi-unit selling)
  ├─ Unit Name (e.g., "Dozen", "Carton")
  ├─ Conversion Factor (e.g., 12 pcs)
  ├─ Retail Price per Unit
  ├─ Wholesale Price per Unit
  └─ [Add Unit] button

📊 STOCK TRACKING
  ├─ Track Inventory? (Yes/No)
  ├─ Low Stock Threshold
  ├─ Outlet Location (dropdown if multi-outlet)
  └─ Opening Quantity

🏷️ BUSINESS-SPECIFIC
  ├─ [BAR] Alcohol Volume (ABV %)
  ├─ [BAR] Category (Beer, Spirit, Wine, etc.)
  ├─ [RESTAURANT] Preparation Time
  ├─ [RESTAURANT] Is Ingredient? (Yes/No)
  └─ [WHOLESALE] Wholesale Tier Price
```

---

### **3. Import Products Modal**
**File:** `components/modals/import-products-modal.tsx`

**Current Issues:**
- Field labels hard to understand
- Import template doesn't show column order clearly
- Validation errors not specific enough
- No business-type specific guidance

**Needed Changes:**
- Show field descriptions clearly
- Group fields by section in download template
- Validate column headers before import
- Show validation errors per row
- Display field mapping interface
- Add "Edit Field Names" before import

**Template Structure:**
```
[UNIVERSAL FIELDS]
Product Name | Category | Description

[VARIATION FIELDS]
Variation Name | Variation SKU | Variation Barcode | Unit

[PRICING FIELDS]
Price | Cost | Wholesale Price*

[STOCK FIELDS]
Track Inventory | Quantity | Outlet | Low Stock Threshold

[BUSINESS-SPECIFIC]
For Bar: Alcohol Volume, Category
For Restaurant: Prep Time, Is Ingredient
For Wholesale: Wholesale Price (different column)
```

---

### **4. Product List/Items Page**
**File:** `app/dashboard/inventory/products/items/page.tsx`

**Current:**
- Shows product list with variation counts
- Can add/edit/delete products
- Can import products

**Needed:**
- Show stock levels per variation per outlet
- Color-code low stock items
- Show unit conversion info (e.g., "12 pcs = 1 dozen")
- Filter by business type specific fields
- Export with business-specific fields
- Bulk edit units/pricing

---

### **5. POS Variations Selector**
**File:** `components/pos/single-product-pos.tsx`

**When cashier clicks a product in POS:**
1. Show all variations (if any)
2. For each variation, show available units
3. Select variation + unit + quantity
4. Add to cart with correct pricing

**Example Dialog:**
```
🛒 SELECT PRODUCT OPTIONS

VARIATION:
  ○ 500ml Bottle
  ○ 1L Bottle (SELECTED)
  ○ 2L Bottle

UNIT & PRICING:
  □ Individual: MWK 25 each
  ☑️ Dozen (12 pcs): MWK 270
  □ Carton (48 pcs): MWK 1,080

QUANTITY:
  [+] 2 [−]
  (Available: 156 dozen = 1,872 pieces)

[CANCEL] [ADD TO CART: MWK 540]
```

---

## 📋 Data Fields - Organized by Business Type

### **All Business Types**

| Field | Type | Required | Display | Notes |
|-------|------|----------|---------|-------|
| Product Name | Text | ✓ | Grid, Card, Receipt | Max 50 chars |
| Category | Select | | Filter, Organize | Auto-create if missing |
| Description | Text | | Product detail modal | Optional flavor text |
| SKU | Text | | Back-office only | For inventory tracking |
| Barcode | Text | | Scanner input | For quick lookup |
| Is Active | Boolean | | Filter | Show/hide from POS |
| Track Inventory | Boolean | | Stock display | Yes/No |
| Low Stock Threshold | Number | | Alerts | Optional threshold |
| Cost | Decimal | | Reports | For margin calculation |

### **Variations (Per Product)**

| Field | Type | Required | Display | Notes |
|-------|------|----------|---------|-------|
| Variation Name | Text | | Product selector | e.g., "500ml", "Large" |
| Variation SKU | Text | | Back-office | Unique per variation |
| Variation Barcode | Text | | Scanner | For quick lookup |
| Unit | Select | | Stock/Cart | pcs, ml, kg, box, etc. |
| Price | Decimal | ✓ | Grid, POS, Receipt | Variation-specific |
| Cost | Decimal | | Reports | Variation-specific |

### **Units (Multi-Unit Selling)**

| Field | Type | Required | Display | Notes |
|-------|------|----------|---------|-------|
| Unit Name | Text | ✓ | Selector | e.g., "Dozen", "Carton" |
| Conversion Factor | Number | ✓ | Info text | "12 pieces" |
| Retail Price | Decimal | ✓ | POS | Price for this unit |
| Wholesale Price | Decimal | | POS | If applicable |
| Is Active | Boolean | | Filter | Hide unused units |

### **Stock (Per Outlet)**

| Field | Type | Required | Display | Notes |
|-------|------|----------|---------|-------|
| Outlet | Select | | Multi-outlet | Location selector |
| Quantity | Number | | Stock badge | Current quantity |
| Low Stock Threshold | Number | | Alert | Visual indicator |
| Last Recount | Date | | Back-office | Audit trail |

### **Business-Specific Fields**

**Bar Only:**
- Alcohol Volume (ABV %)
- Bar Category (Beer/Spirit/Wine/Mixer/Non-Alcoholic)
- Recipe/Ingredients (separate system)

**Restaurant Only:**
- Preparation Time (minutes)
- Is Ingredient? (Yes/No)
- Ingredient Unit (for recipes)
- Menu Category (Appetizer/Main/Dessert/etc.)

**Wholesale Only:**
- Wholesale Price Tier (different from retail)
- Minimum Order Quantity
- Bulk Discount Tiers

---

## 🔌 API Integration Points

### **Products Service**
```typescript
productService.getProducts(tenant, outlet, businessType)
productService.createProduct(productData)
productService.updateProduct(id, productData)
productService.deleteProduct(id)

productService.getVariations(productId)
productService.addVariation(productId, variationData)
productService.updateVariation(variationId, variationData)

productService.getUnits(productId)
productService.addUnit(productId, unitData)
productService.updateUnit(unitId, unitData)

productService.importProducts(file, businessType, outlet)
productService.exportProducts(businessType, outlet)
```

### **Inventory Service**
```typescript
inventoryService.getStockLevels(variation, outlet)
inventoryService.getAvailableStock(variation, outlet)
inventoryService.getBatches(variation, outlet)
inventoryService.deductStock(variation, outlet, quantity)
inventoryService.addStock(variation, outlet, quantity, batch)
```

---

## 🎨 UI/UX Improvements Needed

### **1. Product Grid in POS**
- [ ] Show selected variation + unit visually
- [ ] Display "MWK X per piece / Y per dozen" format
- [ ] Add stock status color indicator
- [ ] Show selected unit type in product card

### **2. Product Modal**
- [ ] Use tabs instead of scrolling sections
- [ ] Show validation errors inline
- [ ] Preview import template before download
- [ ] Drag-to-reorder variations/units

### **3. Stock Display**
- [ ] Show per-unit stock (e.g., "156 dozen" not just "1872 pcs")
- [ ] Color-code: Green (adequate), Yellow (low), Red (critical)
- [ ] Show expiry dates for tracked items
- [ ] Mini batch list in stock view

### **4. Import Process**
- [ ] Step-by-step wizard
- [ ] Validate file before upload
- [ ] Show data preview before importing
- [ ] Display success/error summary

---

## 🚀 Implementation Priority

### **Phase 1: Foundation** (Week 1)
1. Update Product data structures for variations + units
2. Update Product modal to handle variations + units
3. Update POS grid to show units in selector

### **Phase 2: Import/Export** (Week 2)
1. Enhance import modal with field grouping
2. Add import validation per business type
3. Add export with business-specific fields

### **Phase 3: Stock Display** (Week 3)
1. Show stock per unit (dozen, carton, etc.)
2. Add stock level color indicators
3. Show batch/expiry info in stock view

### **Phase 4: POS UX** (Week 4)
1. Improved product selection flow
2. Show unit conversion in cart
3. Display conversion on receipt

---

## 📝 Field Mapping Summary

**Create a reference document showing:**
- Each field's exact name (as it appears in code)
- Display label (as seen by user)
- Where it appears in UI
- Validation rules
- Business types that use it

Example:
```
Field: variation_name
Display: "Variation Name" (e.g., "500ml")
Location: Product modal → Variations section
Validation: Max 50 chars, unique per product
Business Types: All
```

---

## ✅ Validation Rules by Field

| Field | Validation | Error Message |
|-------|-----------|---------------|
| Product Name | Required, Max 50 chars | "Product name required" |
| Price | Required, Decimal, >0 | "Price must be > 0" |
| Cost | Decimal, ≤ Price | "Cost must be ≤ price" |
| Variation SKU | Unique per product | "SKU already exists" |
| Barcode | Format validation | "Invalid barcode format" |
| Conversion Factor | Integer, >0 | "Must be > 0" |
| Quantity | Integer, ≥0 | "Must be ≥ 0" |
| Low Stock Threshold | Integer, ≥0 | "Must be ≥ 0" |

---

## 🎯 Success Criteria

- [ ] All 4 business types display products correctly
- [ ] Multi-unit selection works in POS
- [ ] Import validates field names per business type
- [ ] Stock shows per-unit quantities
- [ ] Cashier workflow is smooth and fast
- [ ] Export template matches frontend exactly
- [ ] Batch operations work (add multiple at once)
- [ ] Error messages are clear and actionable

---

**Ready to start building?** Each section above can be a separate development task.
