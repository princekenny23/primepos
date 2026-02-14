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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useI18n } from "@/contexts/i18n-context"
import { useBusinessStore } from "@/stores/businessStore"
import { shiftService, type Shift } from "@/lib/services/shiftService"
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
import { CalendarDays, RefreshCw } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type DateRange = {
  start: Date
  end: Date
}

type CashupRow = {
  shiftId: number
  operatingDate: string
  startTime?: string | null
  endTime?: string | null
  cashier?: string | null
  outlet?: string | null
  till?: string | null
  openingCash: number
  closingCash: number
  cashSalesTotal: number
  totalRevenue: number
  expectedCash: number
  difference: number
}

type CashupChartRow = {
  label: string
  cashSales: number
  totalRevenue: number
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

export default function CashupReportPage() {
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
  const [rows, setRows] = useState<CashupRow[]>([])

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

  useEffect(() => {
    if (!currentOutlet || typeof window === "undefined") return
    try {
      localStorage.setItem("currentOutletId", String(currentOutlet.id))
    } catch {
      // ignore storage errors
    }
  }, [currentOutlet])

  const formatCurrency = useCallback(
    (value: number) => {
      const symbol = currentBusiness?.currencySymbol || "MK"
      return `${symbol} ${value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    },
    [currentBusiness]
  )

  const formatTime = (value?: string | null) => {
    if (!value) return "-"
    const parsed = parseISO(value)
    if (!isValid(parsed)) return "-"
    return format(parsed, "HH:mm")
  }

  const formatDate = (value?: string | null) => {
    if (!value) return "-"
    const parsed = parseISO(value)
    if (!isValid(parsed)) return "-"
    return format(parsed, "MMM dd, yyyy")
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
    const outletParam = selectedOutlet !== "all"
      ? selectedOutlet
      : currentOutlet
        ? String(currentOutlet.id)
        : undefined
    const startDate = format(dateRange.start, "yyyy-MM-dd")
    const endDate = format(dateRange.end, "yyyy-MM-dd")

    setIsLoading(true)
    try {
      if (!outletParam) {
        setRows([])
        toast({
          title: "Outlet required",
          description: "Select an outlet to view cashup data.",
          variant: "destructive",
        })
        return
      }
      const shifts = await shiftService.getHistory({
        outlet: outletParam,
        start_date: startDate,
        end_date: endDate,
      })

      console.log("Shift history response:", { shiftsCount: shifts.length, outletParam, startDate, endDate, shifts })

      const mapped = shifts.map((shift: Shift): CashupRow => {
        const openingCash = Number(shift.opening_cash_balance || shift.openingCashBalance || 0)
        const closingCash = Number(shift.closing_cash_balance || shift.closingCashBalance || 0)
        const cashSalesTotal = Number(shift.system_total || shift.systemTotal || 0)
        const totalRevenue = Number(shift.system_total || shift.systemTotal || 0)
        const expectedCash = openingCash + cashSalesTotal
        const difference = shift.difference !== null && shift.difference !== undefined
          ? Number(shift.difference)
          : closingCash - expectedCash

        return {
          shiftId: Number(shift.id),
          operatingDate: shift.operating_date || shift.operatingDate,
          startTime: shift.start_time || shift.startTime,
          endTime: shift.end_time || shift.endTime,
          cashier: shift.user?.first_name || shift.user?.email || "-",
          outlet: shift.outlet?.name || "-",
          till: shift.till?.name || "-",
          openingCash,
          closingCash,
          cashSalesTotal,
          totalRevenue,
          expectedCash,
          difference,
        }
      })

      setRows(mapped)
    } catch (error: any) {
      console.error("Failed to load cashup report:", error)
      console.error("Error details:", {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
      })
      toast({
        title: t("common.messages.error"),
        description: error?.message || "Failed to load cashup report",
        variant: "destructive",
      })
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [currentOutlet, dateRange.end, dateRange.start, selectedOutlet, t, toast])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  const totals = useMemo(() => {
    const totalShifts = rows.length
    const totalCashSales = rows.reduce((sum, row) => sum + row.cashSalesTotal, 0)
    const totalRevenue = rows.reduce((sum, row) => sum + row.totalRevenue, 0)
    const totalVariance = rows.reduce((sum, row) => sum + row.difference, 0)
    return { totalShifts, totalCashSales, totalRevenue, totalVariance }
  }, [rows])

  const chartData = useMemo<CashupChartRow[]>(() => {
    return rows.map((row) => {
      const parsed = parseISO(row.operatingDate)
      const label = isValid(parsed) ? format(parsed, "MMM dd") : row.operatingDate
      return {
        label,
        cashSales: row.cashSalesTotal,
        totalRevenue: row.totalRevenue,
      }
    })
  }, [rows])

  const headerRangeLabel = `${format(dateRange.start, "MMM dd, yyyy")} - ${format(dateRange.end, "MMM dd, yyyy")}`

  return (
    <DashboardLayout>
      <PageLayout
        title="Cashup Report"
        description="Shift-level cash reconciliation and variance tracking"
      >
        <div className="sticky top-0 z-30 mb-6 border-b bg-background/95 backdrop-blur">
          <div className="flex flex-col gap-4 px-2 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm text-muted-foreground">{headerRangeLabel}</div>
              <h2 className="text-xl font-semibold">Cashup Report</h2>
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

              <Button variant="ghost" onClick={loadReportData} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log("Current state:", {
                    selectedOutlet,
                    currentOutlet,
                    dateRange,
                  })
                }}
              >
                Log State
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card className="border-l-4 border-blue-500 bg-blue-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Shifts</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">
              {totals.totalShifts.toLocaleString()}
            </CardContent>
          </Card>
          <Card className="border-l-4 border-emerald-500 bg-emerald-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Cash Sales</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">
              {formatCurrency(totals.totalCashSales)}
            </CardContent>
          </Card>
          <Card className="border-l-4 border-purple-500 bg-purple-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">
              {formatCurrency(totals.totalRevenue)}
            </CardContent>
          </Card>
          <Card className="border-l-4 border-amber-500 bg-amber-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Variance</CardTitle>
            </CardHeader>
            <CardContent
              className={`text-xl font-semibold ${totals.totalVariance < 0 ? "text-red-700" : "text-emerald-700"}`}
            >
              {formatCurrency(totals.totalVariance)}
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader className="flex flex-col gap-1">
            <CardTitle>Cash vs Revenue</CardTitle>
            <p className="text-sm text-muted-foreground">
              Cash sales and total revenue by shift date
            </p>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <div className="h-full animate-pulse rounded bg-muted" />
            ) : chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No chart data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(Number(value || 0))}
                  />
                  <Bar dataKey="cashSales" name="Cash Sales" fill="#10B981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="totalRevenue" name="Total Revenue" fill="#2563EB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-1">
            <CardTitle>Shift Cashups</CardTitle>
            <p className="text-sm text-muted-foreground">
              {rows.length} shifts • Period {format(dateRange.start, "yyyy-MM-dd")} to {format(dateRange.end, "yyyy-MM-dd")}
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Outlet / Till</TableHead>
                  <TableHead className="text-right">Opening Cash</TableHead>
                  <TableHead className="text-right">Cash Sales</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Closing Cash</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      Loading cashup data...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No cashup data found for the selected range.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.shiftId}>
                      <TableCell>{formatDate(row.operatingDate)}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">Shift #{row.shiftId}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(row.startTime)} - {formatTime(row.endTime)}
                        </div>
                      </TableCell>
                      <TableCell>{row.cashier || "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{row.outlet || "-"}</div>
                        <div className="text-xs text-muted-foreground">{row.till || "-"}</div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(row.openingCash)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.cashSalesTotal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.expectedCash)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.closingCash)}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${row.difference < 0 ? "text-red-700" : "text-emerald-700"}`}
                      >
                        {formatCurrency(row.difference)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(row.totalRevenue)}</TableCell>
                    </TableRow>
                  ))
                )}
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
            <Button variant="outline" onClick={() => setShowDateModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
