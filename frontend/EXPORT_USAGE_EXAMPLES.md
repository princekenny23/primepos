/**
 * EXAMPLE: How to use SimpleExportModal in your pages
 * 
 * This file demonstrates the best practices for adding export functionality
 * to products, reports, sales, and any other data tables in PrimePOS.
 */

/**
 * ============================================================================
 * EXAMPLE 1: Products Page Export
 * ============================================================================
 */

// products-page.tsx
/*
import { SimpleExportModal } from "@/components/modals/simple-export-modal"
import { useExport } from "@/hooks/useExport"
import { ExportColumn } from "@/lib/services/exportService"

const PRODUCT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "name", label: "Product Name", width: 30 },
  { key: "sku", label: "SKU", width: 15 },
  { key: "category", label: "Category", width: 20 },
  { key: "price", label: "Price", format: "currency", width: 15 },
  { key: "cost", label: "Cost", format: "currency", width: 15 },
  { key: "stock", label: "Stock", format: "number", width: 12 },
  { key: "status", label: "Status", width: 15 },
  { key: "lastUpdated", label: "Last Updated", format: "date", width: 18 },
]

export default function ProductsPage() {
  // State from API
  const [products, setProducts] = useState<any[]>([])
  const [filteredProducts, setFilteredProducts] = useState<any[]>([])

  // Export hook
  const exportState = useExport({
    fileName: "products",
    sheetName: "Products",
    columns: PRODUCT_EXPORT_COLUMNS,
  })

  const handleExportClick = () => {
    // Filter data to what user sees
    const dataToExport = filteredProducts.length > 0 ? filteredProducts : products
    
    if (dataToExport.length === 0) {
      toast({ title: "No data to export" })
      return
    }

    exportState.openExport(dataToExport)
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h1>Products</h1>
        <Button onClick={handleExportClick}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      <ProductsTable data={filteredProducts} />

      <SimpleExportModal
        open={exportState.isOpen}
        onOpenChange={exportState.closeExport}
        data={exportState.data}
        fileName={exportState.fileName}
        sheetName={exportState.sheetName}
        columns={exportState.columns}
        onSuccess={() => {
          toast({ title: "Export successful" })
        }}
      />
    </>
  )
}
*/

/**
 * ============================================================================
 * EXAMPLE 2: Sales/Reports Page Export with Calculations
 * ============================================================================
 */

// sales-report-page.tsx
/*
import { SimpleExportModal } from "@/components/modals/simple-export-modal"
import { useExport } from "@/hooks/useExport"
import { ExportColumn } from "@/lib/services/exportService"

const SALES_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "saleNumber", label: "Sale #", width: 15 },
  { key: "date", label: "Date", format: "date", width: 18 },
  { key: "time", label: "Time", width: 12 },
  { key: "customer", label: "Customer", width: 25 },
  { key: "items", label: "Items", format: "number", width: 10 },
  { key: "subtotal", label: "Subtotal", format: "currency", width: 15 },
  { key: "tax", label: "Tax", format: "currency", width: 12 },
  { key: "total", label: "Total", format: "currency", width: 15 },
  { key: "paymentMethod", label: "Payment", width: 15 },
  { key: "cashier", label: "Cashier", width: 20 },
  { key: "outlet", label: "Outlet", width: 20 },
]

export default function SalesReportPage() {
  const [sales, setSales] = useState<any[]>([])
  const [dateRange, setDateRange] = useState({ from: new Date(), to: new Date() })
  const [outlet, setOutlet] = useState<string | null>(null)

  const exportState = useExport({
    fileName: "sales-report",
    sheetName: "Sales",
    columns: SALES_EXPORT_COLUMNS,
  })

  const handleExport = async () => {
    // Apply filters before export
    let dataToExport = sales

    if (dateRange.from && dateRange.to) {
      dataToExport = dataToExport.filter(
        (s) =>
          new Date(s.date) >= dateRange.from &&
          new Date(s.date) <= dateRange.to
      )
    }

    if (outlet) {
      dataToExport = dataToExport.filter((s) => s.outlet_id === outlet)
    }

    if (dataToExport.length === 0) {
      toast({ title: "No data for selected filters" })
      return
    }

    exportState.openExport(dataToExport)
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between">
          <h1>Sales Report</h1>
          <Button onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export {sales.length > 0 ? `(${sales.length})` : ""}
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-3 gap-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <OutletSelect value={outlet} onChange={setOutlet} />
        </div>

        {/* Report Table/Charts */}
        <SalesTable data={sales} />
      </div>

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
*/

/**
 * ============================================================================
 * EXAMPLE 3: Inventory/Stock Page Export
 * ============================================================================
 */

// inventory-page.tsx
/*
const INVENTORY_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "name", label: "Product", width: 25 },
  { key: "sku", label: "SKU", width: 15 },
  { key: "currentStock", label: "Current Stock", format: "number", width: 15 },
  { key: "reorderPoint", label: "Reorder Point", format: "number", width: 15 },
  { key: "unitCost", label: "Unit Cost", format: "currency", width: 15 },
  { key: "totalValue", label: "Total Value", format: "currency", width: 15 },
  { key: "lastRestocked", label: "Last Restocked", format: "date", width: 18 },
  { key: "supplier", label: "Supplier", width: 20 },
]

// Usage same pattern as above:
const exportState = useExport({
  fileName: "inventory-report",
  sheetName: "Inventory",
  columns: INVENTORY_EXPORT_COLUMNS,
})
*/

/**
 * ============================================================================
 * EXAMPLE 4: Quick Export (No Config Needed)
 * ============================================================================
 */

// For simple tables where you don't need to configure columns
/*
import { quickExportXLSX } from "@/lib/services/exportService"

const handleQuickExport = async () => {
  try {
    await quickExportXLSX(customerData, "customers", "Customers")
    toast({ title: "Exported successfully" })
  } catch (error) {
    toast({ title: "Export failed", variant: "destructive" })
  }
}
*/

/**
 * ============================================================================
 * BEST PRACTICES CHECKLIST
 * ============================================================================
 * 
 * ✅ DO:
 *    • Pass the filtered data user currently sees
 *    • Define columns in a constant at the top of page
 *    • Include format types (currency, date, number)
 *    • Set reasonable column widths for readability
 *    • Use descriptive labels (user-friendly names)
 *    • Show record count in button ("Export (245)")
 *    • Handle empty data gracefully with toast message
 *
 * ❌ DON'T:
 *    • Call backend to get the same data again
 *    • Hardcode column config in component
 *    • Export unfiltered dataset when user filtered data
 *    • Forget to show loading state
 *    • Let export close modal without user knowing it succeeded
 *
 * ============================================================================
 */

/**
 * ============================================================================
 * EXPORT COLUMN FORMATS REFERENCE
 * ============================================================================
 * 
 * undefined / "text"     → Displays as-is (e.g., "John Doe")
 * "currency"            → Formatted as money (e.g., 1234.56 → $1,234.56)
 * "date"                → Proper date format (e.g., 2026-02-16)
 * "number"              → Numeric format (e.g., 42)
 * "percentage"          → Percentage format (e.g., 85%)
 *
 * ============================================================================
 */

export default function Examples() {
  return null
}
