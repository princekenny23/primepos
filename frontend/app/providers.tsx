"use client"

import { useEffect, useRef } from "react"
import { TenantProvider } from "@/contexts/tenant-context"
import { RoleProvider } from "@/contexts/role-context"
import { ShiftProvider } from "@/contexts/shift-context"
import { I18nProvider } from "@/contexts/i18n-context"
import { useAuthStore } from "@/stores/authStore"
import { OfflineBootstrap } from "@/components/offline/offline-bootstrap"

// Silently ping the backend health endpoint on app load so that Render's free-tier
// server wakes up before the user performs an action (avoids cold-start CORS errors).
function BackendWarmup() {
  useEffect(() => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "https://primepos-5mf6.onrender.com/api/v1"
    // Health endpoint lives at the server root, outside the /api/v1 prefix.
    const healthUrl = apiUrl.replace(/\/api\/v1\/?$/, "") + "/health/"
    fetch(healthUrl, { method: "GET", mode: "no-cors", cache: "no-store" }).catch(() => {
      // Ignore errors — this is a best-effort warm-up only.
    })
  }, [])
  return null
}

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
            <BackendWarmup />
            <AuthHydrator />
            {children}
          </ShiftProvider>
        </RoleProvider>
      </I18nProvider>
    </TenantProvider>
  )
}

