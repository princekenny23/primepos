"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
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

export default function DashboardPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet, isLoading } = useTenant()
  const outlet = tenantOutlet || currentOutlet
  const posMode = getOutletPosMode(outlet, currentBusiness)
  const [kpiData, setKpiData] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const loadingRef = useRef(false)
  
  // Memoize outlet ID to prevent unnecessary re-renders
  const outletId = useMemo(() => currentOutlet?.id || tenantOutlet?.id, [currentOutlet?.id, tenantOutlet?.id])
  
  // Redirect based on business type (only if on main dashboard, not if already on business-specific dashboard)
  useEffect(() => {
    if (!currentBusiness) {
      router.push("/admin")
      return
    }
    
    // Only redirect if we're on the main dashboard page, not if already on business-specific dashboard
    const currentPath = window.location.pathname
    if (currentPath === "/dashboard" || currentPath === "/dashboard/") {
      if (posMode !== "standard") {
        router.push(getOutletDashboardRoute(outlet, currentBusiness))
        return
      }
    }
  }, [currentBusiness, outlet, posMode, router])
  
  // Load dashboard data with optimized callback
  const loadDashboardData = useCallback(async () => {
    if (!currentBusiness || loadingRef.current) return
    
    loadingRef.current = true
    setIsLoadingData(true)
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split("T")[0]

      const [kpi, chart, recentSales, lowStockData] = await Promise.all([
        generateKPIData(currentBusiness.id, currentBusiness, outletId),
        generateChartData(currentBusiness.id, outletId),
        saleService.list({ outlet: outletId, status: "completed", start_date: todayStr, limit: 10 }).catch(() => ({ results: [] })),
        // Use getLowStock instead of loading all products
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
      
      // Process low stock items
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
      loadingRef.current = false
    }
  }, [currentBusiness, outletId])
  
  useEffect(() => {
    if (!currentBusiness) return
    loadDashboardData()
  }, [currentBusiness, outletId, loadDashboardData])

  useEffect(() => {
    const handleDashboardRefresh = () => {
      loadDashboardData()
    }

    window.addEventListener("sale-completed", handleDashboardRefresh)
    return () => {
      window.removeEventListener("sale-completed", handleDashboardRefresh)
    }
  }, [loadDashboardData])

  
  // Memoize default KPI data to prevent recreation
  const defaultKpiData = useMemo(() => ({
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
  if (isLoadingData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">Dashboard</h1>
              {!isLoading && currentOutlet && (
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
