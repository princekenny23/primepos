"use client"

import { useCallback, useEffect, useState } from "react"
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
  const { currentBusiness } = useBusinessStore()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [showDateModal, setShowDateModal] = useState(false)
  const [datePreset, setDatePreset] = useState("thisMonth")
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date()
    return { start: startOfMonth(now), end: endOfMonth(now) }
  })
  const [report, setReport] = useState<InventoryValuationReport | null>(null)

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
      case "today": next = { start: now, end: now }; break
      case "yesterday": next = { start: subDays(now, 1), end: subDays(now, 1) }; break
      case "last7": next = { start: subDays(now, 6), end: now }; break
      case "last30": next = { start: subDays(now, 29), end: now }; break
      case "thisWeek": next = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }; break
      case "lastMonth": { const lm = subMonths(now, 1); next = { start: startOfMonth(lm), end: endOfMonth(lm) }; break }
      case "thisYear": next = { start: startOfYear(now), end: endOfYear(now) }; break
      case "thisMonth":
      default: next = { start: startOfMonth(now), end: endOfMonth(now) }; break
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
  }, [dateRange.end, dateRange.start, t, toast])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  const startDate = format(dateRange.start, "yyyy-MM-dd")
  const endDate = format(dateRange.end, "yyyy-MM-dd")
  const headerRangeLabel = `${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`

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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
          <Card className="border-l-4 border-blue-500 bg-blue-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Items</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">
              {(report?.item_count || 0).toLocaleString()}
            </CardContent>
          </Card>
          <Card className="border-l-4 border-emerald-500 bg-emerald-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Stock Value</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">
              {formatCurrency(report?.totals.stock_value || 0)}
            </CardContent>
          </Card>
          <Card className="border-l-4 border-purple-500 bg-purple-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Sold Value</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">
              {formatCurrency(report?.totals.sold_value || 0)}
            </CardContent>
          </Card>
          <Card className="border-l-4 border-sky-500 bg-sky-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Received Value</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">
              {formatCurrency(report?.totals.received_value || 0)}
            </CardContent>
          </Card>
          <Card className="border-l-4 border-green-600 bg-green-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Surplus Value</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">
              {formatCurrency(report?.totals.surplus_value || 0)}
            </CardContent>
          </Card>
          <Card className="border-l-4 border-red-500 bg-red-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Shortage Value</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">
              {formatCurrency(report?.totals.shortage_value || 0)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-1">
            <CardTitle>Stock Valuation Details</CardTitle>
            <p className="text-sm text-muted-foreground">
              {report?.item_count ?? 0} items • Period {startDate} to {endDate}
              {report?.stock_take_date ? ` • Last stock take: ${report.stock_take_date}` : ""}
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
                  <TableHead className="text-right">Open Qty</TableHead>
                  <TableHead className="text-right">Open Value</TableHead>
                  <TableHead className="text-right">Received Qty</TableHead>
                  <TableHead className="text-right">Received Value</TableHead>
                  <TableHead className="text-right">Transferred Qty</TableHead>
                  <TableHead className="text-right">Transferred Value</TableHead>
                  <TableHead className="text-right">Adjusted Qty</TableHead>
                  <TableHead className="text-right">Adjusted Value</TableHead>
                  <TableHead className="text-right">Sold Qty</TableHead>
                  <TableHead className="text-right">Sold Value</TableHead>
                  <TableHead className="text-right">Stock Qty</TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                  <TableHead className="text-right">Counted Qty</TableHead>
                  <TableHead className="text-right">Counted Value</TableHead>
                  <TableHead className="text-right">Discrepancy Qty</TableHead>
                  <TableHead className="text-right">Discrepancy Value</TableHead>
                  <TableHead className="text-right">Surplus Qty</TableHead>
                  <TableHead className="text-right">Surplus Value</TableHead>
                  <TableHead className="text-right">Shortage Qty</TableHead>
                  <TableHead className="text-right">Shortage Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report?.items || []).map((item) => (
                  <TableRow
                    key={item.id}
                    className={
                      (item.shortage_value || 0) > 0
                        ? "bg-red-50/40"
                        : (item.surplus_value || 0) > 0
                        ? "bg-green-50/40"
                        : undefined
                    }
                  >
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.cost_price || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.retail_price || 0)}</TableCell>
                    <TableCell className="text-right">{(item.open_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.open_value || 0)}</TableCell>
                    <TableCell className="text-right">{(item.received_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.received_value || 0)}</TableCell>
                    <TableCell className="text-right">{(item.transferred_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.transferred_value || 0)}</TableCell>
                    <TableCell className="text-right">{(item.adjusted_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.adjusted_value || 0)}</TableCell>
                    <TableCell className="text-right">{(item.sold_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.sold_value || 0)}</TableCell>
                    <TableCell className="text-right">{(item.stock_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.stock_value || 0)}</TableCell>
                    <TableCell className="text-right">{(item.counted_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.counted_value || 0)}</TableCell>
                    <TableCell
                      className={`text-right ${(item.discrepancy || 0) !== 0 ? "text-amber-700 font-semibold" : ""}`}
                    >
                      {(item.discrepancy || 0).toLocaleString()}
                    </TableCell>
                    <TableCell
                      className={`text-right ${(item.discrepancy || 0) !== 0 ? "text-amber-700 font-semibold" : ""}`}
                    >
                      {formatCurrency(item.discrepancy || 0)}
                    </TableCell>
                    <TableCell className="text-right text-green-700 font-semibold">
                      {(item.surplus_qty || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-green-700 font-semibold">
                      {formatCurrency(item.surplus_value || 0)}
                    </TableCell>
                    <TableCell className="text-right text-red-700 font-semibold">
                      {(item.shortage_qty || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-red-700 font-semibold">
                      {formatCurrency(item.shortage_value || 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {report?.totals ? (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell colSpan={5}>Totals</TableCell>
                    <TableCell className="text-right">{(report.totals.open_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.totals.open_value || 0)}</TableCell>
                    <TableCell className="text-right">{(report.totals.received_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.totals.received_value || 0)}</TableCell>
                    <TableCell className="text-right">{(report.totals.transferred_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.totals.transferred_value || 0)}</TableCell>
                    <TableCell className="text-right">{(report.totals.adjusted_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.totals.adjusted_value || 0)}</TableCell>
                    <TableCell className="text-right">{(report.totals.sold_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.totals.sold_value || 0)}</TableCell>
                    <TableCell className="text-right">{(report.totals.stock_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.totals.stock_value || 0)}</TableCell>
                    <TableCell className="text-right">{(report.totals.counted_qty || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.totals.counted_value || 0)}</TableCell>
                    <TableCell className="text-right text-amber-700">
                      {(report.totals.discrepancy || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-amber-700">
                      {formatCurrency(report.totals.discrepancy || 0)}
                    </TableCell>
                    <TableCell className="text-right text-green-700">
                      {(report.totals.surplus_qty || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-green-700">
                      {formatCurrency(report.totals.surplus_value || 0)}
                    </TableCell>
                    <TableCell className="text-right text-red-700">
                      {(report.totals.shortage_qty || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-red-700">
                      {formatCurrency(report.totals.shortage_value || 0)}
                    </TableCell>
                  </TableRow>
                ) : null}
                {!isLoading && (!report?.items || report.items.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={25} className="text-center text-sm text-muted-foreground">
                      No stock valuation data available for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
