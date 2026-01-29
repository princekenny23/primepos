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
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, PieChart } from "lucide-react"
import { useState, useEffect } from "react"
import { ExportReportModal } from "@/components/modals/export-report-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { useBusinessStore } from "@/stores/businessStore"

export default function FinancialReportsPage() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [financialData, setFinancialData] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadReportData = async () => {
      if (!currentBusiness) return
      
      setIsLoading(true)
      try {
        // Simulated data - replace with actual API call
        setTimeout(() => {
          setFinancialData({
            revenue: {
              total: 150000,
              sales: 120000,
              other: 30000,
              change: 12.5
            },
            expenses: {
              total: 45000,
              costOfGoods: 30000,
              operating: 10000,
              other: 5000,
              change: -5.2
            },
            profit: {
              gross: 90000,
              net: 55000,
              margin: 36.7,
              change: 18.3
            },
            breakdown: [
              { category: "Product Sales", amount: 120000, percentage: 80 },
              { category: "Service Revenue", amount: 20000, percentage: 13.3 },
              { category: "Other Income", amount: 10000, percentage: 6.7 },
            ]
          })
          
          setIsLoading(false)
        }, 1000)
      } catch (error) {
        console.error("Failed to load financial report:", error)
        setFinancialData({})
        setIsLoading(false)
      }
    }
    
    loadReportData()
  }, [currentBusiness, currentOutlet])

  return (
    <DashboardLayout>
      <PageLayout
        title="Financial Report"
        description="Profit & loss, expenses, and comprehensive financial analysis"
      >

        <ReportFilters
          onExport={() => setShowExport(true)}
          onPrint={() => setShowPrint(true)}
          onSettings={() => setShowSettings(true)}
        />

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {financialData.revenue?.total.toLocaleString('en-US') || "0"}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400">
                  {financialData.revenue?.change || 0}%
                </span> from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {financialData.expenses?.total.toLocaleString('en-US') || "0"}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowDownRight className="h-3 w-3 text-red-600 dark:text-red-400" />
                <span className="text-red-600 dark:text-red-400">
                  {Math.abs(financialData.expenses?.change || 0)}%
                </span> from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {currentBusiness?.currencySymbol || "MWK"} {financialData.profit?.net.toLocaleString('en-US') || "0"}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400">
                  {financialData.profit?.change || 0}%
                </span> from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{financialData.profit?.margin || 0}%</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Net profit margin"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Profit & Loss Statement */}
        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss Statement</CardTitle>
            <CardDescription>Complete financial overview for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Revenue Section */}
              <div>
                <h3 className="font-semibold mb-3 text-lg">Revenue</h3>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Sales Revenue</span>
                    <span className="font-semibold">
                      {currentBusiness?.currencySymbol || "MWK"} {financialData.revenue?.sales.toLocaleString('en-US') || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Other Revenue</span>
                    <span className="font-semibold">
                      {currentBusiness?.currencySymbol || "MWK"} {financialData.revenue?.other.toLocaleString('en-US') || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 pt-2 border-t-2">
                    <span className="font-semibold">Total Revenue</span>
                    <span className="font-bold text-lg">
                      {currentBusiness?.currencySymbol || "MWK"} {financialData.revenue?.total.toLocaleString('en-US') || "0"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expenses Section */}
              <div>
                <h3 className="font-semibold mb-3 text-lg">Expenses</h3>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Cost of Goods Sold</span>
                    <span className="font-semibold">
                      {currentBusiness?.currencySymbol || "MWK"} {financialData.expenses?.costOfGoods.toLocaleString('en-US') || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Operating Expenses</span>
                    <span className="font-semibold">
                      {currentBusiness?.currencySymbol || "MWK"} {financialData.expenses?.operating.toLocaleString('en-US') || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Other Expenses</span>
                    <span className="font-semibold">
                      {currentBusiness?.currencySymbol || "MWK"} {financialData.expenses?.other.toLocaleString('en-US') || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 pt-2 border-t-2">
                    <span className="font-semibold">Total Expenses</span>
                    <span className="font-bold text-lg">
                      {currentBusiness?.currencySymbol || "MWK"} {financialData.expenses?.total.toLocaleString('en-US') || "0"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profit Section */}
              <div>
                <h3 className="font-semibold mb-3 text-lg">Profit</h3>
                <div className="space-y-2 pl-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Gross Profit</span>
                    <span className="font-semibold">
                      {currentBusiness?.currencySymbol || "MWK"} {financialData.profit?.gross.toLocaleString('en-US') || "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 pt-2 border-t-2 bg-green-50 dark:bg-green-950/20 rounded-lg px-4">
                    <span className="font-bold text-lg">Net Profit</span>
                    <span className="font-bold text-xl text-green-600 dark:text-green-400">
                      {currentBusiness?.currencySymbol || "MWK"} {financialData.profit?.net.toLocaleString('en-US') || "0"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Breakdown</CardTitle>
            <CardDescription>Revenue by category</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <p className="text-muted-foreground">Loading revenue breakdown...</p>
                    </TableCell>
                  </TableRow>
                ) : financialData.breakdown?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <p className="text-muted-foreground">No revenue data available</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  financialData.breakdown?.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.category}</TableCell>
                      <TableCell className="font-semibold">
                        {currentBusiness?.currencySymbol || "MWK"} {item.amount.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell>{item.percentage}%</TableCell>
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
        reportType="Financial Report"
      />
      <ReportSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
      </PageLayout>
    </DashboardLayout>
  )
}

