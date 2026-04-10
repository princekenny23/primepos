import type { User } from "@/lib/types"

type TenantObject = Exclude<User["tenant"], string | number | undefined>
export type TenantPermissions = NonNullable<TenantObject>["permissions"]
type TenantPermissionKey =
  | keyof NonNullable<TenantPermissions>
  | "has_distribution"
  | "allow_office_users"
  | "allow_office_staff"
  | "allow_office_shift_management"

type OutletModulePermissionKey =
  | "allow_sales"
  | "allow_pos"
  | "allow_inventory"
  | "allow_office"
  | "allow_settings"
  | "allow_storefront"
  | "has_distribution"

type OutletPermissionsLike = {
  settings?: Record<string, any>
  distributionActive?: boolean
}

const featureToOutletModulePermission: Partial<Record<TenantPermissionKey, OutletModulePermissionKey>> = {
  has_distribution: "has_distribution",
  allow_sales: "allow_sales",
  allow_sales_create: "allow_sales",
  allow_sales_refund: "allow_sales",
  allow_sales_reports: "allow_sales",
  allow_pos: "allow_pos",
  allow_pos_restaurant: "allow_pos",
  allow_pos_bar: "allow_pos",
  allow_pos_retail: "allow_pos",
  allow_pos_discounts: "allow_pos",
  allow_inventory: "allow_inventory",
  allow_inventory_products: "allow_inventory",
  allow_inventory_stock_take: "allow_inventory",
  allow_inventory_transfers: "allow_inventory",
  allow_inventory_adjustments: "allow_inventory",
  allow_inventory_suppliers: "allow_inventory",
  allow_office: "allow_office",
  allow_office_accounting: "allow_office",
  allow_office_hr: "allow_office",
  allow_office_users: "allow_office",
  allow_office_staff: "allow_office",
  allow_office_shift_management: "allow_office",
  allow_office_reports: "allow_office",
  allow_office_analytics: "allow_office",
  allow_settings: "allow_settings",
  allow_settings_users: "allow_settings",
  allow_settings_outlets: "allow_settings",
  allow_settings_integrations: "allow_settings",
  allow_settings_advanced: "allow_settings",
  allow_storefront: "allow_storefront",
  allow_storefront_sites: "allow_storefront",
  allow_storefront_orders: "allow_storefront",
  allow_storefront_reports: "allow_storefront",
  allow_storefront_settings: "allow_storefront",
}

const legacyOutletKeyMap: Record<string, OutletModulePermissionKey> = {
  sales: "allow_sales",
  pos: "allow_pos",
  inventory: "allow_inventory",
  office: "allow_office",
  settings: "allow_settings",
  storefront: "allow_storefront",
  allow_distribution: "has_distribution",
  distribution: "has_distribution",
}

const toBooleanOrUndefined = (value: any): boolean | undefined => {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "on"].includes(normalized)) return true
    if (["false", "0", "no", "off"].includes(normalized)) return false
  }
  return undefined
}

const resolveOutletFromStorage = (): OutletPermissionsLike | null => {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem("primepos-business")
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state?.currentOutlet || null
  } catch {
    return null
  }
}

const getOutletModulePermissions = (outlet?: OutletPermissionsLike | null): Partial<Record<OutletModulePermissionKey, boolean>> => {
  const sourceOutlet = outlet || resolveOutletFromStorage()
  if (!sourceOutlet || typeof sourceOutlet !== "object") return {}

  const settings = sourceOutlet.settings
  const rawPermissions =
    settings?.module_permissions ||
    settings?.modulePermissions ||
    {}

  if (!rawPermissions || typeof rawPermissions !== "object") {
    return {}
  }

  const normalized: Partial<Record<OutletModulePermissionKey, boolean>> = {}
  for (const [rawKey, rawValue] of Object.entries(rawPermissions)) {
    const mapped = (legacyOutletKeyMap[rawKey] || rawKey) as OutletModulePermissionKey
    if (!Object.values(legacyOutletKeyMap).includes(mapped)) continue
    const boolValue = toBooleanOrUndefined(rawValue)
    if (boolValue !== undefined) {
      normalized[mapped] = boolValue
    }
  }

  return normalized
}

const isOutletModulePermissionEnabled = (
  permissionKey: TenantPermissionKey,
  outlet?: OutletPermissionsLike | null
): boolean => {
  const modulePermissionKey = featureToOutletModulePermission[permissionKey]
  if (!modulePermissionKey) return true

  const modulePermissions = getOutletModulePermissions(outlet)
  if (modulePermissions[modulePermissionKey] === false) {
    return false
  }

  if (modulePermissionKey === "has_distribution") {
    const sourceOutlet = outlet || resolveOutletFromStorage()
    if (!isOutletDistributionActive(sourceOutlet as OutletDistributionLike | null | undefined)) {
      return false
    }
  }

  return true
}

