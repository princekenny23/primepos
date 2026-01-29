"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ReportFilters } from "@/components/reports/report-filters"
import { Package, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"
import { useState, useEffect } from "react"
import { ExportReportModal } from "@/components/modals/export-report-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { reportService } from "@/lib/services/reportService"
import { productService } from "@/lib/services/productService"
import { saleService } from "@/lib/services/saleService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"

export default function ProductsReportsPage() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [productPerformance, setProductPerformance] = useState<any[]>([])
  const [categoryPerformance, setCategoryPerformance] = useState<any[]>([])
  const [stats, setStats] = useState({ totalProducts: 0, totalSold: 0, lowStock: 0, outOfStock: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const useReal = useRealAPI()

  useEffect(() => {
    const loadReportData = async () => {
      if (!currentBusiness) return
      
      setIsLoading(true)
      try {
        if (useReal) {
          const [reportData, productsData, salesData] = await Promise.all([
            reportService.getProductReport({
              tenant: currentBusiness.id,
              outlet: currentOutlet?.id,
            }),
            productService.list({ businessId: currentBusiness.id, is_active: true }),
            saleService.list({ tenant: currentBusiness.id, outlet: currentOutlet?.id, status: "completed", limit: 1000 }),
          ])
          
          setProductPerformance(reportData)
          
          // Calculate category performance
          const products = Array.isArray(productsData) ? productsData : productsData.results || []
          const sales = Array.isArray(salesData) ? salesData : salesData.results || []
          
          const categorySales: Record<string, { products: number; sold: number; revenue: number }> = {}
          products.forEach((product: any) => {
            const categoryName = product.category?.name || product.categoryId || "Uncategorized"
            if (!categorySales[categoryName]) {
              categorySales[categoryName] = { products: 0, sold: 0, revenue: 0 }
            }
            categorySales[categoryName].products += 1
          })
          
          sales.forEach((sale: any) => {
            sale.items?.forEach((item: any) => {
              const product = products.find((p: any) => p.id === (item.product_id || item.productId))
              if (product) {
                const categoryName = product.category?.name || product.categoryId || "Uncategorized"
                if (categorySales[categoryName]) {
                  categorySales[categoryName].sold += item.quantity || 0
                  categorySales[categoryName].revenue += (item.price || 0) * (item.quantity || 0)
                }
              }
            })
          })
          
          setCategoryPerformance(Object.entries(categorySales).map(([category, data]) => ({
            category,
            ...data,
          })))
          
          // Calculate stats
          const lowStockProducts = products.filter((p: any) => 
            p.low_stock_threshold && p.stock <= p.low_stock_threshold && p.stock > 0
          )
          const outOfStockProducts = products.filter((p: any) => (p.stock || 0) === 0)
          
          setStats({
            totalProducts: products.length,
            totalSold: sales.reduce((sum: number, s: any) => 
              sum + (s.items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0) || 0), 0
            ),
            lowStock: lowStockProducts.length,
            outOfStock: outOfStockProducts.length,
          })
        } else {
          setProductPerformance([])
          setCategoryPerformance([])
          setStats({ totalProducts: 0, totalSold: 0, lowStock: 0, outOfStock: 0 })
        }
      } catch (error) {
        console.error("Failed to load product report:", error)
        setProductPerformance([])
        setCategoryPerformance([])
      } finally {
        setIsLoading(false)
      }
    }
    
    loadReportData()
  }, [currentBusiness, currentOutlet, useReal])

  return (
    <DashboardLayout>
      <PageLayout
        title="Product Reports"
        description="Analyze product performance and inventory"
      >

        <ReportFilters
          onExport={() => setShowExport(true)}
          onPrint={() => setShowPrint(true)}
          onSettings={() => setShowSettings(true)}
        />

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProducts}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Across all categories"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sold</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSold.toLocaleString('en-US')}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Units sold"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.lowStock}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Products need restocking"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.outOfStock}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Products unavailable"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Product Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Product Performance</CardTitle>
            <CardDescription>Top products by sales and revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Units Sold</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">Loading product performance...</p>
                    </TableCell>
                  </TableRow>
                ) : productPerformance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">No product data available</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  productPerformance.map((product, idx) => {
                    const stockStatus = (product.stock || 0) === 0 ? "Out of Stock" :
                                      (product.low_stock_threshold && product.stock <= product.low_stock_threshold) ? "Low Stock" :
                                      "In Stock"
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.sold || product.quantity || 0}</TableCell>
                        <TableCell className="font-semibold">
                          {currentBusiness?.currencySymbol || "MWK"} {(product.revenue || 0).toLocaleString('en-US')}
                        </TableCell>
                        <TableCell>{product.stock || 0}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            stockStatus === "In Stock" ? "bg-green-100 text-green-800" :
                            stockStatus === "Low Stock" ? "bg-orange-100 text-orange-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {stockStatus}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Category Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Sales breakdown by category</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Units Sold</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <p className="text-muted-foreground">Loading category performance...</p>
                    </TableCell>
                  </TableRow>
                ) : categoryPerformance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <p className="text-muted-foreground">No category data available</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  categoryPerformance.map((category, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{category.category}</TableCell>
                      <TableCell>{category.products}</TableCell>
                      <TableCell>{category.sold}</TableCell>
                      <TableCell className="font-semibold">
                        {currentBusiness?.currencySymbol || "MWK"} {(category.revenue || 0).toLocaleString('en-US')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      {/* Modals */}
      <DataExchangeModal
        open={showExport}
        onOpenChange={setShowExport}
        type="export"
        config={dataExchangeConfigs.reports}
      />
      <PrintReportModal
        open={showPrint}
        onOpenChange={setShowPrint}
        reportType="Product Report"
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
      </PageLayout>
    </DashboardLayout>
  )
}

