"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

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
    "reports",
    "crm",
    "settings",
    "staff",
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
    "reports",
    "crm",
    "products",
    "pos",
    "notifications",
    "activity-log",
  ],
  cashier: [
    "dashboard",
    "sales",
    "crm",
    "reports",
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
  const [role, setRole] = useState<UserRole>("admin")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // In production, this would fetch the user's role from API/auth
    // For now, we'll use localStorage or default to admin
    const savedRole = localStorage.getItem("userRole") as UserRole
    if (savedRole && rolePermissions[savedRole]) {
      setRole(savedRole)
    } else {
      setRole("admin") // Default role
      localStorage.setItem("userRole", "admin")
    }
    setIsLoading(false)
  }, [])

  const hasPermission = (permission: string): boolean => {
    const permissions = rolePermissions[role] || []
    return permissions.includes(permission)
  }

  const handleSetRole = (newRole: UserRole) => {
    setRole(newRole)
    localStorage.setItem("userRole", newRole)
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

