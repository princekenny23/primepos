"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { generateKPIData, generateChartData, generateTopSellingItems } from "@/lib/utils/dashboard-stats"
import { productService } from "@/lib/services/productService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { useAuthStore } from "@/stores/authStore"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { LowStockAlerts } from "@/components/dashboard/low-stock-alerts"
import { TopSellingItems } from "@/components/dashboard/top-selling-items"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Store, Settings2 } from "lucide-react"
import { DateRangeFilter } from "@/components/dashboard/date-range-filter"
import { CustomizeDashboardModal } from "@/components/modals/customize-dashboard-modal"
import { getOutletDashboardRoute, getOutletPosMode } from "@/lib/utils/outlet-settings"

export default function BarDashboardPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet: businessOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet, isLoading: tenantLoading } = useTenant()
  const { isAuthenticated } = useAuthStore()
  const [showCustomize, setShowCustomize] = useState(false)
  const [kpiData, setKpiData] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [topItems, setTopItems] = useState<any[]>([])
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  
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
    
    if (posMode !== "bar") {
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
        const [kpi, chart, top, lowStockData] = await Promise.all([
          generateKPIData(currentBusiness.id, currentBusiness, outletId),
          generateChartData(currentBusiness.id, outletId),
          generateTopSellingItems(currentBusiness.id, outletId),
          productService.getLowStock(outletId).catch(() => []),
        ])
        
        setKpiData(kpi)
        setChartData(chart)
        setTopItems(top)

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
  }, [currentBusiness, outletId])

  if (!currentBusiness || posMode !== "bar" || isLoadingData || tenantLoading || !kpiData) {
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">Bar Dashboard</h1>
              {currentOutlet && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                  <Store className="h-4 w-4" />
                  <span>{currentOutlet.name}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DateRangeFilter />
            <Button variant="outline" onClick={() => setShowCustomize(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Customize
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <KPICards data={displayKpiData} business={currentBusiness} />

        {/* Charts */}
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
        </div>

        {/* Low Stock and Top Selling */}
        <div className="grid gap-4 md:grid-cols-2">
          <LowStockAlerts items={lowStockItems} />
          <TopSellingItems items={topItems} business={currentBusiness} />
        </div>

      </div>

      {/* Modals */}
      <CustomizeDashboardModal open={showCustomize} onOpenChange={setShowCustomize} />
    </DashboardLayout>
  )
}

