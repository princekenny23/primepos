export interface DataField {
  name: string
  label: string
  type: "string" | "number" | "date" | "boolean" | "select"
  required: boolean
  example?: string
  description?: string
}

export interface DataExchangeConfig {
  entityType: "products" | "reports" | "inventory" | "sales" | "customers" | "suppliers"
  fields: DataField[]
  requiredFields: string[]
  defaultFormat: "xlsx" | "csv"
  filters?: {
    outlet?: boolean
    category?: boolean
    dateRange?: boolean
    status?: boolean
    supplier?: boolean
  }
  apiEndpoints: {
    import: string
    export: string
  }
}

// Products configuration
const productsFields: DataField[] = [
  {
    name: "product_name",
    label: "Product Name",
    type: "string",
    required: true,
    example: "Coca Cola 500ml",
    description: "Name of the product",
  },
  {
    name: "sku",
    label: "SKU",
    type: "string",
    required: false,
    example: "COKE-500",
    description: "Stock Keeping Unit",
  },
  {
    name: "barcode",
    label: "Barcode",
    type: "string",
    required: false,
    example: "5901234123457",
    description: "Product barcode",
  },
  {
    name: "category",
    label: "Category",
    type: "string",
    required: true,
    example: "Beverages",
    description: "Product category (auto-created if not exists)",
  },
  {
    name: "retail_price",
    label: "Retail Price",
    type: "number",
    required: true,
    example: "2500",
    description: "Selling price",
  },
  {
    name: "wholesale_price",
    label: "Wholesale Price",
    type: "number",
    required: false,
    example: "2000",
    description: "Bulk purchase price",
  },
  {
    name: "cost",
    label: "Cost Price",
    type: "number",
    required: false,
    example: "1500",
    description: "Purchase cost",
  },
  {
    name: "initial_stock_qty",
    label: "Initial Stock Qty",
    type: "number",
    required: false,
    example: "100",
    description: "Initial stock quantity",
  },
  {
    name: "low_stock_threshold",
    label: "Low Stock Threshold",
    type: "number",
    required: false,
    example: "20",
    description: "Alert when quantity falls below",
  },
  {
    name: "unit_name",
    label: "Unit Name",
    type: "string",
    required: false,
    example: "Carton",
    description: "Custom unit name for multi-unit pricing",
  },
  {
    name: "conversion_factor",
    label: "Conversion Factor",
    type: "number",
    required: false,
    example: "12",
    description: "Conversion factor to base unit",
  },
  {
    name: "batch_expiry_date",
    label: "Batch Expiry Date",
    type: "date",
    required: false,
    example: "2026-12-31",
    description: "Batch expiry date (YYYY-MM-DD) for FEFO tracking",
  },
  {
    name: "description",
    label: "Description",
    type: "string",
    required: false,
    example: "Cold beverage",
    description: "Product description",
  },
  {
    name: "is_active",
    label: "Is Active",
    type: "boolean",
    required: false,
    example: "true",
    description: "Whether product is active (true/false or 1/0)",
  },
  {
    name: "outlet",
    label: "Outlet",
    type: "string",
    required: false,
    example: "Main Branch",
    description: "Outlet name for stock location",
  },
]

// Reports configuration
const reportsFields: DataField[] = [
  {
    name: "report_name",
    label: "Report Name",
    type: "string",
    required: true,
    example: "Sales Summary",
    description: "Name of the report",
  },
  {
    name: "report_type",
    label: "Report Type",
    type: "select",
    required: true,
    example: "Sales",
    description: "Type: Sales, Inventory, Expenses, Revenue",
  },
  {
    name: "period",
    label: "Period",
    type: "string",
    required: false,
    example: "2026-01",
    description: "Report period (YYYY-MM)",
  },
  {
    name: "outlet",
    label: "Outlet",
    type: "string",
    required: false,
    example: "Main Branch",
    description: "Outlet name",
  },
  {
    name: "total_amount",
    label: "Total Amount",
    type: "number",
    required: false,
    example: "50000",
    description: "Total amount",
  },
  {
    name: "notes",
    label: "Notes",
    type: "string",
    required: false,
    example: "Monthly summary",
    description: "Additional notes",
  },
]

// Inventory configuration
const inventoryFields: DataField[] = [
  {
    name: "product_name",
    label: "Product Name",
    type: "string",
    required: true,
    example: "Coca Cola",
    description: "Product name",
  },
  {
    name: "sku",
    label: "SKU",
    type: "string",
    required: false,
    example: "COKE-500",
    description: "Stock Keeping Unit",
  },
  {
    name: "outlet",
    label: "Outlet",
    type: "string",
    required: true,
    example: "Main Branch",
    description: "Outlet location",
  },
  {
    name: "current_quantity",
    label: "Current Quantity",
    type: "number",
    required: true,
    example: "150",
    description: "Current stock quantity",
  },
  {
    name: "quantity_to_adjust",
    label: "Quantity to Adjust",
    type: "number",
    required: true,
    example: "50",
    description: "Amount to add/subtract",
  },
  {
    name: "adjustment_reason",
    label: "Adjustment Reason",
    type: "string",
    required: false,
    example: "Stock take correction",
    description: "Reason for adjustment",
  },
  {
    name: "notes",
    label: "Notes",
    type: "string",
    required: false,
    example: "Damaged goods",
    description: "Additional notes",
  },
]

