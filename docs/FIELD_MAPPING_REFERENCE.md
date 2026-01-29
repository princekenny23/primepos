# Field Mapping Reference - Frontend Inventory

**Quick lookup for all inventory-related fields across business types**

---

## 📍 Where Each Field Lives

### **Product Master Fields** (Top level)

| Frontend Label | Code Name | Type | Display | Business Types |
|---|---|---|---|---|
| Product Name | `product_name` or `name` | Text | Grid, POS, Receipt | All |
| Category | `category` | Select | Filter, Organization | All |
| SKU | `sku` | Text | Barcode scanners | All |
| Barcode | `barcode` | Text | Scanner, Reports | All |
| Description | `description` | Text | Product detail modal | All |
| Retail Price | `retail_price` or `price` | Decimal | POS, Cart, Receipt | All |
| Cost Price | `cost` | Decimal | Reports, Margins | All |
| Wholesale Price | `wholesale_price` | Decimal | POS (wholesale) | Wholesale only |
| Image | `image` | File | Grid, POS | All (optional) |
| Is Active | `is_active` or `active` | Boolean | Filter, Display | All |
| Track Inventory | `track_inventory` | Boolean | Stock control | All |
| Created At | `created_at` | DateTime | Admin only | All |
| Updated At | `updated_at` | DateTime | Admin only | All |

---

## 🔀 Variation Fields (Per Product)

| Frontend Label | Code Name | Type | Display | Notes |
|---|---|---|---|---|
| Variation Name | `variation_name` | Text | Product selector | E.g., "500ml", "Large", "Red" |
| Variation SKU | `variation_sku` | Text | Barcode scanner | Unique per variation |
| Variation Barcode | `variation_barcode` | Text | Scanner lookup | Individual barcode |
| Unit | `unit` | Select | Stock/Cart/Receipt | pcs, ml, kg, l, g, box, bottle |
| Price | `price` (in variation) | Decimal | POS display | Can override product price |
| Cost | `cost` (in variation) | Decimal | Reports | Can override product cost |
| Low Stock Threshold | `low_stock_threshold` | Integer | Alerts, Badges | Visual warning |
| Track Inventory | `track_inventory` | Boolean | Control | Inherit from product if not set |

---

## 📦 Unit Fields (Multi-Unit Selling)

| Frontend Label | Code Name | Type | Display | Example |
|---|---|---|---|---|
| Unit Name | `name` or `unit_name` | Text | Dropdown in POS | "Dozen", "Carton", "Case" |
| Conversion Factor | `conversion_factor` | Integer | Info text | "12 pcs", "48 pcs", "500 ml" |
| Retail Price | `retail_price` or `price` | Decimal | POS selector | Price for selected unit |
| Wholesale Price | `wholesale_price` | Decimal | POS selector | Bulk price (if applicable) |
| Is Active | `is_active` | Boolean | Filter | Hide/show in POS |

---

## 🏪 Location/Stock Fields

| Frontend Label | Code Name | Type | Display | Multi-Outlet |
|---|---|---|---|---|
| Outlet | `outlet` or `outlet_id` | Select/FK | Stock view | Required in multi-outlet |
| Quantity | `quantity` | Integer | Stock badge | Total available |
| Available Quantity | `available_quantity` | Integer | Stock badge | Non-expired only |
| Low Stock Threshold | `low_stock_threshold` | Integer | Alert color | Yellow/Red warning |
| Last Counted | `last_counted_at` | DateTime | Admin view | Audit trail |

---

## 🍺 Bar-Specific Fields

| Frontend Label | Code Name | Type | Display | Business Type |
|---|---|---|---|---|
| Category | `category` | Select | Organization | Bar |
| Options: | | | | |
| | "Beer" | | Filter | |
| | "Spirit/Liquor" | | Filter | |
| | "Wine" | | Filter | |
| | "Mixer" | | Filter | |
| | "Non-Alcoholic" | | Filter | |
| Alcohol Volume | `alcohol_volume` or `abv` | Decimal | Reports | Bar (optional) |
| Unit | `unit` | Select | Stock | bottle, glass, ml, liter |
| Recipe/Ingredients | `recipe` or `ingredients` | Text | Prep view | Bar recipes |

