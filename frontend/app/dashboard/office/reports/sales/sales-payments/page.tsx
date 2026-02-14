"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiEndpoints } from "@/lib/api"
import { useI18n } from "@/contexts/i18n-context"
import { useBusinessStore } from "@/stores/businessStore"
import { reportService, type SalesReportSummary } from "@/lib/services/reportService"
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
import {
  BarChart,
  Bar,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts"
import {
  CalendarDays,
  FileSpreadsheet,
  Printer,
  RefreshCw,
} from "lucide-react"

type DateRange = {
  start: Date
  end: Date
}

const CHART_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"]

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

export default function SalesPaymentsPage() {
  const { t } = useI18n()
  const { currentBusiness, currentOutlet, outlets } = useBusinessStore()
  const { toast } = useToast()

  const [showDateModal, setShowDateModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [datePreset, setDatePreset] = useState("thisMonth")
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date()
    return {
      start: startOfMonth(now),
      end: endOfMonth(now),
    }
  })
  const [selectedOutlet, setSelectedOutlet] = useState<string>("all")

  const [summary, setSummary] = useState<SalesReportSummary | null>(null)
  const [dailyRows, setDailyRows] = useState<any[]>([])

  const outletOptions = useMemo(() => {
    if (!outlets?.length) return []
    return outlets.map((outlet) => ({ id: String(outlet.id), name: outlet.name }))
  }, [outlets])

  useEffect(() => {
    if (!currentOutlet) return
    if (selectedOutlet === "all" && outletOptions.length === 1) {
      setSelectedOutlet(String(currentOutlet.id))
    }
  }, [currentOutlet, outletOptions.length, selectedOutlet])

  const formatCurrency = useCallback(
    (value: number) => {
      const symbol = currentBusiness?.currencySymbol || "MK"
      return `${symbol} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    [currentBusiness]
  )

  const normalizeArray = (value: any) => {
    if (Array.isArray(value)) return value
    if (Array.isArray(value?.results)) return value.results
    if (Array.isArray(value?.data)) return value.data
    return []
  }

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
        next = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
        break
      case "lastMonth": {
        const lastMonth = subMonths(now, 1)
        next = { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
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
    if (!currentBusiness) return

    const outletParam = selectedOutlet !== "all" ? selectedOutlet : undefined
    const startDate = format(dateRange.start, "yyyy-MM-dd")
    const endDate = format(dateRange.end, "yyyy-MM-dd")

    setIsLoading(true)
    try {
      const [summaryResponse, dailySalesResponse] = await Promise.all([
        reportService.getSalesReport({
          outlet: outletParam,
          start_date: startDate,
          end_date: endDate,
        }),
        reportService.getDailySales({
          outlet: outletParam,
          start_date: startDate,
          end_date: endDate,
        }),
      ])

      const daily = normalizeArray(dailySalesResponse?.daily || dailySalesResponse)

      setSummary(summaryResponse)
      setDailyRows(daily)
    } catch (error: any) {
      console.error("Failed to load sales report:", error)
      toast({
        title: t("common.messages.error"),
        description: error?.message || "Failed to load sales report",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, dateRange.end, dateRange.start, selectedOutlet, t, toast])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  const handleExport = async (formatType: "xlsx" | "pdf") => {
    const outletParam = selectedOutlet !== "all" ? selectedOutlet : undefined
    const startDate = format(dateRange.start, "yyyy-MM-dd")
    const endDate = format(dateRange.end, "yyyy-MM-dd")
    const endpoint = formatType === "xlsx" ? apiEndpoints.reports.salesXlsx : apiEndpoints.reports.salesPdf
    try {
      await reportService.downloadReport(
        endpoint,
        {
          outlet: outletParam || "",
          start_date: startDate,
          end_date: endDate,
        },
        `sales-payments-${startDate}-to-${endDate}.${formatType}`
      )
    } catch (error: any) {
      toast({
        title: t("common.messages.error"),
        description: error?.message || "Failed to export report",
        variant: "destructive",
      })
    }
  }

  const salesDetailRows = useMemo(() => {
    const totalRevenue = Number(summary?.total_revenue || 0)
    const totalDiscount = Number(summary?.total_discount || 0)
    const totalTax = Number(summary?.total_tax || 0)
    const totalTransactions = Number(summary?.total_transactions || summary?.total_sales || 0)
    const netSales = totalRevenue - totalDiscount

    return [
      { label: "Gross Sales", value: formatCurrency(totalRevenue) },
      { label: "Net Sales", value: formatCurrency(netSales) },
      { label: "Discounts", value: formatCurrency(totalDiscount) },
      { label: "Tax Collected", value: formatCurrency(totalTax) },
      { label: "Transactions", value: totalTransactions.toLocaleString() },
    ]
  }, [formatCurrency, summary])

  const salesChartData = useMemo(() => {
    return dailyRows
      .map((row) => {
        const rawDate = row?.date || row?.day
        if (!rawDate) return null
        const parsed = parseISO(String(rawDate))
        if (!isValid(parsed)) return null
        const total = Number(row?.total_sales ?? row?.total_revenue ?? row?.sales ?? 0)
        return {
          label: format(parsed, "MMM dd"),
          total,
          date: parsed,
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.date.getTime() - b.date.getTime())
      .map((row: any) => ({ label: row.label, total: row.total }))
  }, [dailyRows])

  const paymentBreakdown = useMemo(() => {
    const rows = summary?.by_payment_method || []
    return rows.map((row) => ({
      method: row.payment_method || "Unknown",
      count: Number(row.count || 0),
      total: Number(row.total || 0),
    }))
  }, [summary])

  const paymentTotal = useMemo(() => {
    return paymentBreakdown.reduce((sum, row) => sum + row.total, 0)
  }, [paymentBreakdown])

  const headerRangeLabel = `${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`

  return (
    <DashboardLayout>
      <PageLayout
        title="Sales & Payments"
        description="Sales chart, summary totals, and payment breakdown"
      >
        <div className="sticky top-0 z-30 mb-6 border-b bg-background/95 backdrop-blur">
          <div className="flex flex-col gap-4 px-2 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm text-muted-foreground">{headerRangeLabel}</div>
              <h2 className="text-xl font-semibold">Sales & Payments</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All outlets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outlets</SelectItem>
                  {outletOptions.map((outlet) => (
                    <SelectItem key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={() => setShowDateModal(true)}>
                <CalendarDays className="mr-2 h-4 w-4" />
                {DATE_PRESETS.find((preset) => preset.id === datePreset)?.label || "Custom"}
              </Button>

              <Button variant="outline" onClick={() => handleExport("xlsx")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" onClick={() => handleExport("pdf")}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="ghost" onClick={loadReportData} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-md border bg-white p-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Sales Chart</h3>
            </div>
            <div className="h-72">
              {isLoading ? (
                <div className="h-full animate-pulse rounded bg-muted" />
              ) : salesChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">No sales data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                    <Bar dataKey="total" name="Sales" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-md border bg-white">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Sales Details</h3>
            </div>
            <Table>
              <TableBody>
                {salesDetailRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right">{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-md border bg-white p-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Payment Breakdown</h3>
              <p className="text-xs text-muted-foreground">Total collected: {formatCurrency(paymentTotal)}</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div className="h-64">
                {isLoading ? (
                  <div className="h-full animate-pulse rounded bg-muted" />
                ) : paymentBreakdown.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">No payment data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentBreakdown} dataKey="total" nameKey="method" outerRadius={90} innerRadius={55}>
                        {paymentBreakdown.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentBreakdown.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No payment data
                        </TableCell>
                      </TableRow>
                    ) : (
                      paymentBreakdown.map((row) => (
                        <TableRow key={row.method}>
                          <TableCell className="capitalize">{row.method}</TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(row.total)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
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
            <Button variant="outline" onClick={() => setShowDateModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