export function getTenantPermissions(user?: User | null): TenantPermissions | undefined {
  if (!user || user.is_saas_admin) return undefined
  if (user.tenant && typeof user.tenant === "object") {
    return user.tenant.permissions
  }
  return undefined
}

export function hasDistributionAccess(user: User | null | undefined): boolean {
  if (!user || user.is_saas_admin) return true
  if (user.tenant && typeof user.tenant === "object") {
    return (user.tenant as any).has_distribution === true
  }
  return false
}

type OutletDistributionLike = {
  distributionActive?: boolean
  settings?: Record<string, any>
}

const isOutletDistributionActive = (outlet?: OutletDistributionLike | null): boolean => {
  if (!outlet) return true

  if (typeof outlet.distributionActive === "boolean") {
    return outlet.distributionActive
  }

  const settings = outlet.settings
  if (settings && typeof settings === "object") {
    const fromSettings =
      (settings as any).distribution_active ??
      (settings as any).distributionActive
    if (typeof fromSettings === "boolean") {
      return fromSettings
    }
  }

  return true
}

export function isDistributionEnabledForOutlet(
  user: User | null | undefined,
  outlet?: OutletDistributionLike | null
): boolean {
  return isTenantFeatureEnabled(user, "has_distribution", outlet as OutletPermissionsLike | null | undefined)
}

export function isTenantFeatureEnabled(
  user: User | null | undefined,
  permissionKey: TenantPermissionKey,
  outlet?: OutletPermissionsLike | null
): boolean {
  if (permissionKey === "has_distribution" && !hasDistributionAccess(user)) {
    return false
  }

  const permissions = getTenantPermissions(user)
  const tenantEnabled = !permissions || (permissions as any)[permissionKey] !== false
  if (!tenantEnabled) return false
  return isOutletModulePermissionEnabled(permissionKey, outlet)
}

