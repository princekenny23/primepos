# Export System Integration Guide

## What Was Built

### 1. **Export Service** (`frontend/lib/services/exportService.ts`)
- Core logic for generating XLSX/CSV files client-side
- Handles data transformation and formatting
- Supports currency, date, number, percentage formats
- Auto-resizes columns and freezes headers

### 2. **Simple Export Modal** (`frontend/components/modals/simple-export-modal.tsx`)
- Lightweight, reusable modal component
- Works with any data array
- Supports column selection
- Shows success/failure feedback

### 3. **Export Hook** (`frontend/hooks/useExport.ts`)
- Manages modal state and data
- Simplifies component integration
- Encapsulates state management

---

## Quick Integration (3 Steps)

### Step 1: Import Components
```typescript
import { SimpleExportModal } from "@/components/modals/simple-export-modal"
import { useExport } from "@/hooks/useExport"
import { ExportColumn } from "@/lib/services/exportService"
```

### Step 2: Define Columns
```typescript
const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "name", label: "Product Name", width: 30 },
  { key: "price", label: "Price", format: "currency", width: 15 },
  { key: "stock", label: "Stock", format: "number", width: 12 },
  { key: "lastUpdated", label: "Updated", format: "date", width: 18 },
]
```

### Step 3: Add to Component
```typescript
export default function ProductsPage() {
  const [products, setProducts] = useState([])
  
  const exportState = useExport({
    fileName: "products",
    sheetName: "Products",
    columns: EXPORT_COLUMNS,
  })

  return (
    <>
      <Button onClick={() => exportState.openExport(products)}>
        Export
      </Button>

      <SimpleExportModal
        open={exportState.isOpen}
        onOpenChange={exportState.closeExport}
        data={exportState.data}
        fileName={exportState.fileName}
        sheetName={exportState.sheetName}
        columns={exportState.columns}
      />
    </>
  )
}
```

---

## Where to Add Exports

### ✅ Recommended Pages
- [ ] Products page
- [ ] Sales/Reports page
- [ ] Inventory page
- [ ] Customer list
- [ ] Purchase orders
- [ ] Stock transfers
- [ ] Audit logs
- [ ] Shift reports
- [ ] Revenue reports

### Implementation Checklist for Each Page
```
□ Import SimpleExportModal and useExport
□ Define EXPORT_COLUMNS constant with proper formats
□ Add export button to header/toolbar
□ Call exportState.openExport(filteredData) on click
□ Add SimpleExportModal component to render
□ Test: click export → verify download
□ Test: select/deselect columns → export
```

---

## Format Types Reference

| Format | Input | Output | Example |
|--------|-------|--------|---------|
| text | "hello" | "hello" | Name, description |
| currency | 1234.5 | 1234.5 | $1,234.50 (in Excel) |
| date | "2026-02-16" | 2026-02-16 | Date cells |
| number | "42" | 42 | Quantities, counts |
| percentage | 0.85 | 0.85 | 85% (in Excel) |

---

## Examples of Exports in Action

### Products Export
```
Product Name | SKU | Category | Price | Stock | Status
Widget 1 | SKU001 | Electronics | 29.99 | 150 | Active
Widget 2 | SKU002 | Electronics | 19.99 | 45 | Active
```

### Sales Report Export
```
Sale # | Date | Customer | Subtotal | Tax | Total | Payment
1001 | 2026-02-16 | John Doe | 99.99 | 9.99 | 109.98 | Cash
1002 | 2026-02-16 | Jane Smith | 199.99 | 20.00 | 219.99 | Card
```

### Inventory Export
```
Product | Current Stock | Reorder Point | Unit Cost | Total Value
Apples | 500 | 100 | 0.50 | 250.00
Bananas | 200 | 50 | 0.30 | 60.00
```

---

## Advanced: Custom Data Transformation

For complex data, transform before export:

```typescript
const handleExport = async () => {
  // Transform data for export
  const exportData = products.map(p => ({
    name: p.productName,
    sku: p.sku,
    price: p.sellingPrice,
    stock: p.totalStock,
    category: p.category?.name || "Uncategorized",
    lastUpdated: new Date(p.updatedAt).toLocaleDateString(),
  }))

  exportState.openExport(exportData)
}
```

---

## Troubleshooting

### Download doesn't start
- ✅ Check browser console for errors
- ✅ Verify XLSX library is installed (it is)
- ✅ Check data array is not empty
- ✅ Ensure columns config matches data keys

### Wrong column order
- ✅ Order columns array by desired sequence
- ✅ Columns export in the order defined

### Formatting not applied
- ✅ Ensure format field is set: `format: "currency"`
- ✅ Excel applies formatting, not the XLSX generator
- ✅ Use "currency" format and open in Excel for best results

### Column widths too narrow
- ✅ Add `width` property to columns
- ✅ Example: `{ key: "name", label: "Product", width: 30 }`

---

## Files Added/Modified

```
✅ NEW:
   - frontend/lib/services/exportService.ts (Core service)
   - frontend/components/modals/simple-export-modal.tsx (Modal component)
   - frontend/hooks/useExport.ts (State management hook)
   - frontend/EXPORT_USAGE_EXAMPLES.md (This file)

✏️ MODIFIED:
   - frontend/components/modals/data-exchange-modal.tsx (Now uses exportService)
```

---

## Next Steps

1. **Pick a page** to add export first (e.g., Products)
2. **Follow the 3-step integration** above
3. **Test in browser** - click export → verify download
4. **Rinse and repeat** for other pages
5. **Customize columns** as needed for each page type

---

## Questions?

Refer to `EXPORT_USAGE_EXAMPLES.md` for complete code examples for:
- Products page export
- Sales/Reports export
- Inventory export
- Quick export (no config)