// Sales configuration
const salesFields: DataField[] = [
  {
    name: "sale_reference",
    label: "Sale Reference",
    type: "string",
    required: true,
    example: "SALE-2026-001",
    description: "Unique sale reference",
  },
  {
    name: "date",
    label: "Sale Date",
    type: "date",
    required: true,
    example: "2026-01-28",
    description: "Date of sale (YYYY-MM-DD)",
  },
  {
    name: "outlet",
    label: "Outlet",
    type: "string",
    required: true,
    example: "Main Branch",
    description: "Outlet where sale occurred",
  },
  {
    name: "product",
    label: "Product Name",
    type: "string",
    required: true,
    example: "Coca Cola",
    description: "Product sold",
  },
  {
    name: "quantity",
    label: "Quantity",
    type: "number",
    required: true,
    example: "10",
    description: "Quantity sold",
  },
  {
    name: "unit_price",
    label: "Unit Price",
    type: "number",
    required: true,
    example: "2500",
    description: "Price per unit",
  },
  {
    name: "total_amount",
    label: "Total Amount",
    type: "number",
    required: false,
    example: "25000",
    description: "Total sale amount",
  },
]

// Customers configuration
const customersFields: DataField[] = [
  {
    name: "name",
    label: "Customer Name",
    type: "string",
    required: true,
    example: "John Doe",
    description: "Full name",
  },
  {
    name: "email",
    label: "Email",
    type: "string",
    required: false,
    example: "john@example.com",
    description: "Email address",
  },
  {
    name: "phone",
    label: "Phone Number",
    type: "string",
    required: false,
    example: "+256701234567",
    description: "Contact number",
  },
  {
    name: "address",
    label: "Address",
    type: "string",
    required: false,
    example: "123 Main St",
    description: "Physical address",
  },
  {
    name: "loyalty_points",
    label: "Loyalty Points",
    type: "number",
    required: false,
    example: "1000",
    description: "Accumulated points",
  },
  {
    name: "credit_limit",
    label: "Credit Limit",
    type: "number",
    required: false,
    example: "500000",
    description: "Maximum credit allowed",
  },
]

// Suppliers configuration
const suppliersFields: DataField[] = [
  {
    name: "supplier_name",
    label: "Supplier Name",
    type: "string",
    required: true,
    example: "ABC Distributors",
    description: "Supplier company name",
  },
  {
    name: "contact_person",
    label: "Contact Person",
    type: "string",
    required: false,
    example: "Jane Smith",
    description: "Primary contact name",
  },
  {
    name: "email",
    label: "Email",
    type: "string",
    required: false,
    example: "jane@abcdist.com",
    description: "Email address",
  },
  {
    name: "phone",
    label: "Phone Number",
    type: "string",
    required: false,
    example: "+256701234567",
    description: "Contact number",
  },
  {
    name: "payment_terms",
    label: "Payment Terms",
    type: "string",
    required: false,
    example: "Net 30",
    description: "Payment terms (e.g., Net 30)",
  },
  {
    name: "address",
    label: "Address",
    type: "string",
    required: false,
    example: "456 Business Ave",
    description: "Physical address",
  },
]

export const dataExchangeConfigs: Record<string, DataExchangeConfig> = {
  products: {
    entityType: "products",
    fields: productsFields,
    requiredFields: ["product_name", "category", "retail_price"],
    defaultFormat: "xlsx",
    filters: {
      outlet: true,
      category: true,
      status: true,
    },
    apiEndpoints: {
      import: "/products/bulk-import/",
      export: "/products/bulk-export/",
    },
  },
  reports: {
    entityType: "reports",
    fields: reportsFields,
    requiredFields: ["report_name", "report_type"],
    defaultFormat: "xlsx",
    filters: {
      dateRange: true,
      outlet: true,
    },
    apiEndpoints: {
      import: "/api/v1/reports/import/",
      export: "/api/v1/reports/export/",
    },
  },
  inventory: {
    entityType: "inventory",
    fields: inventoryFields,
    requiredFields: ["product_name", "outlet", "current_quantity"],
    defaultFormat: "xlsx",
    filters: {
      outlet: true,
      category: true,
    },
    apiEndpoints: {
      import: "/api/v1/inventory/bulk-adjust/",
      export: "/api/v1/inventory/export/",
    },
  },
  sales: {
    entityType: "sales",
    fields: salesFields,
    requiredFields: ["sale_reference", "date", "outlet", "product"],
    defaultFormat: "xlsx",
    filters: {
      outlet: true,
      dateRange: true,
    },
    apiEndpoints: {
      import: "/api/v1/sales/import/",
      export: "/api/v1/sales/export/",
    },
  },
  customers: {
    entityType: "customers",
    fields: customersFields,
    requiredFields: ["name"],
    defaultFormat: "xlsx",
    filters: {
      status: true,
    },
    apiEndpoints: {
      import: "/api/v1/customers/import/",
      export: "/api/v1/customers/export/",
    },
  },
  suppliers: {
    entityType: "suppliers",
    fields: suppliersFields,
    requiredFields: ["supplier_name"],
    defaultFormat: "xlsx",
    filters: {
      status: true,
    },
    apiEndpoints: {
      import: "/api/v1/suppliers/import/",
      export: "/api/v1/suppliers/export/",
    },
  },
}
