"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { RefreshCw, FileSpreadsheet, Printer } from "lucide-react"
import { DataExchangeModal } from "@/components/modals/data-exchange-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { dataExchangeConfigs } from "@/lib/utils/data-exchange-config"
import { useI18n } from "@/contexts/i18n-context"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { reportService } from "@/lib/services/reportService"
import { saleService } from "@/lib/services/saleService"
import { format } from "date-fns"
import { useToast } from "@/components/ui/use-toast"

export default function SalesReportsPage() {
  const { t } = useI18n()
  const { currentBusiness } = useBusinessStore()
  const { currentOutlet } = useTenant()
  const { toast } = useToast()
  
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    return format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
  })
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  
  const [salesData, setSalesData] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])

  const loadReportData = async () => {
    if (!currentBusiness || !currentOutlet) return
    
    setIsLoading(true)
    try {
      // Load sales data
      const [salesResponse, topProductsResponse] = await Promise.all([
        saleService.list({
          outlet: currentOutlet.id,
          status: 'completed',
        }),
        reportService.getTopProducts({
          outlet: String(currentOutlet.id),
          start_date: startDate,
          end_date: endDate,
        }, 10),
      ])
      
      const sales = Array.isArray(salesResponse) ? salesResponse : (salesResponse.results || [])
      
      // Group sales by date for chart
      const salesByDate: Record<string, { sales: number; transactions: number }> = {}
      sales.forEach((sale: any) => {
        const date = format(new Date(sale.created_at), 'yyyy-MM-dd')
        if (!salesByDate[date]) {
          salesByDate[date] = { sales: 0, transactions: 0 }
        }
        salesByDate[date].sales += sale.total || 0
        salesByDate[date].transactions += 1
      })
      
      const chartData = Object.entries(salesByDate).map(([date, data]) => ({
        date,
        sales: data.sales,
        transactions: data.transactions,
      })).sort((a, b) => a.date.localeCompare(b.date))
      
      setSalesData(chartData)
      setTopProducts(topProductsResponse?.top_products || [])
    } catch (error) {
      console.error("Failed to load sales report:", error)
      toast({
        title: t("common.messages.error"),
        description: "Failed to load sales report data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadReportData()
  }, [currentBusiness, currentOutlet])

  const handleApplyFilters = () => {
    loadReportData()
  }

  const formatCurrency = (value: number) => {
    return `${currentBusiness?.currencySymbol || "MK"} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={t("reports.menu.sales")}
        description={t("reports.daily_sales.title")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {t("reports.actions.export_excel")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowPrint(true)}>
              <Printer className="mr-2 h-4 w-4" />
              {t("reports.actions.print")}
            </Button>
          </div>
        }
      >
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("common.filters")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>{t("common.time.from")}</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.time.to")}</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleApplyFilters} disabled={isLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  {t("common.actions.apply")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("reports.daily_sales.title")}</CardTitle>
            <CardDescription>Daily sales performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : salesData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                {t("reports.messages.no_data")}
              </div>
            ) : (
              <SalesChart data={salesData} />
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>{t("reports.top_products.title")}</CardTitle>
            <CardDescription>Best performing products by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : topProducts.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {t("reports.messages.no_data")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("reports.top_products.rank")}</TableHead>
                    <TableHead>{t("reports.top_products.product")}</TableHead>
                    <TableHead className="text-right">{t("reports.top_products.quantity_sold")}</TableHead>
                    <TableHead className="text-right">{t("reports.top_products.revenue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((product, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">#{idx + 1}</TableCell>
                      <TableCell>{product.product_name}</TableCell>
                      <TableCell className="text-right">{product.total_quantity || 0}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(product.total_revenue || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageLayout>

      {/* Modals */}
      <DataExchangeModal
        open={showExport}
        onOpenChange={setShowExport}
        type="export"
        config={dataExchangeConfigs.reports}
        data={salesData}
      />
      <PrintReportModal
        open={showPrint}
        onOpenChange={setShowPrint}
        reportType={t("reports.menu.sales")}
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </DashboardLayout>
  )
}
