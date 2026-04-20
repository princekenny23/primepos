"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"

type UserRole = string

interface RoleContextType {
  role: UserRole
  setRole: (role: UserRole) => void
  hasPermission: (permission: string) => boolean
  isLoading: boolean
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

// No static role permissions — all access is driven by staff role can_* flags from the backend.

interface RoleProviderProps {
  children: React.ReactNode
}

export function RoleProvider({ children }: RoleProviderProps) {
  const { user } = useAuthStore()
  const [role, setRole] = useState<UserRole>("staff")
  const [isLoading, setIsLoading] = useState(true)

  const resolveUserRole = (): UserRole => {
    if (user?.is_saas_admin) return "saas_admin"
    const raw =
      (user as any)?.staff_role?.name ||
      (user as any)?.effective_role ||
      (user as any)?.role
    return String(raw || "staff")
  }

  useEffect(() => {
    if (user) {
      setRole(resolveUserRole())
      setIsLoading(false)
      return
    }

    if (typeof window !== "undefined") {
      const savedRole = localStorage.getItem("userRole")
      if (savedRole) {
        setRole(savedRole)
      } else {
        setRole("staff")
      }
    }
    setIsLoading(false)
  }, [user])

  const permissionKeyMap: Record<string, string> = {
    dashboard: "can_dashboard",
    sales: "can_sales",
    inventory: "can_inventory",
    products: "can_products",
    customers: "can_customers",
    reports: "can_reports",
    staff: "can_staff",
    office: "can_staff",
    settings: "can_settings",
    roles_manage: "can_settings",
    outlets: "can_settings",
    pos: "can_sales",
    pos_retail: "can_pos_retail",
    pos_restaurant: "can_pos_restaurant",
    pos_bar: "can_pos_bar",
    distribution: "can_distribution",
    "activity-log": "can_reports",
    notifications: "can_dashboard",
    storefront: "can_storefront",
    switch_outlet: "can_switch_outlet",
  }

  const permissionCodeMap: Record<string, string[]> = {
    dashboard: ["dashboard.view"],
    sales: ["sales.view"],
    inventory: ["inventory.view", "inventory.manage"],
    products: ["products.manage"],
    customers: ["customers.manage"],
    reports: ["reports.view"],
    staff: ["staff.manage"],
    office: ["staff.manage"],
    settings: ["settings.manage"],
    roles_manage: ["roles.manage"],
    outlets: ["outlet.switch", "settings.manage"],
    pos: ["pos.retail", "pos.restaurant", "pos.bar"],
    pos_retail: ["pos.retail"],
    pos_restaurant: ["pos.restaurant"],
    pos_bar: ["pos.bar"],
    distribution: ["distribution.manage"],
    storefront: ["storefront.manage"],
    switch_outlet: ["outlet.switch"],
  }

  const hasPermission = (permission: string): boolean => {
    if (user?.is_saas_admin) return true

    const permissionCodes = (user as any)?.permission_codes
    if (Array.isArray(permissionCodes) && permissionCodes.length > 0) {
      const expected = permissionCodeMap[permission] || []
      if (expected.length > 0) {
        const codeAllowed = expected.some((code) => permissionCodes.includes(code))
        if (codeAllowed) {
          return true
        }
        // Fall through to legacy permissions during migration.
      }
    }

    const userPermissions = (user as any)?.permissions
    if (userPermissions) {
      const key = permissionKeyMap[permission]
      if (key) {
        return Boolean(userPermissions[key])
      }
      // Unknown permission key — deny by default
      return false
    }
    // No permissions object from backend — deny by default (user data not yet loaded)
    return false
  }

  const handleSetRole = (newRole: UserRole) => {
    setRole(newRole)
    if (typeof window !== "undefined") {
      localStorage.setItem("userRole", newRole)
    }
  }

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole: handleSetRole,
        hasPermission,
        isLoading,
      }}
    >
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider")
  }
  return context
}

