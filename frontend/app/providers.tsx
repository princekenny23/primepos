"use client"

import { useEffect, useRef } from "react"
import { TenantProvider } from "@/contexts/tenant-context"
import { RoleProvider } from "@/contexts/role-context"
import { ShiftProvider } from "@/contexts/shift-context"
import { I18nProvider } from "@/contexts/i18n-context"
import { useAuthStore } from "@/stores/authStore"
import { OfflineBootstrap } from "@/components/offline/offline-bootstrap"

function AuthHydrator() {
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasHydrated = useRef(false)

  useEffect(() => {
    if (hasHydrated.current) return
    hasHydrated.current = true

    const hasToken = typeof window !== "undefined" && !!localStorage.getItem("authToken")
    if (!hasToken || !isAuthenticated) return

    refreshUser().catch(() => {
      // auth store handles fallback state
    })
  }, [isAuthenticated, refreshUser])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <I18nProvider>
        <RoleProvider>
          <ShiftProvider>
            <OfflineBootstrap />
            <AuthHydrator />
            {children}
          </ShiftProvider>
        </RoleProvider>
      </I18nProvider>
    </TenantProvider>
  )
}

