import { usePathname } from "next/navigation"

export interface BreadcrumbItem {
  label: string
  href?: string
}

// Breadcrumb mapping for all routes
const breadcrumbMap: Record<string, string> = {
  dashboard: "Dashboard",
  sales: "Sales",
  pos: "POS Terminal",
  products: "Products",
  inventory: "Inventory",
  outlets: "Outlets",
  reports: "Reports",
  customers: "Customers",
  crm: "CRM",
  staff: "Staff",
  roles: "Roles",
  attendance: "Attendance",
  settings: "Settings",
  notifications: "Notifications",
  "activity-log": "Activity Log",
  categories: "Categories",
  "stock-adjustments": "Stock Adjustments",
  transfers: "Transfers",
  receiving: "Receiving",
  suppliers: "Suppliers",
  retail: "Retail",
  returns: "Returns",
  discounts: "Discounts",
  loyalty: "Loyalty",
  restaurant: "Restaurant",
  tables: "Tables",
  orders: "Orders",
  kitchen: "Kitchen",
  menu: "Menu",
  recipes: "Recipes",
  bar: "Bar",
  drinks: "Drinks",
  tabs: "Tabs",
  expenses: "Expenses",
  admin: "Admin",
  tenants: "Tenants",
  billing: "Billing",
  "support-tickets": "Support Tickets",
  analytics: "Analytics",
  plans: "Plans",
  users: "Users",
}

export function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  // Remove leading/trailing slashes and split
  const segments = pathname.split("/").filter(Boolean)

  // Remove "dashboard" from the start if present
  const dashboardIndex = segments.indexOf("dashboard")
  if (dashboardIndex !== -1) {
    segments.splice(0, dashboardIndex + 1)
  }

  const breadcrumbs: BreadcrumbItem[] = []

  // Build breadcrumbs from segments
  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1
    const label = breadcrumbMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
    
    // Build href up to current segment
    const href = isLast 
      ? undefined 
      : `/dashboard/${segments.slice(0, index + 1).join("/")}`

    breadcrumbs.push({ label, href })
  })

  return breadcrumbs
}