export function canAccessTenantPath(
  user: User | null | undefined,
  pathname: string,
  outlet?: OutletPermissionsLike | null
): boolean {
  if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/auth")) return true

  const role = (user?.effective_role || user?.role || "").toLowerCase()

  if (role === "driver") {
    if (
      pathname.startsWith("/dashboard/inventory") ||
      pathname.startsWith("/dashboard/settings") ||
      pathname.startsWith("/dashboard/office") ||
      pathname.startsWith("/dashboard/sales")
    ) {
      return false
    }
  }

  if (pathname.startsWith("/dashboard/sales")) {
    if (!isTenantFeatureEnabled(user, "allow_sales", outlet)) return false
    if (pathname.startsWith("/dashboard/sales/credits") && !isTenantFeatureEnabled(user, "allow_sales_create", outlet)) return false
    if (pathname.startsWith("/dashboard/sales/returns") && !isTenantFeatureEnabled(user, "allow_sales_refund", outlet)) return false
    if (pathname.startsWith("/dashboard/sales/voids") && !isTenantFeatureEnabled(user, "allow_sales_refund", outlet)) return false
    if (pathname.startsWith("/dashboard/sales/transactions") && !isTenantFeatureEnabled(user, "allow_sales_reports", outlet)) return false
    if (pathname.startsWith("/dashboard/sales/discounts") && !isTenantFeatureEnabled(user, "allow_pos_discounts", outlet)) return false
  }

  if (pathname.startsWith("/dashboard/returns") && !isTenantFeatureEnabled(user, "allow_sales_refund", outlet)) return false
  if (pathname.startsWith("/dashboard/discounts") && !isTenantFeatureEnabled(user, "allow_pos_discounts", outlet)) return false
  if (pathname.startsWith("/dashboard/reports") && !isTenantFeatureEnabled(user, "allow_sales_reports", outlet)) return false

  if (pathname.startsWith("/dashboard/pos") || pathname.startsWith("/pos/") || pathname.startsWith("/dashboard/restaurant") || pathname.startsWith("/dashboard/bar")) {
    if (!isTenantFeatureEnabled(user, "allow_pos", outlet)) return false
    const hasAnyPosMode =
      isTenantFeatureEnabled(user, "allow_pos_retail", outlet) ||
      isTenantFeatureEnabled(user, "allow_pos_restaurant", outlet) ||
      isTenantFeatureEnabled(user, "allow_pos_bar", outlet)
    if (!hasAnyPosMode) return false
    if (pathname.startsWith("/dashboard/restaurant") && !isTenantFeatureEnabled(user, "allow_pos_restaurant", outlet)) return false
    if (pathname.startsWith("/dashboard/bar") && !isTenantFeatureEnabled(user, "allow_pos_bar", outlet)) return false
  }

  if (pathname.startsWith("/dashboard/retail")) {
    if (!isTenantFeatureEnabled(user, "allow_pos", outlet)) return false
    if (!isTenantFeatureEnabled(user, "allow_pos_retail", outlet)) return false
  }

  if (pathname.startsWith("/dashboard/inventory")) {
    if (!isTenantFeatureEnabled(user, "allow_inventory", outlet)) return false
    if (pathname.startsWith("/dashboard/inventory/products") && !isTenantFeatureEnabled(user, "allow_inventory_products", outlet)) return false
    if (pathname.startsWith("/dashboard/inventory/stock-taking") && !isTenantFeatureEnabled(user, "allow_inventory_stock_take", outlet)) return false
    if (pathname.startsWith("/dashboard/inventory/suppliers") && !isTenantFeatureEnabled(user, "allow_inventory_suppliers", outlet)) return false
    if (pathname.startsWith("/dashboard/inventory/stock-control")) {
      const canStockControl =
        isTenantFeatureEnabled(user, "allow_inventory_adjustments", outlet) ||
        isTenantFeatureEnabled(user, "allow_inventory_transfers", outlet)
      if (!canStockControl) return false
    }
  }

  if (pathname.startsWith("/dashboard/distribution")) {
    if (!isTenantFeatureEnabled(user, "has_distribution", outlet)) return false
    if (!isDistributionEnabledForOutlet(user, outlet)) return false
  }

  if (pathname.startsWith("/dashboard/storefront")) {
    if (!isTenantFeatureEnabled(user, "allow_storefront", outlet)) return false
    if (pathname.startsWith("/dashboard/storefront/sites") && !isTenantFeatureEnabled(user, "allow_storefront_sites", outlet)) return false
    if (pathname.startsWith("/dashboard/storefront/orders") && !isTenantFeatureEnabled(user, "allow_storefront_orders", outlet)) return false
    if (pathname.startsWith("/dashboard/storefront/reports") && !isTenantFeatureEnabled(user, "allow_storefront_reports", outlet)) return false
    if (pathname.startsWith("/dashboard/storefront/settings") && !isTenantFeatureEnabled(user, "allow_storefront_settings", outlet)) return false
  }

  if (pathname.startsWith("/dashboard/office")) {
    if (!isTenantFeatureEnabled(user, "allow_office", outlet)) return false
    if (pathname.startsWith("/dashboard/office/users") && !isTenantFeatureEnabled(user, "allow_office_users", outlet)) return false
    if (pathname.startsWith("/dashboard/office/staff") && !isTenantFeatureEnabled(user, "allow_office_users", outlet)) return false
    if (pathname.startsWith("/dashboard/office/shift-management") && !isTenantFeatureEnabled(user, "allow_office_shift_management", outlet)) return false
    if (pathname.startsWith("/dashboard/office/reports") && !isTenantFeatureEnabled(user, "allow_office_reports", outlet)) return false
    if ((pathname.startsWith("/dashboard/office/expenses") || pathname.startsWith("/dashboard/office/quotations") || pathname.startsWith("/dashboard/office/payments")) && !isTenantFeatureEnabled(user, "allow_office_accounting", outlet)) return false
    if (pathname.startsWith("/dashboard/office/customer-management") && !isTenantFeatureEnabled(user, "allow_office_analytics", outlet)) return false
  }

  if (pathname.startsWith("/dashboard/settings")) {
    if (!isTenantFeatureEnabled(user, "allow_settings", outlet)) return false
    if (pathname.startsWith("/dashboard/settings/outlets-and-tills-management") && !isTenantFeatureEnabled(user, "allow_settings_outlets", outlet)) return false
    if (pathname.startsWith("/dashboard/settings/integrations") && !isTenantFeatureEnabled(user, "allow_settings_integrations", outlet)) return false
    if (
      (pathname.startsWith("/dashboard/settings/business") ||
        pathname.startsWith("/dashboard/settings/tax") ||
        pathname.startsWith("/dashboard/settings/notifications") ||
        pathname.startsWith("/dashboard/settings/activity-logs") ||
        pathname.startsWith("/dashboard/settings/language") ||
        pathname.startsWith("/dashboard/settings/payment-methods")) &&
      !isTenantFeatureEnabled(user, "allow_settings_advanced", outlet)
    ) return false
  }

  return true
}
