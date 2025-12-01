"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportFilters } from "@/components/reports/report-filters"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { DollarSign, TrendingUp, TrendingDown, Percent } from "lucide-react"
import { useState } from "react"
import { ExportReportModal } from "@/components/modals/export-report-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"

export default function ProfitLossReportsPage() {
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Mock P&L data
  const revenue = 125000
  const cogs = 75000
  const grossProfit = revenue - cogs
  const expenses = 30000
  const netProfit = grossProfit - expenses
  const profitMargin = (netProfit / revenue) * 100

  const monthlyData = [
    { date: "2024-01-01", revenue: 125000, expenses: 30000, profit: 95000 },
    { date: "2024-01-02", revenue: 132000, expenses: 31000, profit: 101000 },
    { date: "2024-01-03", revenue: 118000, expenses: 29000, profit: 89000 },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Profit & Loss Report</h1>
          <p className="text-muted-foreground">Analyze your business profitability</p>
        </div>

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
                MWK {revenue.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">+12.5% from last period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cost of Goods</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                MWK {cogs.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">60% of revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                MWK {grossProfit.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">40% margin</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                MWK {netProfit.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">{profitMargin.toFixed(1)}% margin</p>
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
              <div className="flex justify-between items-center py-2 border-b">
                <span className="font-medium">Revenue</span>
                <span className="font-semibold text-green-600">
                  MWK {revenue.toLocaleString('en-US')}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground ml-4">Cost of Goods Sold</span>
                <span className="text-red-600">-MWK {cogs.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b-2 border-primary">
                <span className="font-medium">Gross Profit</span>
                <span className="font-semibold text-blue-600">
                  MWK {grossProfit.toLocaleString('en-US')}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground ml-4">Operating Expenses</span>
                <span className="text-red-600">-MWK {expenses.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t-2 border-primary">
                <span className="font-bold text-lg">Net Profit</span>
                <span className="font-bold text-lg text-green-600">
                  MWK {netProfit.toLocaleString('en-US')}
                </span>
              </div>
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
      </div>

      {/* Modals */}
      <ExportReportModal
        open={showExport}
        onOpenChange={setShowExport}
        reportType="Profit & Loss Report"
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
    </DashboardLayout>
  )
}

