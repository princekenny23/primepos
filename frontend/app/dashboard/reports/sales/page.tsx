"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageCard } from "@/components/layouts/page-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ReportFilters } from "@/components/reports/report-filters"
import { CreditCard, DollarSign, TrendingUp } from "lucide-react"
import { useState, useEffect } from "react"
import { DataExchangeModal } from "@/components/modals/data-exchange-modal"
import { PrintReportModal } from "@/components/modals/print-report-modal"
import { ReportSettingsModal } from "@/components/modals/report-settings-modal"
import { dataExchangeConfigs } from "@/lib/utils/data-exchange-config"
import { reportService, SalesReportSummary } from "@/lib/services/reportService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import { format, differenceInCalendarDays } from "date-fns"

export default function SalesReportsPage() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const [showExport, setShowExport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [salesSummary, setSalesSummary] = useState<SalesReportSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "yesterday" | "custom">("today")
  const [isDayLocked, setIsDayLocked] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString())
  const [startDate, setStartDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const useReal = useRealAPI()

  useEffect(() => {
    const loadReportData = async () => {
      if (!currentBusiness) return
      
      setIsLoading(true)
      try {
        if (useReal) {
          const reportData = await reportService.getSalesReport({
            tenant: currentBusiness.id,
            outlet: currentOutlet?.id,
            start_date: startDate,
            end_date: endDate,
          })

          setSalesSummary(reportData)
          setLastRefreshed(new Date().toLocaleTimeString())
        } else {
          // Simulation mode - empty data
          setSalesSummary(null)
          setLastRefreshed(new Date().toLocaleTimeString())
        }
      } catch (error) {
        console.error("Failed to load report data:", error)
        setSalesSummary(null)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadReportData()
  }, [currentBusiness, currentOutlet, useReal, startDate, endDate])

  useEffect(() => {
    const today = new Date()
    if (selectedPeriod === "today") {
      setStartDate(format(today, "yyyy-MM-dd"))
      setEndDate(format(today, "yyyy-MM-dd"))
      return
    }
    if (selectedPeriod === "yesterday") {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      setStartDate(format(yesterday, "yyyy-MM-dd"))
      setEndDate(format(yesterday, "yyyy-MM-dd"))
    }
  }, [selectedPeriod])

  const grossSales = salesSummary?.total_revenue || 0
  const tax = salesSummary?.total_tax || 0
  const discounts = salesSummary?.total_discount || 0
  const refunds = 0
  const voids = 0
  const netSales = grossSales - discounts - refunds - voids

  const paymentBreakdown = salesSummary?.by_payment_method || []
  const getPaymentTotal = (matchers: string[]) =>
    paymentBreakdown
      .filter((p) => matchers.includes(String(p.payment_method || "").toLowerCase()))
      .reduce((sum, p) => sum + (p.total || 0), 0)

  const cashSales = getPaymentTotal(["cash"])
  const creditSales = getPaymentTotal(["credit", "credit_sale", "credit-sale", "creditcard", "card", "pos"]) 
  const nonCashSales = paymentBreakdown
    .filter((p) => !["cash", "credit", "credit_sale", "credit-sale", "creditcard", "card", "pos"].includes(String(p.payment_method || "").toLowerCase()))
    .reduce((sum, p) => sum + (p.total || 0), 0)

  const paymentTotal = cashSales + nonCashSales + creditSales
  const cashPercent = paymentTotal > 0 ? (cashSales / paymentTotal) * 100 : 0
  const nonCashPercent = paymentTotal > 0 ? (nonCashSales / paymentTotal) * 100 : 0
  const creditPercent = paymentTotal > 0 ? (creditSales / paymentTotal) * 100 : 0

  const dayCount = Math.max(1, differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1)

  return (
    <DashboardLayout>
      <PageCard className="mt-6">
        <div className="px-6 pt-4 pb-2 border-b border-gray-300">
          <h2 className="text-xl font-semibold text-gray-900">Daily Sales Summary</h2>
          <p className="text-sm text-gray-600">Summary KPIs for daily performance with payment mix</p>
        </div>

        <div className="px-6 py-4 border-b border-gray-300">
          <div className="flex flex-col gap-3">
            <Tabs value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as any)}>
              <TabsList className="grid w-full max-w-sm h-9 items-center gap-1 rounded-md bg-gray-100 p-1">
                <TabsTrigger
                  value="today"
                  className="data-[state=active]:bg-blue-900 data-[state=active]:text-white"
                >
                  Today
                </TabsTrigger>
                <TabsTrigger
                  value="yesterday"
                  className="data-[state=active]:bg-blue-900 data-[state=active]:text-white"
                >
                  Yesterday
                </TabsTrigger>
                <TabsTrigger
                  value="custom"
                  className="data-[state=active]:bg-blue-900 data-[state=active]:text-white"
                >
                  Custom Range
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isDayLocked ? "secondary" : "default"}>
                  {isDayLocked ? "Locked" : "Open"}
                </Badge>
                <span className="text-xs text-gray-600">Last refreshed: {lastRefreshed}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setShowExport(true)}>
                  Export CSV
                </Button>
                <Button variant="outline" onClick={() => setShowPrint(true)}>
                  Download PDF
                </Button>
                <Button onClick={() => setShowSettings(true)} disabled={isDayLocked}>
                  View Details
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <ReportFilters
            onExport={() => setShowExport(true)}
            onPrint={() => setShowPrint(true)}
            onSettings={() => setShowSettings(true)}
            onDateRangeChange={(range) => {
              if (range.start) setStartDate(format(range.start, "yyyy-MM-dd"))
              if (range.end) setEndDate(format(range.end, "yyyy-MM-dd"))
              setSelectedPeriod("custom")
            }}
          />

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gross Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {grossSales.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : `${dayCount} days of data`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Sales</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {netSales.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "After discounts, refunds, voids"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tax</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentBusiness?.currencySymbol || "MWK"} {tax.toLocaleString('en-US')}
              </div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : "Collected tax"}
              </p>
            </CardContent>
          </Card>
        </div>

          <div className="grid gap-4 lg:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Payment Breakdown</CardTitle>
              <CardDescription>Cash vs non-cash vs credit</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${cashPercent}%` }}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Cash</p>
                  <p className="text-lg font-semibold">
                    {currentBusiness?.currencySymbol || "MWK"} {cashSales.toLocaleString('en-US')}
                  </p>
                  <p className="text-xs text-muted-foreground">{cashPercent.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Non-cash</p>
                  <p className="text-lg font-semibold">
                    {currentBusiness?.currencySymbol || "MWK"} {nonCashSales.toLocaleString('en-US')}
                  </p>
                  <p className="text-xs text-muted-foreground">{nonCashPercent.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Credit</p>
                  <p className="text-lg font-semibold">
                    {currentBusiness?.currencySymbol || "MWK"} {creditSales.toLocaleString('en-US')}
                  </p>
                  <p className="text-xs text-muted-foreground">{creditPercent.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          </div>
        </div>

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
          reportType="Daily Sales Summary"
        />
        <ReportSettingsModal
          open={showSettings}
          onOpenChange={setShowSettings}
        />
      </PageCard>
    </DashboardLayout>
  )
}

