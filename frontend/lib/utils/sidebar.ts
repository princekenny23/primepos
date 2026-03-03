// Sidebar Configuration Utilities
import type { BusinessType } from "../types"
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Package,
  Building2,
  History,
  Shield,
  Settings,
  RotateCcw,
  Truck,
  ClipboardList,
  Square,
  ChefHat,
  BookOpen,
  Calendar,
  Wine,
  CreditCard,
  FlaskConical,
  Wallet,
  DollarSign,
  Tag,
  Gift,
  Users,
  Receipt,
  Monitor,
  UtensilsCrossed,
  List,
  UserCog,
  Package2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
  permission: string
}

// Full navigation menu (common for all industries)
export const fullNavigation: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { name: "Sales", href: "/dashboard/sales", icon: ShoppingBag, permission: "sales" },
  { name: "Sales / POS", href: "/dashboard/pos", icon: Monitor, permission: "pos" },
  { name: "Inventory", href: "/dashboard/inventory", icon: Package, permission: "inventory" },
  { name: "Distribution", href: "/dashboard/distribution", icon: Package2, permission: "inventory" },
  { name: "Office", href: "/dashboard/office", icon: Building2, permission: "office" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, permission: "settings" },
]

// Retail navigation removed for MVP; wholesale users go to main dashboard
export const retailNavigation: NavigationItem[] = []

// Universal navigation items (available for all business types)
// Note: Returns, Discounts, and Credits are now under Sales Hub (/dashboard/sales)
export const universalNavigation: NavigationItem[] = [
  // These features are now accessible via Sales Hub landing page
]

// Restaurant-specific navigation items - Now consolidated into landing page
export const restaurantNavigation: NavigationItem[] = [
  { name: "Restaurant", href: "/dashboard/restaurant", icon: UtensilsCrossed, permission: "pos" },
]

// Bar-specific navigation items - Now consolidated into landing page
export const barNavigation: NavigationItem[] = [
  { name: "Bar", href: "/dashboard/bar", icon: Wine, permission: "pos" },
]

/**
 * Get sidebar navigation configuration for a specific industry
 * Combines fullNavigation with industry-specific items
 * 
 * @param industry - The business industry type (retail, restaurant, bar)
 * @returns Combined navigation array
 */
export function getIndustrySidebarConfig(
  industry: BusinessType | null | undefined
): NavigationItem[] {
  const baseNavigation = [...fullNavigation]
  
  if (!industry) {
    return baseNavigation
  }
  
  // Universal navigation items are available for all business types
  const universal = [...universalNavigation]
  
  switch (industry) {
    case "wholesale and retail":
      return [...baseNavigation]
    case "restaurant":
      return [...baseNavigation, ...restaurantNavigation]
    case "bar":
      return [...baseNavigation, ...barNavigation]
    default:
      return baseNavigation
  }
}

