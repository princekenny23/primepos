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
import { SalesChart } from "@/components/dashboard/sales-chart"
import { DollarSign, TrendingUp, ShoppingCart, CreditCard } from "lucide-react"
import { useState, useEffect } from "react"
import { ExportReportModal } from "@/components/modals/export-report-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { reportService } from "@/lib/services/reportService"
import { saleService } from "@/lib/services/saleService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"

export default function SalesReportsPage() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [salesData, setSalesData] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const useReal = useRealAPI()

  useEffect(() => {
    const loadReportData = async () => {
      if (!currentBusiness) return
      
      setIsLoading(true)
      try {
        if (useReal) {
          const [reportData, salesResponse] = await Promise.all([
            reportService.getSalesReport({
              tenant: currentBusiness.id,
              outlet: currentOutlet?.id,
            }),
            saleService.list({
              tenant: currentBusiness.id,
              outlet: currentOutlet?.id,
              status: "completed",
              limit: 100,
            }),
          ])
          
          setSalesData(reportData)
          
          // Calculate top products from sales
          const productSales: Record<string, { name: string; sales: number; quantity: number; revenue: number }> = {}
          const sales = Array.isArray(salesResponse) ? salesResponse : salesResponse.results || []
          
          sales.forEach((sale: any) => {
            sale.items?.forEach((item: any) => {
              const productId = item.product_id || item.productId
              if (!productSales[productId]) {
                productSales[productId] = {
                  name: item.product_name || item.name || "Unknown",
                  sales: 0,
                  quantity: 0,
                  revenue: 0,
                }
              }
              productSales[productId].sales += 1
              productSales[productId].quantity += item.quantity || 0
              productSales[productId].revenue += (item.price || 0) * (item.quantity || 0)
            })
          })
          
          setTopProducts(
            Object.values(productSales)
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 10)
          )
        } else {
          // Simulation mode - empty data
          setSalesData([])
          setTopProducts([])
        }
      } catch (error) {
        console.error("Failed to load report data:", error)
        setSalesData([])
        setTopProducts([])
      } finally {
        setIsLoading(false)
      }
    }
    
    loadReportData()
  }, [currentBusiness, currentOutlet, useReal])

  const totalSales = salesData.reduce((sum, d) => sum + (d.sales || d.revenue || 0), 0)
  const totalTransactions = salesData.reduce((sum, d) => sum + (d.transactions || 0), 0)
  const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0

  return (
    <DashboardLayout>
      <PageLayout
        title="Sales Reports"
        description="Analyze your sales performance and trends"
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
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {totalSales.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : `${salesData.length} days of data`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTransactions}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Total transactions"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Transaction</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {avgTransaction.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Average per transaction"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Cash, Card, Mobile</p>
            </CardContent>
          </Card>
        </div>

        {/* Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
            <CardDescription>Daily sales performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChart data={salesData} />
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>Best performing products by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Sales Count</TableHead>
                  <TableHead>Quantity Sold</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <p className="text-muted-foreground">Loading top products...</p>
                    </TableCell>
                  </TableRow>
                ) : topProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <p className="text-muted-foreground">No product data available</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  topProducts.map((product, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sales}</TableCell>
                      <TableCell>{product.quantity}</TableCell>
                      <TableCell className="font-semibold">
                        {currentBusiness?.currencySymbol || "MWK"} {product.revenue.toLocaleString('en-US')}
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
        reportType="Sales Report"
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
      </PageLayout>
    </DashboardLayout>
  )
}

