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
import { reportService, type ProductReportData } from "@/lib/services/reportService"
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

export default function CategorySalesPage() {
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

  const [productReport, setProductReport] = useState<ProductReportData[]>([])

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
      const productReportResponse = await reportService.getProductReport({
        outlet: outletParam,
        start_date: startDate,
        end_date: endDate,
      })

      setProductReport(productReportResponse || [])
    } catch (error: any) {
      console.error("Failed to load category sales:", error)
      toast({
        title: t("common.messages.error"),
        description: error?.message || "Failed to load category sales",
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
    const endpoint = formatType === "xlsx" ? apiEndpoints.reports.productsXlsx : apiEndpoints.reports.productsPdf
    try {
      await reportService.downloadReport(
        endpoint,
        {
          outlet: outletParam || "",
          start_date: startDate,
          end_date: endDate,
        },
        `category-sales-${startDate}-to-${endDate}.${formatType}`
      )
    } catch (error: any) {
      toast({
        title: t("common.messages.error"),
        description: error?.message || "Failed to export report",
        variant: "destructive",
      })
    }
  }

  const categoryRows = useMemo(() => {
    const map = new Map<string, { category: string; revenue: number; quantity: number }>()
    productReport.forEach((row) => {
      const category = row.category || "Uncategorized"
      const entry = map.get(category) || { category, revenue: 0, quantity: 0 }
      entry.revenue += Number(row.total_revenue || 0)
      entry.quantity += Number(row.total_sold || 0)
      map.set(category, entry)
    })
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  }, [productReport])

  const categoryChartData = useMemo(() => {
    return categoryRows.slice(0, 8).map((row) => ({
      name: row.category,
      total: row.revenue,
    }))
  }, [categoryRows])

  const headerRangeLabel = `${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`

  return (
    <DashboardLayout>
      <PageLayout
        title="Category Sales"
        description="Top category gross sales and category performance"
      >
        <div className="sticky top-0 z-30 mb-6 border-b bg-background/95 backdrop-blur">
          <div className="flex flex-col gap-4 px-2 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm text-muted-foreground">{headerRangeLabel}</div>
              <h2 className="text-xl font-semibold">Category Sales</h2>
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
              <h3 className="text-sm font-semibold">Top Category Gross Sales</h3>
            </div>
            <div className="h-72">
              {isLoading ? (
                <div className="h-full animate-pulse rounded bg-muted" />
              ) : categoryChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">No category data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                    <Bar dataKey="total" name="Gross Sales" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-md border bg-white">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Category Sales</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Item Sold</TableHead>
                  <TableHead className="text-right">Gross Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No category data
                    </TableCell>
                  </TableRow>
                ) : (
                  categoryRows.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell className="font-medium">{row.category}</TableCell>
                      <TableCell className="text-right">{row.quantity}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(row.revenue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
