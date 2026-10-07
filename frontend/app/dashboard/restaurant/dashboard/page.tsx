"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { generateKPIData, generateChartData } from "@/lib/utils/dashboard-stats"
import { productService } from "@/lib/services/productService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { useAuthStore } from "@/stores/authStore"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Store } from "lucide-react"
import { DateRangeFilter } from "@/components/dashboard/date-range-filter"
import { PageRefreshButton } from "@/components/dashboard/page-refresh-button"
import { getOutletDashboardRoute, getOutletPosMode } from "@/lib/utils/outlet-settings"
import { mapExpiryAlerts, mapLowStockAlerts } from "@/lib/utils/inventory-alerts"
import { APP_REFRESH_EVENT } from "@/lib/utils/page-refresh"
import { PageLoading } from "@/components/ui/page-loading"

function formatDate(date?: Date) {
  if (!date) return undefined
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function RestaurantDashboardPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet: businessOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet, isLoading: tenantLoading } = useTenant()
  const { isAuthenticated } = useAuthStore()
  const [kpiData, setKpiData] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [expiryItems, setExpiryItems] = useState<any[]>([])
  const [selectedRange, setSelectedRange] = useState<{ start?: Date; end?: Date }>(() => {
    const end = new Date()
    const start = new Date(end)
    return { start, end }
  })
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)
  const [dashboardWarning, setDashboardWarning] = useState<string | null>(null)
  const inFlightLoadRef = useRef<Promise<void> | null>(null)
  const lastLoadKeyRef = useRef<string>("")
  const loadSequenceRef = useRef(0)
  
  // Use tenant outlet if available, otherwise fall back to business store outlet
  const currentOutlet = tenantOutlet || businessOutlet
  const posMode = getOutletPosMode(currentOutlet, currentBusiness)
  const outletId = useMemo(() => {
    if (currentOutlet?.id) return String(currentOutlet.id)
    return undefined
  }, [currentOutlet?.id])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login")
      return
    }
    
    // If no current business, try to restore from user's tenant
    if (!currentBusiness) {
      const { user } = useAuthStore.getState()
      if (user?.tenant) {
        const tenantId = typeof user.tenant === 'object' 
          ? String(user.tenant.id || user.tenant) 
          : String(user.tenant)
        const { setCurrentBusiness } = useBusinessStore.getState()
        setCurrentBusiness(tenantId).catch((error: any) => {
          console.error("Failed to restore business:", error)
          router.push(user?.is_saas_admin ? "/admin" : "/onboarding/setup-business")
        })
        return // Wait for business to be restored
      }
      router.push(user?.is_saas_admin ? "/admin" : "/onboarding/setup-business")
      return
    }
    
    if (posMode !== "restaurant") {
      router.push(getOutletDashboardRoute(currentOutlet, currentBusiness))
      return
    }
  }, [currentBusiness, currentOutlet, isAuthenticated, posMode, router])

  // Load dashboard data
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
      const requestId = ++loadSequenceRef.current

      const loader = (async () => {
      
        setIsLoadingData(true)
        setDashboardWarning(null)
        try {
          const [kpi, chart, lowStockData, productsData] = await Promise.all([
            generateKPIData(currentBusiness.id, currentBusiness, outletId, selectedRange),
            generateChartData(currentBusiness.id, outletId, selectedRange),
            productService.getLowStock(outletId).catch(() => []),
            productService.list({ outlet: outletId, limit: 100 }).catch(() => ({ results: [] })),
          ])
          if (requestId !== loadSequenceRef.current) return
          
          setKpiData(kpi)
          setChartData(chart)

          const lowStock = Array.isArray(lowStockData) ? lowStockData : ((lowStockData as any)?.results || [])
          setLowStockItems(mapLowStockAlerts(lowStock))

          const products = Array.isArray(productsData) ? productsData : (productsData.results || [])
          setExpiryItems(mapExpiryAlerts(products))
        } catch (error: any) {
          if (requestId !== loadSequenceRef.current) return
          console.error("Failed to load dashboard data:", error)
          if (error?.status === 429 || String(error?.message || "").toLowerCase().includes("throttled")) {
            setDashboardWarning("Backend is throttling requests. Showing cached or partial data until cooldown ends.")
          }
        } finally {
          if (requestId === loadSequenceRef.current) setIsLoadingData(false)
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
    window.addEventListener(APP_REFRESH_EVENT, handleDashboardRefresh)
    return () => {
      window.removeEventListener("sale-completed", handleDashboardRefresh)
      window.removeEventListener("expense-updated", handleDashboardRefresh)
      window.removeEventListener(APP_REFRESH_EVENT, handleDashboardRefresh)
    }
  }, [])

  if (!currentBusiness || posMode !== "restaurant" || (isLoadingData && !kpiData) || tenantLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <PageLoading label="Loading restaurant dashboard…" />
        </div>
      </DashboardLayout>
    )
  }

  // Initialize with default KPI data if not loaded
  const displayKpiData = kpiData || {
    sales: { value: 0, change: 0 },
    customers: { value: 0, change: 0 },
    products: { value: 0, change: 0 },
    expenses: { value: 0, change: 0 },
    profit: { value: 0, change: 0 },
    lowStockItems: { value: 0, change: 0 },
    outstandingCredit: { value: 0, change: 0 },
    returns: { value: 0, change: 0 },
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
              <h1 className="text-3xl font-bold">Restaurant Dashboard</h1>
              {currentOutlet && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                  <Store className="h-4 w-4" />
                  <span>{currentOutlet.name}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Daily performance overview for restaurant sales, customers, and financial activity.</p>
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
          <LowStockAlerts items={lowStockItems} expiryItems={expiryItems} />
          <RecentActivity />
        </div>

      </div>
    </DashboardLayout>
  )
}

