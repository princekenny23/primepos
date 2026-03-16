"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { generateKPIData, generateChartData } from "@/lib/utils/dashboard-stats"
import { saleService } from "@/lib/services/saleService"
import { productService } from "@/lib/services/productService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Store } from "lucide-react"
import { DateRangeFilter } from "@/components/dashboard/date-range-filter"
import { PageRefreshButton } from "@/components/dashboard/page-refresh-button"
import { getOutletDashboardRoute, getOutletPosMode } from "@/lib/utils/outlet-settings"
import { useAuthStore } from "@/stores/authStore"
import { mapExpiryAlerts, mapLowStockAlerts } from "@/lib/utils/inventory-alerts"
import { useRole } from "@/contexts/role-context"

function formatDate(date?: Date) {
  if (!date) return undefined
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split("T")[0]
}

export default function DashboardPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet: businessOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet, isLoading: tenantLoading } = useTenant()
  const currentOutlet = tenantOutlet || businessOutlet
  const outlet = currentOutlet
  const posMode = getOutletPosMode(outlet, currentBusiness)
  const [kpiData, setKpiData] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [expiryItems, setExpiryItems] = useState<any[]>([])
  const [selectedRange, setSelectedRange] = useState<{ start?: Date; end?: Date }>(() => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    return { start, end }
  })
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)
  const [dashboardWarning, setDashboardWarning] = useState<string | null>(null)
  const restoringBusinessRef = useRef(false)
  const inFlightLoadRef = useRef<Promise<void> | null>(null)
  const lastLoadKeyRef = useRef<string>("")
  const { user } = useAuthStore()
  const { hasPermission } = useRole()
  const userRole = String(user?.effective_role || user?.role || "staff").toLowerCase()
  const isAdminUser = Boolean(user?.is_saas_admin) || userRole.includes("admin")
  const tenantPermissions =
    user && typeof user.tenant === "object" && user.tenant !== null
      ? (user.tenant as any).permissions
      : undefined
  const canSeeInventoryWidgets =
    !tenantPermissions ||
    user?.is_saas_admin ||
    (tenantPermissions.allow_inventory !== false && tenantPermissions.allow_inventory_products !== false)
  const canAccessPos = !tenantPermissions || user?.is_saas_admin || tenantPermissions.allow_pos !== false
  const canAccessDashboard = hasPermission("dashboard")

  useEffect(() => {
    if (canAccessDashboard) return
    if (hasPermission("pos") && canAccessPos) {
      router.replace("/dashboard/pos")
      return
    }
    if (hasPermission("sales")) {
      router.replace("/dashboard/sales")
      return
    }
    router.replace("/onboarding/setup-business")
  }, [canAccessDashboard, canAccessPos, hasPermission, router])
  
  // Memoize outlet ID to prevent unnecessary re-renders
  const outletId = useMemo(() => {
    if (currentOutlet?.id) return String(currentOutlet.id)
    return undefined
  }, [currentOutlet?.id])

  // Redirect based on business type (only if on main dashboard, not if already on business-specific dashboard)
  useEffect(() => {
    if (!currentBusiness) {
      const hasAuthToken = typeof window !== "undefined" && !!localStorage.getItem("authToken")
      if (!user && hasAuthToken) return

      if (user?.tenant) {
        if (restoringBusinessRef.current) return
        restoringBusinessRef.current = true
        const tenantId = typeof user.tenant === "object"
          ? String((user.tenant as any).id || user.tenant)
          : String(user.tenant)
        const { setCurrentBusiness } = useBusinessStore.getState()
        setCurrentBusiness(tenantId)
          .catch((error: any) => {
            console.error("Failed to restore business from user tenant:", error)
            router.push(user?.is_saas_admin ? "/admin" : "/onboarding/setup-business")
          })
          .finally(() => {
            restoringBusinessRef.current = false
          })
        return
      }

      router.push(user?.is_saas_admin ? "/admin" : "/onboarding/setup-business")
      return
    }
    
    // Only redirect if we're on the main dashboard page, not if already on business-specific dashboard
    const currentPath = window.location.pathname
    if (currentPath === "/dashboard" || currentPath === "/dashboard/") {
      if (!isAdminUser && canAccessPos) {
        router.push("/dashboard/pos")
        return
      }

      if (posMode !== "standard") {
        router.push(getOutletDashboardRoute(outlet, currentBusiness))
        return
      }
    }
  }, [currentBusiness, outlet, posMode, router, isAdminUser, user, canAccessPos])
  
  // Load dashboard data with optimized callback
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!currentBusiness) return

      const startDateKey = selectedRange.start ? formatDate(selectedRange.start) : "none"
      const endDateKey = selectedRange.end ? formatDate(selectedRange.end) : "none"
      const loadKey = `${currentBusiness.id}:${outletId || "all"}:${startDateKey}:${endDateKey}:${refreshTick}`

      if (inFlightLoadRef.current && lastLoadKeyRef.current === loadKey) {
        return
      }

      lastLoadKeyRef.current = loadKey

      const loader = (async () => {
        setIsLoadingData(true)
        setDashboardWarning(null)
        try {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const startDate = selectedRange.start || today
          const endDate = selectedRange.end || today
          const startDateStr = formatDate(startDate)
          const endDateStr = formatDate(endDate)

          const [kpi, chart, recentSales, lowStockData, productsData] = await Promise.all([
            generateKPIData(currentBusiness.id, currentBusiness, outletId, selectedRange),
            generateChartData(currentBusiness.id, outletId, selectedRange),
            saleService.list({ outlet: outletId, status: "completed", start_date: startDateStr, end_date: endDateStr, limit: 10 }).catch(() => ({ results: [] })),
            productService.getLowStock(outletId).catch(() => []),
            productService.list({ outlet: outletId, limit: 1000 }).catch(() => ({ results: [] })),
          ])

          setKpiData(kpi)
          setChartData(chart)

          const sales = Array.isArray(recentSales) ? recentSales : (recentSales.results || [])
          const activities = sales.map((sale: any) => ({
            id: sale.id || `sale-${Math.random()}`,
            type: "sale" as const,
            title: `Sale #${sale.id?.toString().slice(-6)}`,
            description: `${sale.items?.length || 1} item(s) - Amount: ${sale.total || sale.amount || 0}`,
            timestamp: new Date(sale.created_at || new Date()),
            amount: sale.total || sale.amount || 0,
          }))
          setRecentActivities(activities)

          const lowStock = Array.isArray(lowStockData) ? lowStockData : ((lowStockData as any)?.results || [])
          setLowStockItems(mapLowStockAlerts(lowStock))

          const products = Array.isArray(productsData) ? productsData : (productsData.results || [])
          setExpiryItems(mapExpiryAlerts(products))
        } catch (error: any) {
          console.error("Failed to load dashboard data:", error)
          if (error?.status === 429 || String(error?.message || "").toLowerCase().includes("throttled")) {
            setDashboardWarning("Backend is throttling requests. Showing cached or partial data until cooldown ends.")
          }
        } finally {
          setIsLoadingData(false)
        }
      })()

      inFlightLoadRef.current = loader
      await loader
      if (inFlightLoadRef.current === loader) {
        inFlightLoadRef.current = null
      }
    }

    if (currentBusiness) {
      loadDashboardData()
    }
  }, [currentBusiness, outletId, refreshTick, selectedRange])

  useEffect(() => {
    const handleDashboardRefresh = () => {
      setRefreshTick((current) => current + 1)
    }

    window.addEventListener("sale-completed", handleDashboardRefresh)
    window.addEventListener("expense-updated", handleDashboardRefresh)
    return () => {
      window.removeEventListener("sale-completed", handleDashboardRefresh)
      window.removeEventListener("expense-updated", handleDashboardRefresh)
    }
  }, [])

  
  // Memoize default KPI data to prevent recreation
  const defaultKpiData = useMemo(() => ({
    sales: { value: 0, change: 0 },
    customers: { value: 0, change: 0 },
    products: { value: 0, change: 0 },
    expenses: { value: 0, change: 0 },
    profit: { value: 0, change: 0 },
    lowStockItems: { value: 0, change: 0 },
    outstandingCredit: { value: 0, change: 0 },
    returns: { value: 0, change: 0 },
  }), [])
  
  // Initialize with default KPI data if not loaded
  const displayKpiData = useMemo(() => kpiData || defaultKpiData, [kpiData, defaultKpiData])
  
  // Show loading or nothing while redirecting
  if (!currentBusiness) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading business...</p>
        </div>
      </DashboardLayout>
    )
  }

  // Show loading while data is being fetched
  if (isLoadingData && !kpiData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (!canAccessDashboard) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {dashboardWarning && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {dashboardWarning}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">Dashboard</h1>
              {!tenantLoading && currentOutlet && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                  <Store className="h-4 w-4" />
                  <span>{currentOutlet.name}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Daily performance overview across sales, customers, and financial activity.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PageRefreshButton />
            <DateRangeFilter onRangeChange={setSelectedRange} />
          </div>
        </div>

        {/* KPI Cards */}
        <KPICards data={displayKpiData} business={currentBusiness} />

        {/* Charts */}
        <div className="grid gap-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Sales Overview</CardTitle>
              <CardDescription>Sales and profit trends for the selected period.</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChart data={chartData} type="area" />
            </CardContent>
          </Card>
        </div>

        {/* Low Stock and Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2">
          {canSeeInventoryWidgets && <LowStockAlerts items={lowStockItems} expiryItems={expiryItems} />}
          <RecentActivity activities={recentActivities} business={currentBusiness} />
        </div>

      </div>
    </DashboardLayout>
  )
}
