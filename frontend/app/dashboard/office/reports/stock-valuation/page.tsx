"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FilterableTabs, TabsContent, type TabConfig } from "@/components/ui/filterable-tabs"
import { CalendarDays, FileSpreadsheet, Printer, RefreshCw } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { useBusinessStore } from "@/stores/businessStore"
import { apiEndpoints } from "@/lib/api"
import { exportToXLSX, type ExportColumn } from "@/lib/services/exportService"
import {
  reportService,
  type InventoryValuationReport,
} from "@/lib/services/reportService"
import { useToast } from "@/components/ui/use-toast"
import {
  format,
  isValid,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  subDays,
  subMonths,
} from "date-fns"

type DateRange = {
  start: Date
  end: Date
}

const DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisWeek", label: "This week" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisYear", label: "This year" },
]

export default function StockValuationReportPage() {
  const { t } = useI18n()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [showDateModal, setShowDateModal] = useState(false)
  const [datePreset, setDatePreset] = useState("thisMonth")
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date()
    return { start: startOfMonth(now), end: endOfMonth(now) }
  })
  const [activeTab, setActiveTab] = useState("summary")
  const [report, setReport] = useState<InventoryValuationReport | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [movementPage, setMovementPage] = useState(1)
  const [variancePage, setVariancePage] = useState(1)
  const [ledgerPage, setLedgerPage] = useState(1)
  const [analyticsPage, setAnalyticsPage] = useState(1)
  const itemsPerPage = 10

  const valuationTabs: TabConfig[] = [
    { value: "summary", label: "Summary" },
    { value: "current_valuation", label: "Current Valuation" },
    { value: "movement", label: "Inventory Movement" },
    { value: "variance", label: "Stock Take Variance" },
    { value: "ledger", label: "Inventory Ledger" },
    { value: "analytics", label: "Inventory Analytics" },
  ]

  const formatCurrency = useCallback(
    (value: number) => {
      const symbol = currentBusiness?.currencySymbol || "MWK"
      return `${symbol} ${value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    },
    [currentBusiness]
  )

  const applyPreset = useCallback((presetId: string) => {
    const now = new Date()
    let next: DateRange

    switch (presetId) {
      case "today":
        next = { start: now, end: now }
        break
      case "yesterday":
        next = { start: subDays(now, 1), end: subDays(now, 1) }
        break
      case "last7":
        next = { start: subDays(now, 6), end: now }
        break
      case "last30":
        next = { start: subDays(now, 29), end: now }
        break
      case "thisWeek":
        next = {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        }
        break
      case "lastMonth": {
        const lm = subMonths(now, 1)
        next = { start: startOfMonth(lm), end: endOfMonth(lm) }
        break
      }
      case "thisYear":
        next = { start: startOfYear(now), end: endOfYear(now) }
        break
      case "thisMonth":
      default:
        next = { start: startOfMonth(now), end: endOfMonth(now) }
        break
    }

    setDatePreset(presetId)
    setDateRange(next)
  }, [])

  const loadReportData = useCallback(async () => {
    const startDate = format(dateRange.start, "yyyy-MM-dd")
    const endDate = format(dateRange.end, "yyyy-MM-dd")

    setIsLoading(true)
    try {
      const response = await reportService.getInventoryValuation({
        outlet: currentOutlet ? String(currentOutlet.id) : undefined,
        start_date: startDate,
        end_date: endDate,
      })
      setReport(response)
    } catch (error) {
      console.error("Failed to load stock valuation report:", error)
      toast({
        title: t("common.messages.error"),
        description: "Failed to load stock valuation data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentOutlet, dateRange.end, dateRange.start, t, toast])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  useEffect(() => {
    setCurrentPage(1)
    setMovementPage(1)
    setVariancePage(1)
    setLedgerPage(1)
    setAnalyticsPage(1)
  }, [dateRange.start, dateRange.end, currentOutlet?.id])

  const startDate = format(dateRange.start, "yyyy-MM-dd")
  const endDate = format(dateRange.end, "yyyy-MM-dd")
  const headerRangeLabel = `${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`
  const totalItems = report?.items?.length || 0
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const paginatedItems = (report?.items || []).slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const summaryMetrics = useMemo(() => {
    const items = report?.items || []
    const totalProducts = items.length
    const totalQuantity = items.reduce((sum, item) => sum + (item.stock_qty || 0), 0)
    const totalRetailValue = items.reduce(
      (sum, item) => sum + (item.retail_price || 0) * (item.stock_qty || 0),
      0
    )
    const totalCostValue = report?.totals?.stock_value || 0
    const potentialGrossProfit = totalRetailValue - totalCostValue

    const outOfStock = items.filter((item) => (item.stock_qty || 0) <= 0).length
    const negativeStock = items.filter((item) => (item.stock_qty || 0) < 0).length

    const countedQty = report?.totals?.counted_qty || 0
    const discrepancyAbs = Math.abs(report?.totals?.discrepancy || 0)
    const inventoryAccuracy =
      countedQty > 0
        ? Math.max(0, ((countedQty - discrepancyAbs) / countedQty) * 100)
        : 100

    return {
      totalProducts,
      totalQuantity,
      totalRetailValue,
      totalCostValue,
      potentialGrossProfit,
      outOfStock,
      negativeStock,
      inventoryAccuracy,
    }
  }, [report])

  const movementRows = useMemo(() => {
    return [...(report?.items || [])].sort((left, right) => {
      const leftMovement = (left.received_qty || 0) + (left.transferred_qty || 0) + (left.adjusted_qty || 0) - (left.sold_qty || 0)
      const rightMovement = (right.received_qty || 0) + (right.transferred_qty || 0) + (right.adjusted_qty || 0) - (right.sold_qty || 0)

      if (rightMovement === leftMovement) {
        return String(left.name || "").localeCompare(String(right.name || ""))
      }

      return Math.abs(rightMovement) - Math.abs(leftMovement)
    })
  }, [report])

  const paginatedMovementRows = useMemo(() => {
    const startIndex = (movementPage - 1) * itemsPerPage
    return movementRows.slice(startIndex, startIndex + itemsPerPage)
  }, [movementPage, movementRows])

  const varianceRows = useMemo(() => {
    return (report?.items || [])
      .filter((item) => (item.counted_qty || 0) > 0 || (item.discrepancy || 0) !== 0 || (item.counted_value || 0) !== 0)
      .sort((left, right) => {
        const leftVariance = Math.abs(left.discrepancy || 0)
        const rightVariance = Math.abs(right.discrepancy || 0)

        if (rightVariance === leftVariance) {
          return String(left.name || "").localeCompare(String(right.name || ""))
        }

        return rightVariance - leftVariance
      })
  }, [report])

  const paginatedVarianceRows = useMemo(() => {
    const startIndex = (variancePage - 1) * itemsPerPage
    return varianceRows.slice(startIndex, startIndex + itemsPerPage)
  }, [variancePage, varianceRows])

  const ledgerRows = useMemo(() => {
    return [...(report?.items || [])].sort((left, right) => {
      const leftLedgerValue = (left.open_value || 0) + (left.received_value || 0) + (left.transferred_value || 0) + (left.adjusted_value || 0) + (left.sold_value || 0)
      const rightLedgerValue = (right.open_value || 0) + (right.received_value || 0) + (right.transferred_value || 0) + (right.adjusted_value || 0) + (right.sold_value || 0)

      if (rightLedgerValue === leftLedgerValue) {
        return String(left.name || "").localeCompare(String(right.name || ""))
      }

      return rightLedgerValue - leftLedgerValue
    })
  }, [report])

  const paginatedLedgerRows = useMemo(() => {
    const startIndex = (ledgerPage - 1) * itemsPerPage
    return ledgerRows.slice(startIndex, startIndex + itemsPerPage)
  }, [ledgerPage, ledgerRows])

  const analyticsRows = useMemo(() => {
    return [...(report?.items || [])].sort((left, right) => {
      const leftScore = (left.stock_value || 0) + Math.abs(left.discrepancy_value || 0)
      const rightScore = (right.stock_value || 0) + Math.abs(right.discrepancy_value || 0)

      if (rightScore === leftScore) {
        return String(left.name || "").localeCompare(String(right.name || ""))
      }

      return rightScore - leftScore
    })
  }, [report])

  const paginatedAnalyticsRows = useMemo(() => {
    const startIndex = (analyticsPage - 1) * itemsPerPage
    return analyticsRows.slice(startIndex, startIndex + itemsPerPage)
  }, [analyticsPage, analyticsRows])

  const movementTotals = useMemo(() => {
    const items = report?.items || []
    return {
      receivedQty: items.reduce((sum, item) => sum + (item.received_qty || 0), 0),
      transferredQty: items.reduce((sum, item) => sum + (item.transferred_qty || 0), 0),
      adjustedQty: items.reduce((sum, item) => sum + (item.adjusted_qty || 0), 0),
      soldQty: items.reduce((sum, item) => sum + (item.sold_qty || 0), 0),
      closingQty: items.reduce((sum, item) => sum + (item.stock_qty || 0), 0),
    }
  }, [report])

  const formatSignedQuantity = useCallback((value: number) => {
    const numeric = Number(value || 0)
    return `${numeric >= 0 ? "+" : ""}${numeric.toLocaleString("en-US")}`
  }, [])

  const renderPagination = useCallback(
    (
      totalItems: number,
      page: number,
      setPage: (value: number | ((prev: number) => number)) => void
    ) => {
      const totalPageCount = Math.max(1, Math.ceil(totalItems / itemsPerPage))
      if (totalItems <= itemsPerPage) return null

      const startIndex = (page - 1) * itemsPerPage + 1
      const endIndex = Math.min(page * itemsPerPage, totalItems)

      return (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {startIndex}-{endIndex} of {totalItems}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(totalPageCount, prev + 1))}
              disabled={page === totalPageCount}
            >
              Next
            </Button>
          </div>
        </div>
      )
    },
    [itemsPerPage]
  )

  const handleExportXlsx = async () => {
    try {
      const items = report?.items || []
      if (items.length === 0) {
        toast({
          title: t("common.messages.error"),
          description: "No stock valuation data to export",
          variant: "destructive",
        })
        return
      }

      const columns: ExportColumn[] = [
        { key: "name", label: "Item" },
        { key: "code", label: "Code" },
        { key: "category", label: "Category" },
        { key: "cost_price", label: "Cost Price", format: "currency" },
        { key: "retail_price", label: "Retail Price", format: "currency" },
        { key: "open_qty", label: "Open Qty", format: "number" },
        { key: "open_value", label: "Open Value", format: "currency" },
        { key: "received_qty", label: "Received Qty", format: "number" },
        { key: "received_value", label: "Received Value", format: "currency" },
        { key: "transferred_qty", label: "Transferred Qty", format: "number" },
        { key: "transferred_value", label: "Transferred Value", format: "currency" },
        { key: "adjusted_qty", label: "Adjusted Qty", format: "number" },
        { key: "adjusted_value", label: "Adjusted Value", format: "currency" },
        { key: "sold_qty", label: "Sold Qty", format: "number" },
        { key: "sold_value", label: "Sold Value", format: "currency" },
        { key: "stock_qty", label: "Stock Qty", format: "number" },
        { key: "stock_value", label: "Stock Value", format: "currency" },
        { key: "counted_qty", label: "Counted Qty", format: "number" },
        { key: "counted_value", label: "Counted Value", format: "currency" },
        { key: "discrepancy", label: "Discrepancy Qty", format: "number" },
        { key: "discrepancy_value", label: "Discrepancy Value", format: "currency" },
        { key: "surplus_qty", label: "Surplus Qty", format: "number" },
        { key: "surplus_value", label: "Surplus Value", format: "currency" },
        { key: "shortage_qty", label: "Shortage Qty", format: "number" },
        { key: "shortage_value", label: "Shortage Value", format: "currency" },
      ]

      await exportToXLSX({
        data: items,
        fileName: `stock-valuation-${startDate}-to-${endDate}`,
        sheetName: "Stock Valuation",
        columns,
        includeHeaders: true,
        freezeHeader: true,
      })
    } catch (error: any) {
      toast({
        title: t("common.messages.error"),
        description: error?.message || "Failed to export stock valuation report",
        variant: "destructive",
      })
    }
  }

  const handleExportPdf = async () => {
    try {
      await reportService.downloadReport(
        apiEndpoints.reports.inventoryValuationPdf,
        {
          outlet: currentOutlet ? String(currentOutlet.id) : "",
          start_date: startDate,
          end_date: endDate,
        },
        `stock-valuation-${startDate}-to-${endDate}.pdf`
      )
    } catch (error: any) {
      toast({
        title: t("common.messages.error"),
        description: error?.message || "Failed to export stock valuation report",
        variant: "destructive",
      })
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Stock Valuation"
        description="Inventory valuation summary with detailed stock breakdown"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportXlsx}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Download Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <Printer className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        }
      >
        <div className="sticky top-0 z-30 mb-6 border-b bg-background/95 backdrop-blur">
          <div className="flex flex-col gap-4 px-2 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm text-muted-foreground">{headerRangeLabel}</div>
              <h2 className="text-xl font-semibold">Stock Valuation</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setShowDateModal(true)}>
                <CalendarDays className="mr-2 h-4 w-4" />
                {DATE_PRESETS.find((p) => p.id === datePreset)?.label || "Custom"}
              </Button>
              <Button variant="ghost" onClick={loadReportData} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <FilterableTabs
          tabs={valuationTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabsListClassName="grid w-full h-9 items-center gap-1 rounded-md bg-gray-100 p-1"
          className="space-y-6"
        >
          <TabsContent value="summary" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <Card className="border-l-4 border-blue-500 bg-blue-50/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Inventory Cost Value</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{formatCurrency(summaryMetrics.totalCostValue)}</CardContent>
              </Card>
              <Card className="border-l-4 border-emerald-500 bg-emerald-50/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Total Retail Value</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{formatCurrency(summaryMetrics.totalRetailValue)}</CardContent>
              </Card>
              <Card className="border-l-4 border-purple-500 bg-purple-50/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Potential Gross Profit</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{formatCurrency(summaryMetrics.potentialGrossProfit)}</CardContent>
              </Card>
              <Card className="border-l-4 border-sky-500 bg-sky-50/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Inventory Accuracy</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{summaryMetrics.inventoryAccuracy.toFixed(2)}%</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Products</CardTitle></CardHeader>
                <CardContent className="text-xl font-semibold">{summaryMetrics.totalProducts.toLocaleString()}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Quantity</CardTitle></CardHeader>
                <CardContent className="text-xl font-semibold">{summaryMetrics.totalQuantity.toLocaleString()}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Out / Negative Stock</CardTitle></CardHeader>
                <CardContent className="text-xl font-semibold">{summaryMetrics.outOfStock.toLocaleString()} / {summaryMetrics.negativeStock.toLocaleString()}</CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="current_valuation" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-1">
                <CardTitle>Current Valuation</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {report?.item_count ?? 0} items • Period {startDate} to {endDate}
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Cost Price</TableHead>
                      <TableHead className="text-right">Retail Price</TableHead>
                      <TableHead className="text-right">Stock Qty</TableHead>
                      <TableHead className="text-right">Stock Value</TableHead>
                      <TableHead className="text-right">Discrepancy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.code}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cost_price || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.retail_price || 0)}</TableCell>
                        <TableCell className="text-right">{(item.stock_qty || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.stock_value || 0)}</TableCell>
                        <TableCell className="text-right">{(item.discrepancy || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalItems > 0 ? (
                  <div className="mt-4 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movement">
            <Card>
              <CardHeader className="space-y-2">
                <CardTitle>Inventory Movement</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Movement breakdown by item for the selected period.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Received Qty</CardTitle></CardHeader>
                    <CardContent className="text-lg font-semibold">{movementTotals.receivedQty.toLocaleString()}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Transferred Qty</CardTitle></CardHeader>
                    <CardContent className="text-lg font-semibold">{movementTotals.transferredQty.toLocaleString()}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Adjusted Qty</CardTitle></CardHeader>
                    <CardContent className="text-lg font-semibold">{movementTotals.adjustedQty.toLocaleString()}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sold Qty</CardTitle></CardHeader>
                    <CardContent className="text-lg font-semibold">{movementTotals.soldQty.toLocaleString()}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Closing Qty</CardTitle></CardHeader>
                    <CardContent className="text-lg font-semibold">{movementTotals.closingQty.toLocaleString()}</CardContent>
                  </Card>
                </div>

                <div className="overflow-x-auto rounded-md border bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Item</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead className="text-right">Open Qty</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Transferred</TableHead>
                        <TableHead className="text-right">Adjusted</TableHead>
                        <TableHead className="text-right">Sold</TableHead>
                        <TableHead className="text-right">Closing Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMovementRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                            No movement data found for the selected period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedMovementRows.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.code}</TableCell>
                            <TableCell className="text-right">{(item.open_qty || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">{formatSignedQuantity(item.received_qty || 0)}</TableCell>
                            <TableCell className="text-right">{formatSignedQuantity(item.transferred_qty || 0)}</TableCell>
                            <TableCell className="text-right">{formatSignedQuantity(item.adjusted_qty || 0)}</TableCell>
                            <TableCell className="text-right">{formatSignedQuantity(-(item.sold_qty || 0))}</TableCell>
                            <TableCell className="text-right font-semibold">{(item.stock_qty || 0).toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {renderPagination(movementRows.length, movementPage, setMovementPage)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="variance">
            <Card>
              <CardHeader className="space-y-2">
                <CardTitle>Stock Take Variance</CardTitle>
                <p className="text-sm text-muted-foreground">
                  System quantity versus counted quantity for the stock-take period.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {report?.has_stock_take ? (
                  <div className="overflow-x-auto rounded-md border bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead>Item</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead className="text-right">System Qty</TableHead>
                          <TableHead className="text-right">Counted Qty</TableHead>
                          <TableHead className="text-right">Variance Qty</TableHead>
                          <TableHead className="text-right">Variance Value</TableHead>
                          <TableHead className="text-right">Surplus</TableHead>
                          <TableHead className="text-right">Shortage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedVarianceRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                              No variance rows found for the selected stock take.
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedVarianceRows.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>{item.code}</TableCell>
                              <TableCell className="text-right">{(item.stock_qty || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right">{(item.counted_qty || 0).toLocaleString()}</TableCell>
                              <TableCell className={`text-right font-semibold ${(item.discrepancy || 0) === 0 ? "text-muted-foreground" : (item.discrepancy || 0) > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {(item.discrepancy || 0) >= 0 ? "+" : ""}{(item.discrepancy || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className={`text-right ${(item.discrepancy_value || 0) === 0 ? "text-muted-foreground" : (item.discrepancy_value || 0) > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {formatCurrency(item.discrepancy_value || 0)}
                              </TableCell>
                              <TableCell className="text-right text-emerald-600">{(item.surplus_qty || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right text-red-600">{(item.shortage_qty || 0).toLocaleString()}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    {renderPagination(varianceRows.length, variancePage, setVariancePage)}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-muted-foreground">
                    No stock take data is attached to this period yet, so variance cannot be calculated.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ledger">
            <Card>
              <CardHeader className="space-y-2">
                <CardTitle>Inventory Ledger</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Period ledger showing movement and closing value by item.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-md border bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Item</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead className="text-right">Open Value</TableHead>
                        <TableHead className="text-right">Received Value</TableHead>
                        <TableHead className="text-right">Transferred Value</TableHead>
                        <TableHead className="text-right">Adjusted Value</TableHead>
                        <TableHead className="text-right">Sold Value</TableHead>
                        <TableHead className="text-right">Closing Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLedgerRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                            No ledger rows found for the selected period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedLedgerRows.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.code}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.open_value || 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.received_value || 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.transferred_value || 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.adjusted_value || 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.sold_value || 0)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(item.stock_value || 0)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {renderPagination(ledgerRows.length, ledgerPage, setLedgerPage)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader className="space-y-2">
                <CardTitle>Inventory Analytics</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ranked analytics for stock value and variance impact.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-md border bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Stock Qty</TableHead>
                        <TableHead className="text-right">Stock Value</TableHead>
                        <TableHead className="text-right">Retail Value</TableHead>
                        <TableHead className="text-right">Gross Profit Potential</TableHead>
                        <TableHead className="text-right">Variance Value</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAnalyticsRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                            No analytics rows found for the selected period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedAnalyticsRows.map((item) => {
                          const grossProfitPotential = (item.retail_price || 0) * (item.stock_qty || 0) - (item.stock_value || 0)
                          const status = (item.discrepancy || 0) === 0
                            ? "Balanced"
                            : (item.discrepancy || 0) > 0
                              ? "Surplus"
                              : "Shortage"

                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>{item.category}</TableCell>
                              <TableCell className="text-right">{(item.stock_qty || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.stock_value || 0)}</TableCell>
                              <TableCell className="text-right">{formatCurrency((item.retail_price || 0) * (item.stock_qty || 0))}</TableCell>
                              <TableCell className="text-right">{formatCurrency(grossProfitPotential)}</TableCell>
                              <TableCell className={`text-right ${(item.discrepancy_value || 0) === 0 ? "text-muted-foreground" : (item.discrepancy_value || 0) > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {formatCurrency(item.discrepancy_value || 0)}
                              </TableCell>
                              <TableCell>{status}</TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {renderPagination(analyticsRows.length, analyticsPage, setAnalyticsPage)}
              </CardContent>
            </Card>
          </TabsContent>
        </FilterableTabs>
      </PageLayout>

      <Dialog open={showDateModal} onOpenChange={setShowDateModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose date range</DialogTitle>
            <DialogDescription>Quick presets apply instantly. Use custom dates for exact ranges.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant={preset.id === datePreset ? "default" : "outline"}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>From</Label>
              <Input
                type="date"
                value={format(dateRange.start, "yyyy-MM-dd")}
                onChange={(event) => {
                  const next = parseISO(event.target.value)
                  if (isValid(next)) {
                    setDatePreset("custom")
                    setDateRange((prev) => ({ ...prev, start: next }))
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="date"
                value={format(dateRange.end, "yyyy-MM-dd")}
                onChange={(event) => {
                  const next = parseISO(event.target.value)
                  if (isValid(next)) {
                    setDatePreset("custom")
                    setDateRange((prev) => ({ ...prev, end: next }))
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDateModal(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