---

## 🍽️ Restaurant-Specific Fields

| Frontend Label | Code Name | Type | Display | Business Type |
|---|---|---|---|---|
| Menu Category | `category` | Select | Menu organization | Restaurant |
| Options: | | | | |
| | "Appetizers" | | Menu | |
| | "Main Courses" | | Menu | |
| | "Sides" | | Menu | |
| | "Desserts" | | Menu | |
| | "Beverages" | | Menu | |
| | "Ingredients" | | Internal | |
| Preparation Time | `preparation_time` or `prep_time` | Integer | Kitchen display | Minutes |
| Is Ingredient | `is_ingredient` | Boolean | Control | Used in recipes |
| Ingredient Unit | `ingredient_unit` | Text | Recipes | ml, g, kg, l, pcs |
| Recipe/Instructions | `recipe` or `instructions` | Text | Kitchen display | Prep steps |

---

## 🏪 Wholesale-Specific Fields

| Frontend Label | Code Name | Type | Display | Business Type |
|---|---|---|---|---|
| Wholesale Price | `wholesale_price` | Decimal | POS (two-tier) | Wholesale & Retail |
| Minimum Order Qty | `min_order_qty` | Integer | Order form | Optional constraint |
| Bulk Discount Tier 1 | `bulk_discount_1` | Decimal | Pricing | E.g., 10+ units = 10% off |
| Bulk Discount Tier 2 | `bulk_discount_2` | Decimal | Pricing | E.g., 50+ units = 20% off |

---

## 📊 Import/Export Fields

### **Column Headers in Excel/CSV**

**All Business Types (Universal):**
```
product_name | category | description | variation_name | price | cost | 
variation_sku | variation_barcode | track_inventory | unit | 
low_stock_threshold | outlet | quantity | is_active | sort_order
```

**Wholesale & Retail Add:**
```
wholesale_price | min_order_qty | bulk_discount_1 | bulk_discount_2
```

**Bar Add:**
```
alcohol_volume | bar_category (Beer|Spirit|Wine|Mixer|Non-Alcoholic)
```

**Restaurant Add:**
```
preparation_time | is_ingredient (Yes|No) | ingredient_unit | recipe
```

---

## 🎨 Display Format Reference

### **Stock Display Per Variation**

```
Stock: 156 dozen (1,872 pieces)
     ↑       ↑          ↑
   Quantity Unit    Converted
```

**Code:**
```typescript
// Show: "${quantity} ${unit} (${convertedQuantity} pieces)"
const display = `${batch.quantity} ${unit} (${batch.quantity * conversionFactor} pieces)`
```

### **Pricing Display Per Unit**

```
Dozen: MWK 270 (MWK 22.50 per piece)
     ↑   ↑         ↑
   Unit Price  Breakdown
```

**Code:**
```typescript
// Show: "${unitName}: MWK ${unitPrice} (MWK ${pricePerPiece} per piece)"
const display = `${unit.name}: MWK ${unit.retailPrice} (MWK ${unit.retailPrice / unit.conversionFactor} per piece)`
```

### **Color-Coded Stock Status**

```
Stock Level      Color      Icon      Status
─────────────────────────────────────────────
> Threshold      🟢 Green    ✓        Healthy
= Threshold      🟡 Yellow   ⚠️        Low
< Threshold      🔴 Red      ❌        Critical
= 0              ⚫ Black    🚫        Out of Stock
```

---

## 🔄 Data Transformation Examples

### **When Importing Products**

User provides CSV with these columns:
```csv
product_name,price,variation_name,unit,quantity,outlet
"Coca Cola",25.00,"500ml",pcs,100,"Main Store"
"Coca Cola",25.00,"1L",pcs,50,"Main Store"
"Beer",15.00,"Bottle",bottle,200,"Bar 1"
```

