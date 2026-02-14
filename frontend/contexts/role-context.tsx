"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"

type UserRole = "admin" | "cashier" | "staff" | "manager"

interface RoleContextType {
  role: UserRole
  setRole: (role: UserRole) => void
  hasPermission: (permission: string) => boolean
  isLoading: boolean
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

// Role permissions mapping
const rolePermissions: Record<UserRole, string[]> = {
  admin: [
    "dashboard",
    "sales",
    "inventory",
    "outlets",
    "office",
    "settings",
    "products",
    "pos",
    "notifications",
    "activity-log",
  ],
  manager: [
    "dashboard",
    "sales",
    "inventory",
    "outlets",
    "office",
    "products",
    "pos",
    "notifications",
    "activity-log",
  ],
  cashier: [
    "dashboard",
    "sales",
    "office",
    "pos",
    "notifications",
  ],
  staff: [
    "dashboard",
    "sales",
    "inventory",
    "products",
    "pos",
    "notifications",
  ],
}

interface RoleProviderProps {
  children: React.ReactNode
}

export function RoleProvider({ children }: RoleProviderProps) {
  const { user } = useAuthStore()
  const [role, setRole] = useState<UserRole>("staff")
  const [isLoading, setIsLoading] = useState(true)

  const normalizeRole = (value?: string): UserRole | null => {
    if (!value) return null
    const lower = value.toLowerCase()
    if (lower.includes("admin")) return "admin"
    if (lower.includes("manager")) return "manager"
    if (lower.includes("cashier")) return "cashier"
    if (lower.includes("staff")) return "staff"
    return null
  }

  const resolveUserRole = (): UserRole => {
    if (user?.is_saas_admin) return "admin"
    const raw =
      (user as any)?.effective_role ||
      (user as any)?.role ||
      (user as any)?.staff_role?.name
    return normalizeRole(raw) || "staff"
  }

  useEffect(() => {
    if (user) {
      setRole(resolveUserRole())
      setIsLoading(false)
      return
    }

    if (typeof window !== "undefined") {
      const savedRole = localStorage.getItem("userRole") as UserRole | null
      if (savedRole && rolePermissions[savedRole]) {
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
    outlets: "can_settings",
    pos: "can_sales",
    "activity-log": "can_reports",
    notifications: "can_dashboard",
  }

  const hasPermission = (permission: string): boolean => {
    if (user?.is_saas_admin) return true

    const userPermissions = (user as any)?.permissions
    if (userPermissions) {
      const key = permissionKeyMap[permission]
      if (key) {
        return Boolean(userPermissions[key])
      }
    }
    const permissions = rolePermissions[role] || []
    return permissions.includes(permission)
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

