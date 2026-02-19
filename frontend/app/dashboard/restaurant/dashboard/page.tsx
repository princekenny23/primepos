"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { generateKPIData, generateChartData } from "@/lib/utils/dashboard-stats"
import { saleService } from "@/lib/services/saleService"
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

export default function RestaurantDashboardPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet: businessOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet, isLoading: tenantLoading } = useTenant()
  const { isAuthenticated } = useAuthStore()
  const [kpiData, setKpiData] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)
  
  // Use tenant outlet if available, otherwise fall back to business store outlet
  const currentOutlet = tenantOutlet || businessOutlet
  const posMode = getOutletPosMode(currentOutlet, currentBusiness)
  const outletId = useMemo(() => {
    if (currentOutlet?.id) return String(currentOutlet.id)
    if (typeof window !== "undefined") return localStorage.getItem("currentOutletId") || undefined
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
        console.log("Restoring business from user tenant:", tenantId)
        const { setCurrentBusiness } = useBusinessStore.getState()
        setCurrentBusiness(tenantId).catch((error: any) => {
          console.error("Failed to restore business:", error)
          router.push("/admin")
        })
        return // Wait for business to be restored
      }
      router.push("/admin")
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
      
      setIsLoadingData(true)
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStr = today.toISOString().split("T")[0]

        const [kpi, chart, recentSales, lowStockData] = await Promise.all([
          generateKPIData(currentBusiness.id, currentBusiness, outletId),
          generateChartData(currentBusiness.id, outletId),
          saleService.list({ outlet: outletId, status: "completed", start_date: todayStr, limit: 10 }).catch(() => ({ results: [] })),
          productService.getLowStock(outletId).catch(() => []),
        ])
        
        setKpiData(kpi)
        setChartData(chart)

        // Convert recent sales to activity format
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
        const processedLowStock = lowStock.map((p: any) => {
          const lowVariation = p.variations?.find((v: any) => 
            v.track_inventory && 
            v.low_stock_threshold > 0 && 
            (v.total_stock || v.stock || 0) <= v.low_stock_threshold
          )
          
          return {
            id: p.id,
            name: p.name,
            sku: p.sku || lowVariation?.sku || "N/A",
            currentStock: lowVariation ? (lowVariation.total_stock || lowVariation.stock || 0) : (p.stock || 0),
            minStock: lowVariation ? (lowVariation.low_stock_threshold || 0) : (p.low_stock_threshold || 0),
            category: p.category?.name || "General",
          }
        })
        setLowStockItems(processedLowStock)
      } catch (error) {
        console.error("Failed to load dashboard data:", error)
      } finally {
        setIsLoadingData(false)
      }
    }
    
    if (currentBusiness) {
      loadDashboardData()
    }
  }, [currentBusiness, outletId, refreshTick])

  useEffect(() => {
    const handleDashboardRefresh = () => {
      setRefreshTick((current) => current + 1)
    }

    window.addEventListener("sale-completed", handleDashboardRefresh)
    return () => {
      window.removeEventListener("sale-completed", handleDashboardRefresh)
    }
  }, [])

  if (!currentBusiness || posMode !== "restaurant" || isLoadingData || tenantLoading || !kpiData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading dashboard...</p>
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
    transactions: { value: 0, change: 0 },
    avgOrderValue: { value: 0, change: 0 },
    lowStockItems: { value: 0, change: 0 },
    outstandingCredit: { value: 0, change: 0 },
    returns: { value: 0, change: 0 },
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
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
            <DateRangeFilter />
          </div>
        </div>

        {/* KPI Cards */}
        <KPICards data={displayKpiData} business={currentBusiness} />

        {/* Charts */}
        <div className="grid gap-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Sales Overview</CardTitle>
              <CardDescription>Sales and profit trends over the last 7 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChart data={chartData} type="area" />
            </CardContent>
          </Card>
        </div>

        {/* Low Stock and Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2">
          <LowStockAlerts items={lowStockItems} />
          <RecentActivity activities={recentActivities} business={currentBusiness} />
        </div>

      </div>
    </DashboardLayout>
  )
}

