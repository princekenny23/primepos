# Excel Template Update - UNITS ONLY Architecture

**Date:** February 4, 2026  
**Change:** Removed variation_name field; added receive/batch fields for new architecture

## What Changed

### Removed
- ❌ `variation_name` column (ItemVariation model deleted in migration 0016)
- ❌ Single `Unit` column (merged into new system)
- ❌ Single `Stock` column (replaced with better tracking)

### Added
- ✅ **Unit Name** — Name of the measurement unit (bottle, case, kg, pcs, etc.)
- ✅ **Conversion Factor** — How many base units = this unit (12 = 1 case of 12 bottles)
- ✅ **Wholesale Price** — Separate from retail price for bulk pricing
- ✅ **Initial Stock Qty** — Quantity to receive as opening batch
- ✅ **Batch Expiry Date** — Expiry date for the initial batch (YYYY-MM-DD format)

### Renamed
- `Price` → `Retail Price` (clarity: this is the selling price)
- `Stock` → `Initial Stock Qty` (clarity: this is the opening inventory quantity)

---

## Why These Changes?

### 1. ItemVariation Model Removed
- **Old:** Product → ItemVariation → Batches (3-level hierarchy)
- **New:** Product → Batch directly (2-level hierarchy)
- **Impact:** No more variation_name field; variations are now handled via ProductUnit with conversion factors

### 2. Multi-Unit Support (Units ONLY)
- **ProductUnit System:** Each product can have multiple units
- **Conversion Factor:** Define relationship between units
  - Example: 1 case = 12 bottles
  - When selling "case", system calculates proper inventory deduction
  - Price can vary by unit (bottle=$1.50, case=$15.00)

### 3. Batch/Receive Tracking
- **Initial Stock Qty:** Import creates a Batch record automatically
- **Batch Expiry Date:** Sets when stock expires (FEFO logic respects this)
- **Why:** Enables proper inventory aging and FIFO/FEFO deductions

---

## Updated Template Fields (14 columns)

| # | Field | Required | Type | Example | Notes |
|---|-------|----------|------|---------|-------|
| 1 | Product Name | ✓ | Text | "Coca Cola 500ml" | Max 255 chars |
| 2 | Retail Price | ✓ | Number | 1500.00 | Min 0.01, 2 decimals |
| 3 | Unit Name | Optional | Text | "bottle" | pcs, bottle, case, kg, etc. |
| 4 | Conversion Factor | Optional | Number | 12.0 | For multi-unit (12 bottles = 1 case) |
| 5 | Wholesale Price | Optional | Number | 1200.00 | Bulk pricing, 2 decimals |
| 6 | SKU | Optional | Text | (auto) | Auto-generated if empty |
| 7 | Category | Optional | Text | "Beverages" | Auto-created if doesn't exist |
| 8 | Barcode | Optional | Text | "123456789" | Max 100 chars |
| 9 | Cost | Optional | Number | 1000.00 | Cost of goods, 2 decimals |
| 10 | Description | Optional | Text | "500ml bottle" | Product description |
| 11 | Low Stock Threshold | Optional | Integer | 10 | Reorder point for alerts |
| 12 | Initial Stock Qty | Optional | Integer | 100 | Opening batch quantity |
| 13 | Batch Expiry Date | Optional | Date | 2026-08-04 | **IMPORTANT: If empty, stock never expires** |
| 14 | Is Active | Optional | Yes/No | "Yes" | Product active/inactive |

---

## Example: Multi-Unit Product Import

**Same product, different units:**

```
Product Name          | Retail Price | Unit Name | Conversion Factor | Cost
Coca Cola 500ml       | 1500.00      | bottle    | 1.0              | 1000.00
Coca Cola 500ml       | 15000.00     | case      | 12.0             | 11000.00
```

**Result in System:**
- **Product:** "Coca Cola 500ml" (single record)
- **Units:**
  - Unit 1: "bottle" (conversion 1.0, retail 1500.00)
  - Unit 2: "case" (conversion 12.0, retail 15000.00)
- **Pricing:** Selling 1 bottle = 1500; selling 1 case = 15000 (not 1500×12)
- **Stock Impact:** Selling 1 case deducts 12 bottles from inventory

---

## Important Notes

### Batch Expiry Date is CRITICAL
- If **empty or null:** Stock will never expire (❌ RISK: old stock stays in system)
- If **set:** FEFO logic respects it and skips expired batches
- **Recommendation:** Always set an expiry date (even if "far future" like 2027-12-31)

### Multi-Unit Import
- Import same product name multiple times with different Unit Names
- System will group them under ONE product with multiple ProductUnits
- Each unit gets its own Conversion Factor and Price

### Bulk Pricing
- Retail Price: Price when sold via one unit
- Wholesale Price: Optional lower price for bulk orders
- Both are stored per ProductUnit

### Receive Tracking
- Initial Stock Qty → Creates Batch record
- Batch Expiry Date → Sets batch.expiry_date
- System automatically creates StockMovement for audit trail

---

## Files Updated

1. **CHATGPT_PROMPT_FOR_EXCEL_TEMPLATE.txt**
   - Added 3 new fields (Unit Name, Conversion Factor, Batch Expiry Date)
   - Removed variation_name
   - Updated sample data for multi-unit products
   - Added detailed UNITS ONLY architecture notes

2. **UI_MOCKUPS_REFERENCE.md** (docs/)
   - Updated template field descriptions
   - Replaced variation_name with unit_name and conversion_factor

3. **PRIMEPOS_MODULE_RISK_ASSESSMENT_UPDATED.md** (backend/docs/)
   - Already documented the architecture change
   - Lists variation_name as legacy artifact to be removed

---

## Migration Path for Existing Data

If you have products with the old template:

1. **Manual Update Required:**
   - Export existing products
   - Map old variation_name to new Unit Name
   - Set Conversion Factor (1.0 for single unit)
   - Re-import with new template

2. **Or Use Product Modal UI:**
   - Edit each product via dashboard
   - Add Unit records via ProductModalTabs
   - Set conversion factors and pricing
   - No bulk import needed if small product count

---

## Testing Checklist

- [ ] Download template → Opens in Excel without errors
- [ ] Sample rows have correct data types and formatting
- [ ] Multi-unit product import works (same product, different units)
- [ ] Batch expiry date is set and FEFO respects it
- [ ] Conversion factors calculate correctly in sales
- [ ] Categories auto-created from import
- [ ] Low stock threshold triggers alerts
- [ ] Cost field updates profit margin calculations

---

## Support for Users

**Common Questions:**

**Q: What if I only sell one unit per product?**
- A: Set Unit Name = "pcs" (or your default), Conversion Factor = 1.0
- Only one row per product needed

**Q: Can I change units after import?**
- A: Yes, edit product via ProductModalTabs → Units tab
- Add, remove, or modify units anytime

**Q: What if I don't set Batch Expiry Date?**
- A: ⚠️ Stock will never expire; FEFO logic won't work
- Recommendation: Set to far future date if truly non-perishable (e.g., 2030-12-31)

**Q: How do I track different batch costs?**
- A: Import again with new Batch Expiry Date and Cost
- System creates separate batch records with different costs
- FEFO tracks them separately

---

**Last Updated:** February 4, 2026  
**Architecture:** UNITS ONLY (ItemVariation removed)  
**Template Version:** 2.0
