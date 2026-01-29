"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportFilters } from "@/components/reports/report-filters"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { DollarSign, TrendingUp, TrendingDown, Percent } from "lucide-react"
import { useState, useEffect } from "react"
import { ExportReportModal } from "@/components/modals/export-report-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { reportService } from "@/lib/services/reportService"
import { saleService } from "@/lib/services/saleService"
import { expenseService } from "@/lib/services/expenseService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"

export default function ProfitLossReportsPage() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [plData, setPlData] = useState<any>(null)
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const useReal = useRealAPI()

  useEffect(() => {
    const loadPLData = async () => {
      if (!currentBusiness) return
      
      setIsLoading(true)
      try {
        if (useReal) {
          const [plReport, salesData, expensesData] = await Promise.all([
            reportService.getProfitLoss({
              tenant: currentBusiness.id,
              outlet: currentOutlet?.id,
            }),
            saleService.list({ tenant: currentBusiness.id, outlet: currentOutlet?.id, status: "completed", limit: 1000 }),
            expenseService.list({ tenant: currentBusiness.id, outlet: currentOutlet?.id }),
          ])

          const sales = Array.isArray(salesData) ? salesData : salesData.results || []
          const expenses = expensesData.results || []
          
          if (plReport) {
            setPlData(plReport)
          } else {
            const revenue = sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0)
            const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
            // Estimate COGS as 60% of revenue (can be improved with actual product costs)
            const cogs = revenue * 0.6
            const grossProfit = revenue - cogs
            const netProfit = grossProfit - totalExpenses
            
            setPlData({
              revenue,
              cogs,
              grossProfit,
              expenses: totalExpenses,
              netProfit,
              profitMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
            })
          }
          
          // Generate monthly data (last 7 days)
          const days: any[] = []
          for (let i = 6; i >= 0; i--) {
            const date = new Date()
            date.setDate(date.getDate() - i)
            const dateStr = date.toISOString().split("T")[0]
            
            const daySales = sales.filter((s: any) => 
              (s.created_at || s.date)?.startsWith(dateStr)
            )
            const dayExpenses = expenses.filter((e: any) =>
              (e.date || e.created_at)?.startsWith(dateStr)
            )
            
            const dayRevenue = daySales.reduce((sum: number, s: any) => sum + (s.total || 0), 0)
            const dayExpense = dayExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
            const dayProfit = dayRevenue - (dayRevenue * 0.6) - dayExpense
            
            days.push({
              date: dateStr,
              revenue: dayRevenue,
              expenses: dayExpense,
              profit: dayProfit,
            })
          }
          setMonthlyData(days)
        } else {
          setPlData(null)
          setMonthlyData([])
        }
      } catch (error) {
        console.error("Failed to load P&L data:", error)
        setPlData(null)
        setMonthlyData([])
      } finally {
        setIsLoading(false)
      }
    }
    
    loadPLData()
  }, [currentBusiness, currentOutlet, useReal])

  const revenue = plData?.revenue || 0
  const cogs = plData?.cogs || 0
  const grossProfit = plData?.grossProfit || (revenue - cogs)
  const expenses = plData?.expenses || 0
  const netProfit = plData?.netProfit || (grossProfit - expenses)
  const profitMargin = plData?.profitMargin || (revenue > 0 ? (netProfit / revenue) * 100 : 0)

  return (
    <DashboardLayout>
      <PageLayout
        title="Profit & Loss Report"
        description="Analyze your business profitability"
      >

        <ReportFilters
          onExport={() => setShowExport(true)}
          onPrint={() => setShowPrint(true)}
          onSettings={() => setShowSettings(true)}
        />

        {/* P&L Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {currentBusiness?.currencySymbol || "MWK"} {revenue.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Total revenue"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cost of Goods</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {currentBusiness?.currencySymbol || "MWK"} {cogs.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : revenue > 0 ? `${((cogs / revenue) * 100).toFixed(1)}% of revenue` : "0% of revenue"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {currentBusiness?.currencySymbol || "MWK"} {grossProfit.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : revenue > 0 ? `${((grossProfit / revenue) * 100).toFixed(1)}% margin` : "0% margin"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {currentBusiness?.currencySymbol || "MWK"} {netProfit.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : `${profitMargin.toFixed(1)}% margin`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* P&L Statement */}
        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss Statement</CardTitle>
            <CardDescription>Financial summary for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading P&L data...</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Revenue</span>
                    <span className="font-semibold text-green-600">
                      {currentBusiness?.currencySymbol || "MWK"} {revenue.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground ml-4">Cost of Goods Sold</span>
                    <span className="text-red-600">
                      -{currentBusiness?.currencySymbol || "MWK"} {cogs.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b-2 border-primary">
                    <span className="font-medium">Gross Profit</span>
                    <span className="font-semibold text-blue-600">
                      {currentBusiness?.currencySymbol || "MWK"} {grossProfit.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground ml-4">Operating Expenses</span>
                    <span className="text-red-600">
                      -{currentBusiness?.currencySymbol || "MWK"} {expenses.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t-2 border-primary">
                    <span className="font-bold text-lg">Net Profit</span>
                    <span className="font-bold text-lg text-green-600">
                      {currentBusiness?.currencySymbol || "MWK"} {netProfit.toLocaleString('en-US')}
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profit Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Profit Trend</CardTitle>
            <CardDescription>Monthly profit and loss over time</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesChart data={monthlyData} />
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
        reportType="Profit & Loss Report"
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
      </PageLayout>
    </DashboardLayout>
  )
}

