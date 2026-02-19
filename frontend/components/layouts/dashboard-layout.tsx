"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Store,
  Menu,
  X,
  User,
  LogOut,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTenant } from "@/contexts/tenant-context"
import { useRole } from "@/contexts/role-context"
import { NotificationBell } from "@/components/dashboard/notification-bell"
import { SubNavbar } from "@/components/ui/subnavbar"
import { useShift } from "@/contexts/shift-context"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { useBusinessStore } from "@/stores/businessStore"
import { useAuthStore } from "@/stores/authStore"
import { useRouter } from "next/navigation"
import { PrimePOSLogo } from "@/components/brand/primepos-logo"
import { useI18n } from "@/contexts/i18n-context"
import { getOutletBusinessRouteSegment, getOutletDashboardRoute } from "@/lib/utils/outlet-settings"

// Navigation translation keys mapping
const navTranslationKeys: Record<string, string> = {
  "Dashboard": "common.navigation.dashboard",
  "Sales": "common.navigation.sales",
  "Sales / POS": "common.navigation.pos",
  "Inventory": "common.navigation.inventory",
  "Office": "common.navigation.office",
  "Admin": "common.navigation.admin",
  "Settings": "common.navigation.settings",
  "Wholesale": "common.navigation.wholesale",
  "Restaurant": "common.navigation.restaurant",
  "Bar": "common.navigation.bar",
}

const LOCAL_PRINT_AGENT_URL =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_URL || "http://127.0.0.1:7310"
const LOCAL_PRINT_AGENT_TOKEN =
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_TOKEN || ""
const AGENT_PING_INTERVAL_MS = 15000

function buildAgentHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  if (LOCAL_PRINT_AGENT_TOKEN) {
    headers["X-Primepos-Token"] = LOCAL_PRINT_AGENT_TOKEN
  }
  return headers
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

