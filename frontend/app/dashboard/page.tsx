"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { generateKPIData, generateChartData, generateActivityData, generateTopSellingItems } from "@/lib/utils/dashboard-stats"
import { productService } from "@/lib/services/productService"
import { saleService } from "@/lib/services/saleService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts"
import { TopSellingItems } from "@/components/dashboard/top-selling-items"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Store, Settings2 } from "lucide-react"
import { DateRangeFilter } from "@/components/dashboard/date-range-filter"
import { ViewSaleDetailsModal } from "@/components/modals/view-sale-details-modal"
import { CustomizeDashboardModal } from "@/components/modals/customize-dashboard-modal"
import { PageRefreshButton } from "@/components/dashboard/page-refresh-button"

export default function DashboardPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet, isLoading } = useTenant()
  const [showCustomize, setShowCustomize] = useState(false)
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [showSaleDetails, setShowSaleDetails] = useState(false)
  const [kpiData, setKpiData] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [topItems, setTopItems] = useState<any[]>([])
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const loadingRef = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
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
      // No retail-specific dashboard; stay on main dashboard
      // Redirect restaurant to dashboard (not features page)
      if (currentBusiness.type === "restaurant") {
        router.push("/dashboard/restaurant/dashboard")
        return
      }
      
      // Redirect bar to dashboard (not features page)
      if (currentBusiness.type === "bar") {
        router.push("/dashboard/bar/dashboard")
        return
      }
    }
  }, [currentBusiness, router])
  
  // Load dashboard data with optimized callback
  const loadDashboardData = useCallback(async () => {
    if (!currentBusiness || loadingRef.current) return
    
    loadingRef.current = true
    setIsLoadingData(true)
    try {
      const [kpi, chart, activity, top, lowStockData] = await Promise.all([
        generateKPIData(currentBusiness.id, currentBusiness, outletId),
        generateChartData(currentBusiness.id, outletId),
        generateActivityData(currentBusiness.id, outletId),
        generateTopSellingItems(currentBusiness.id, outletId),
        // Use getLowStock instead of loading all products
        productService.getLowStock(outletId).catch(() => []),
      ])
      
      setKpiData(kpi)
      setChartData(chart)
      setActivities(activity)
      setTopItems(top)
      
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
    
    // Auto-refresh dashboard data every 30 seconds for real-time updates
    intervalRef.current = setInterval(() => {
      loadDashboardData()
    }, 30000)
    
    // Listen for outlet changes
    const handleOutletChange = () => {
      loadDashboardData()
    }
    
    // Listen for sale completion events to refresh dashboard
    const handleSaleCompleted = () => {
      loadDashboardData()
    }
    
    window.addEventListener("outlet-changed", handleOutletChange)
    window.addEventListener("sale-completed", handleSaleCompleted)
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      window.removeEventListener("outlet-changed", handleOutletChange)
      window.removeEventListener("sale-completed", handleSaleCompleted)
    }
  }, [currentBusiness?.id, outletId, loadDashboardData])

  const [recentSales, setRecentSales] = useState<any[]>([])
  const recentSalesIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Optimized recent sales loader
  const loadRecentSales = useCallback(async () => {
    if (!currentBusiness) return
    
    try {
      const salesData = await saleService.list({ 
        outlet: outletId,
        status: "completed",
        page: 1,
      })
      setRecentSales(Array.isArray(salesData) ? salesData : (salesData.results || []).slice(0, 10))
    } catch (error) {
      console.error("Failed to load recent sales:", error)
      setRecentSales([])
    }
  }, [currentBusiness, outletId])

  useEffect(() => {
    if (!currentBusiness) return
    
    loadRecentSales()
    
    // Auto-refresh recent sales every 30 seconds for real-time updates
    recentSalesIntervalRef.current = setInterval(() => {
      loadRecentSales()
    }, 30000)
    
    // Listen for sale completion events to refresh recent sales immediately
    const handleSaleCompleted = () => {
      loadRecentSales()
    }
    
    window.addEventListener("sale-completed", handleSaleCompleted)
    
    return () => {
      if (recentSalesIntervalRef.current) {
        clearInterval(recentSalesIntervalRef.current)
        recentSalesIntervalRef.current = null
      }
      window.removeEventListener("sale-completed", handleSaleCompleted)
    }
  }, [currentBusiness?.id, outletId, loadRecentSales])

  const handleViewSale = useCallback(async (saleId: string) => {
    try {
      const sale = await saleService.get(saleId)
      setSelectedSale(sale)
      setShowSaleDetails(true)
    } catch (error) {
      console.error("Failed to load sale:", error)
    }
  }, [])
  
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
          </div>
          <div className="flex items-center gap-2">
            <PageRefreshButton />
            <DateRangeFilter />
            <Button variant="outline" onClick={() => setShowCustomize(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Customize
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <KPICards data={displayKpiData} business={currentBusiness} />

        {/* Charts and Activity */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sales Overview</CardTitle>
              <CardDescription>Sales and profit trends over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesChart data={chartData} type="area" />
            </CardContent>
          </Card>

          <RecentActivity activities={activities} business={currentBusiness} />
        </div>

        {/* Low Stock and Top Selling */}
        <div className="grid gap-4 md:grid-cols-2">
          <LowStockAlerts items={lowStockItems} />
          <TopSellingItems items={topItems} business={currentBusiness} />
        </div>

        {/* Recent Sales with Click to View */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>Click on any sale to view details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSales.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No recent sales</p>
              ) : (
                recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 cursor-pointer hover:bg-accent/50 p-2 rounded transition-colors"
                    onClick={() => handleViewSale(sale.id)}
                  >
                    <div>
                      <p className="font-medium">Sale #{sale.receipt_number || sale.id.slice(-6)}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(sale.created_at || sale.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {currentBusiness?.currencySymbol || "MWK"} {sale.total.toFixed(2)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <CustomizeDashboardModal open={showCustomize} onOpenChange={setShowCustomize} />
      <ViewSaleDetailsModal
        open={showSaleDetails}
        onOpenChange={setShowSaleDetails}
        sale={selectedSale}
      />
    </DashboardLayout>
  )
}