**Transform to:**
```typescript
Product {
  name: "Coca Cola",
  retail_price: 25.00,  // Use first price
  variations: [
    { name: "500ml", unit: "pcs", price: 25.00 },
    { name: "1L", unit: "pcs", price: 25.00 }
  ]
}

// Stock created as:
LocationStock {
  variation: "500ml",
  outlet: "Main Store",
  quantity: 100
}
```

### **When Displaying in POS**

Backend returns:
```json
{
  "id": 1,
  "name": "Coca Cola",
  "variations": [
    {
      "id": 1,
      "name": "500ml",
      "price": 25.00,
      "unit": "pcs",
      "available_quantity": 100
    }
  ],
  "units": [
    {
      "name": "Piece",
      "conversion_factor": 1,
      "retail_price": 25.00
    },
    {
      "name": "Dozen",
      "conversion_factor": 12,
      "retail_price": 270.00
    }
  ]
}
```

**Display as:**
```
Coca Cola - 500ml
├─ 🔹 Piece: MWK 25 (100 available)
├─ 📦 Dozen: MWK 270 (8 available = 96 pieces)
└─ [SELECT]
```

---

## 📋 Required vs Optional - Quick Reference

### **On Product Creation**

| Field | Required | Why |
|-------|----------|-----|
| product_name | ✓ | Can't sell unnamed item |
| price | ✓ | Need to charge something |
| category | | Organization only |
| cost | | Optional (for margins) |
| variation_name | | Only if multiple sizes |
| unit | | Default to "pcs" if blank |
| track_inventory | | Default to "Yes" if blank |
| barcode | | Optional (manual entry) |

### **On Import**

| Field | Required | Behavior |
|-------|----------|----------|
| product_name | ✓ | Skip row if missing |
| price | ✓ | Skip row if missing |
| category | | Auto-create "Uncategorized" |
| variation_name | | Create default variation |
| unit | | Default to "pcs" |
| outlet | | Use first outlet if blank |
| quantity | | Start at 0 if blank |

---

## 🔧 Technical Implementation Notes

### **Frontend State Shape**

```typescript
// Product with all variations + units loaded
interface ProductDisplay {
  id: number
  name: string
  variations: ItemVariation[]      // All sizes/flavors
  units: ProductUnit[]              // All unit types (dozen, carton, etc.)
  category: string
  activeVariation?: ItemVariation   // Currently selected
  activeUnit?: ProductUnit          // Currently selected
  selectedQuantity: number
}

// In cart
interface CartItem {
  product: Product
  variation: ItemVariation
  unit: ProductUnit                 // Which unit type (piece, dozen, carton)
  quantity: number                  // How many units
  subtotal: number                  // Calculated price
}
```

### **POS Flow**

```
1. Cashier clicks product in grid
2. Modal shows variations (if any)
3. Cashier selects variation
4. Modal shows units for that variation
5. Cashier selects unit + quantity
6. Item added to cart with:
   - Product name
   - Variation (e.g., "500ml")
   - Unit type (e.g., "Dozen")
   - Quantity (e.g., 2)
   - Price per unit
   - Subtotal
```

---

## ✅ Checklist for Implementation

When building each component, verify:

- [ ] Product name field always visible and labeled clearly
- [ ] Price field shows what type (retail/wholesale)
- [ ] Variations are optional (single product should work)
- [ ] Units are optional (single unit should work)
- [ ] Stock displays with unit conversion
- [ ] Import validates required fields
- [ ] Export includes all needed fields for business type
- [ ] POS shows clear unit selection
- [ ] Receipt shows unit type (dozen, carton, etc.)
- [ ] Batch operations work (add 10 products at once)
- [ ] Validation is clear and actionable

---

**Last Updated:** January 26, 2026  
**Status:** Ready for development  
**Questions?** See FRONTEND_INVENTORY_SCOPE.md for detailed context
