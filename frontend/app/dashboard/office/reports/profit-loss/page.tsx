"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"

export default function ProfitLossReportsPage() {
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
  
  const [data, setData] = useState({
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    grossMargin: 0,
    expenses: 0,
    netProfit: 0,
    netMargin: 0,
  })
  
  const [chartData, setChartData] = useState<any[]>([])

  const loadReportData = async () => {
    if (!currentBusiness || !currentOutlet) return
    
    setIsLoading(true)
    try {
      const response = await reportService.getProfitLoss({
        outlet: String(currentOutlet.id),
        start_date: startDate,
        end_date: endDate,
      })
      
      if (response) {
        const revenue = response.total_revenue || 0
        const cogs = response.total_cost || 0
        const grossProfit = response.gross_profit || (revenue - cogs)
        const grossMargin = response.gross_margin || (revenue > 0 ? (grossProfit / revenue) * 100 : 0)
        // Expenses would need separate API - mock for now
        const expenses = 0
        const netProfit = grossProfit - expenses
        const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0
        
        setData({
          revenue,
          cogs,
          grossProfit,
          grossMargin,
          expenses,
          netProfit,
          netMargin,
        })
        
        // Mock chart data - would come from API
        setChartData([
          { date: startDate, revenue, profit: netProfit },
        ])
      }
    } catch (error) {
      console.error("Failed to load P&L report:", error)
      toast({
        title: t("common.messages.error"),
        description: "Failed to load profit & loss data",
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
        title={t("reports.menu.profit_loss")}
        description={t("reports.profit_loss.title")}
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

        {/* P&L Statement */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("reports.profit_loss.title")}</CardTitle>
            <CardDescription>Financial summary for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="font-semibold text-lg">{t("reports.profit_loss.revenue")}</span>
                  <span className="font-bold text-lg text-green-600">
                    {formatCurrency(data.revenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 pl-4 border-b border-gray-100">
                  <span className="text-muted-foreground">{t("reports.profit_loss.cost_of_goods")}</span>
                  <span className="text-red-600">-{formatCurrency(data.cogs)}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b-2 border-primary">
                  <span className="font-semibold">{t("reports.profit_loss.gross_profit")}</span>
                  <span className="font-bold text-blue-600">
                    {formatCurrency(data.grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 pl-4 border-b border-gray-100">
                  <span className="text-muted-foreground">{t("reports.profit_loss.expenses")}</span>
                  <span className="text-red-600">-{formatCurrency(data.expenses)}</span>
                </div>
                <div className="flex justify-between items-center py-4 border-t-2 border-primary bg-muted/30 px-4 -mx-4 rounded">
                  <span className="font-bold text-xl">{t("reports.profit_loss.net_profit")}</span>
                  <span className={`font-bold text-xl ${data.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(data.netProfit)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profit Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Profit Trend</CardTitle>
            <CardDescription>Revenue and profit over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                {t("reports.messages.no_data")}
              </div>
            ) : (
              <SalesChart data={chartData} />
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
      />
      <PrintReportModal
        open={showPrint}
        onOpenChange={setShowPrint}
        reportType={t("reports.menu.profit_loss")}
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </DashboardLayout>
  )
}
