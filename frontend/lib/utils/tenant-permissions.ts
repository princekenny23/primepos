import type { User } from "@/lib/types"

type TenantObject = Exclude<User["tenant"], string | number | undefined>
export type TenantPermissions = NonNullable<TenantObject>["permissions"]
type TenantPermissionKey =
  | keyof NonNullable<TenantPermissions>
  | "allow_office_users"
  | "allow_office_staff"
  | "allow_office_shift_management"

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

export function isTenantFeatureEnabled(
  user: User | null | undefined,
  permissionKey: TenantPermissionKey
): boolean {
  const permissions = getTenantPermissions(user)
  if (!permissions) return true
  return permissions[permissionKey] !== false
}

export function canAccessTenantPath(user: User | null | undefined, pathname: string): boolean {
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
    if (!isTenantFeatureEnabled(user, "allow_sales")) return false
    if (pathname.startsWith("/dashboard/sales/credits") && !isTenantFeatureEnabled(user, "allow_sales_create")) return false
    if (pathname.startsWith("/dashboard/sales/returns") && !isTenantFeatureEnabled(user, "allow_sales_refund")) return false
    if (pathname.startsWith("/dashboard/sales/voids") && !isTenantFeatureEnabled(user, "allow_sales_refund")) return false
    if (pathname.startsWith("/dashboard/sales/transactions") && !isTenantFeatureEnabled(user, "allow_sales_reports")) return false
    if (pathname.startsWith("/dashboard/sales/discounts") && !isTenantFeatureEnabled(user, "allow_pos_discounts")) return false
  }

  if (pathname.startsWith("/dashboard/returns") && !isTenantFeatureEnabled(user, "allow_sales_refund")) return false
  if (pathname.startsWith("/dashboard/discounts") && !isTenantFeatureEnabled(user, "allow_pos_discounts")) return false
  if (pathname.startsWith("/dashboard/reports") && !isTenantFeatureEnabled(user, "allow_sales_reports")) return false

  if (pathname.startsWith("/dashboard/pos") || pathname.startsWith("/pos/") || pathname.startsWith("/dashboard/restaurant") || pathname.startsWith("/dashboard/bar")) {
    if (!isTenantFeatureEnabled(user, "allow_pos")) return false
    const hasAnyPosMode =
      isTenantFeatureEnabled(user, "allow_pos_retail") ||
      isTenantFeatureEnabled(user, "allow_pos_restaurant") ||
      isTenantFeatureEnabled(user, "allow_pos_bar")
    if (!hasAnyPosMode) return false
    if (pathname.startsWith("/dashboard/restaurant") && !isTenantFeatureEnabled(user, "allow_pos_restaurant")) return false
    if (pathname.startsWith("/dashboard/bar") && !isTenantFeatureEnabled(user, "allow_pos_bar")) return false
  }

  if (pathname.startsWith("/dashboard/retail")) {
    if (!isTenantFeatureEnabled(user, "allow_pos")) return false
    if (!isTenantFeatureEnabled(user, "allow_pos_retail")) return false
  }

  if (pathname.startsWith("/dashboard/inventory")) {
    if (!isTenantFeatureEnabled(user, "allow_inventory")) return false
    if (pathname.startsWith("/dashboard/inventory/products") && !isTenantFeatureEnabled(user, "allow_inventory_products")) return false
    if (pathname.startsWith("/dashboard/inventory/stock-taking") && !isTenantFeatureEnabled(user, "allow_inventory_stock_take")) return false
    if (pathname.startsWith("/dashboard/inventory/suppliers") && !isTenantFeatureEnabled(user, "allow_inventory_suppliers")) return false
    if (pathname.startsWith("/dashboard/inventory/stock-control")) {
      const canStockControl =
        isTenantFeatureEnabled(user, "allow_inventory_adjustments") ||
        isTenantFeatureEnabled(user, "allow_inventory_transfers")
      if (!canStockControl) return false
    }
  }

  if (pathname.startsWith("/dashboard/distribution")) {
    if (!hasDistributionAccess(user)) return false
  }

  if (pathname.startsWith("/dashboard/office")) {
    if (!isTenantFeatureEnabled(user, "allow_office")) return false
    if (pathname.startsWith("/dashboard/office/users") && !isTenantFeatureEnabled(user, "allow_office_users")) return false
    if (pathname.startsWith("/dashboard/office/staff") && !isTenantFeatureEnabled(user, "allow_office_users")) return false
    if (pathname.startsWith("/dashboard/office/shift-management") && !isTenantFeatureEnabled(user, "allow_office_shift_management")) return false
    if (pathname.startsWith("/dashboard/office/reports") && !isTenantFeatureEnabled(user, "allow_office_reports")) return false
    if ((pathname.startsWith("/dashboard/office/expenses") || pathname.startsWith("/dashboard/office/quotations") || pathname.startsWith("/dashboard/office/payments")) && !isTenantFeatureEnabled(user, "allow_office_accounting")) return false
    if (pathname.startsWith("/dashboard/office/customer-management") && !isTenantFeatureEnabled(user, "allow_office_analytics")) return false
  }

  if (pathname.startsWith("/dashboard/settings")) {
    if (!isTenantFeatureEnabled(user, "allow_settings")) return false
    if (pathname.startsWith("/dashboard/settings/outlets-and-tills-management") && !isTenantFeatureEnabled(user, "allow_settings_outlets")) return false
    if (pathname.startsWith("/dashboard/settings/integrations") && !isTenantFeatureEnabled(user, "allow_settings_integrations")) return false
    if (
      (pathname.startsWith("/dashboard/settings/business") ||
        pathname.startsWith("/dashboard/settings/tax") ||
        pathname.startsWith("/dashboard/settings/notifications") ||
        pathname.startsWith("/dashboard/settings/activity-logs") ||
        pathname.startsWith("/dashboard/settings/language") ||
        pathname.startsWith("/dashboard/settings/payment-methods")) &&
      !isTenantFeatureEnabled(user, "allow_settings_advanced")
    ) return false
  }

  return true
}