// Import sidebar configuration utilities
import { getIndustrySidebarConfig, fullNavigation, type NavigationItem } from "@/lib/utils/sidebar"

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [agentStatus, setAgentStatus] = useState<"checking" | "connected" | "disconnected">("checking")
  const pathname = usePathname()
  const router = useRouter()
  const { currentTenant, currentOutlet, isLoading } = useTenant()
  const { hasPermission, role } = useRole()
  const { activeShift } = useShift()
  const { user } = useAuthStore()
  const { currentBusiness, currentOutlet: businessOutlet } = useBusinessStore()
  const { t } = useI18n()
  const restoringBusinessRef = useRef(false)
  const redirectedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | undefined

    const pingAgent = async () => {
      try {
        const response = await fetch(`${LOCAL_PRINT_AGENT_URL}/health`, {
          method: "GET",
          headers: buildAgentHeaders(),
        })
        if (!cancelled) {
          setAgentStatus(response.ok ? "connected" : "disconnected")
        }
      } catch {
        if (!cancelled) {
          setAgentStatus("disconnected")
        }
      }
    }

    pingAgent()
    intervalId = setInterval(pingAgent, AGENT_PING_INTERVAL_MS)

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [])
  
  // Helper to translate navigation item names
  const translateNavItem = (name: string) => {
    const key = navTranslationKeys[name]
    return key ? t(key) : name
  }

  // Check if user is SaaS admin (no businessId)
  const isSaaSAdmin = user && !user.businessId
  const isAdminRoute = pathname?.startsWith("/admin")
  const isPosRoute = pathname?.startsWith("/pos/")

  // For SaaS admin routes, use only base navigation (no industry-specific items)
  // For business routes, use industry-specific navigation
  const allNavigation: NavigationItem[] = useMemo(() => {
    if (isAdminRoute || isSaaSAdmin) {
      return fullNavigation
    }
    const outlet = currentOutlet || businessOutlet
    const outletSegment = getOutletBusinessRouteSegment(outlet, currentBusiness)
    const industry = outletSegment === "retail" ? "wholesale and retail" : outletSegment
    const nav = getIndustrySidebarConfig(industry as "wholesale and retail" | "restaurant" | "bar")
    const dashboardIndex = nav.findIndex(item => item.name === "Dashboard")
    if (dashboardIndex !== -1 && currentBusiness) {
      nav[dashboardIndex] = { ...nav[dashboardIndex], href: getOutletDashboardRoute(outlet, currentBusiness) }
    }
    return nav
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminRoute, isSaaSAdmin, currentBusiness?.type, currentOutlet?.id, businessOutlet?.id])
  
  // Filter navigation based on user role
  const navigation = allNavigation.filter((item) => hasPermission(item.permission))
  
  // For admin routes, don't require business selection
  // For regular dashboard routes, redirect if no business (unless SaaS admin)
  useEffect(() => {
    if (isAdminRoute) return

    const isDashboardRoute = pathname?.startsWith("/dashboard")
    const isTenantDashboardRoute = pathname?.match(/^\/dashboard\/(retail|restaurant|bar)/)

    if (!isSaaSAdmin && !currentBusiness && isDashboardRoute) {
      if (isTenantDashboardRoute && user?.tenant && !restoringBusinessRef.current) {
        restoringBusinessRef.current = true
        const tenantId = typeof user.tenant === 'object'
          ? String((user.tenant as any).id || user.tenant)
          : String(user.tenant)
        const { setCurrentBusiness } = useBusinessStore.getState()
        setCurrentBusiness(tenantId)
          .catch((error: any) => {
            console.error("Failed to restore business from tenant:", error)
            if (!redirectedRef.current) {
              redirectedRef.current = true
              router.push("/admin")
            }
          })
          .finally(() => {
            restoringBusinessRef.current = false
          })
        return
      }

      if (!redirectedRef.current) {
        redirectedRef.current = true
        router.push("/admin")
      }
    }
  }, [isAdminRoute, isSaaSAdmin, currentBusiness, pathname, router, user])

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-20 bg-card border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center justify-center">
                <PrimePOSLogo variant="icon" size="md" version={1} />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-lg text-xs font-medium transition-colors min-h-[72px]",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  title={translateNavItem(item.name)}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="text-[10px] leading-tight text-center">{translateNavItem(item.name)}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-20">
        {/* Topbar */}
        <header 
          data-navbar="main" 
          className="sticky top-0 z-30 bg-background border-b"
        >
          <div className="flex items-center justify-between px-4 py-3 lg:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Tenant and Outlet Info - Display only, no switching */}
            {!isAdminRoute && !isLoading && currentTenant && (
              <div className="flex items-center gap-4 mr-4 select-none pointer-events-none">
                <div className="text-sm">
                  <span className="font-medium">{currentTenant.name}</span>
                </div>
                {currentOutlet ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{currentOutlet.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Store className="h-4 w-4" />
                    <span>{t("settings.outlets.no_outlet")}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto select-none">
              <Badge
                variant="outline"
                className="flex items-center gap-2 px-3 py-1.5"
                title="Local Print Agent status"
              >
                <span
                  className={cn(
                    "inline-block h-2 w-2 rounded-full",
                    agentStatus === "connected" && "bg-emerald-500",
                    agentStatus === "disconnected" && "bg-red-500",
                    agentStatus === "checking" && "bg-amber-500"
                  )}
                />
                <span className="text-xs">
                  Print Agent: {agentStatus === "connected" ? "Connected" : agentStatus === "disconnected" ? "Offline" : "Checking"}
                </span>
              </Badge>
              {/* Shift Status Indicator - Only show for current outlet */}
              {activeShift && currentOutlet && activeShift.outletId === currentOutlet.id && (() => {
                if (!activeShift.startTime) return null
                try {
                  const date = new Date(activeShift.startTime)
                  if (isNaN(date.getTime())) return null
                  return (
                    <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-xs">
                        {t("shifts.shift")}: {format(date, "HH:mm")}
                      </span>
                    </Badge>
                  )
                } catch {
                  return null
                }
              })()}
              
              {/* User Info - Clickable */}
              {!isAdminRoute && user && (
                <Link href="/dashboard/office/users">
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-2 h-9 px-3 hover:bg-accent"
                  >
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium leading-none">
                        {user?.name || user?.email?.split("@")[0] || "User"}
                      </span>
                      <span className="text-xs text-muted-foreground leading-none mt-0.5 capitalize">
                        {role || "staff"}
                      </span>
                    </div>
                  </Button>
                </Link>
              )}
              
              <NotificationBell />
              <Button 
                variant="ghost" 
                size="icon"
                onClick={async () => {
                  const { logout } = useAuthStore.getState()
                  await logout()
                  router.push("/auth/login")
                }}
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <SubNavbar />
        </header>

        {/* Page Content */}
        <main className={cn("flex-1", isPosRoute ? "overflow-hidden" : "overflow-y-auto")}>
          <div className={cn(isPosRoute ? "h-full min-h-0" : "p-4 lg:p-6 space-y-6")}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

