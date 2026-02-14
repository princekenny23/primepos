"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { FileSpreadsheet, Printer, RefreshCw } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { useBusinessStore } from "@/stores/businessStore"
import { apiEndpoints } from "@/lib/api"
import {
  reportService,
  type InventoryValuationReport,
} from "@/lib/services/reportService"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"

export default function StockValuationReportPage() {
  const { t } = useI18n()
  const { currentBusiness, currentOutlet, outlets } = useBusinessStore()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [report, setReport] = useState<InventoryValuationReport | null>(null)
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    return format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd")
  })
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [selectedOutlet, setSelectedOutlet] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

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

  const categoryOptions = useMemo(() => {
    if (!report?.categories?.length) return []
    return report.categories.map((category) => ({
      id: String(category.id),
      name: category.name,
    }))
  }, [report?.categories])

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

  const loadReportData = useCallback(async () => {
    const outletParam = selectedOutlet !== "all" ? selectedOutlet : undefined
    const categoryParam = selectedCategory !== "all" ? selectedCategory : undefined

    setIsLoading(true)
    try {
      const response = await reportService.getInventoryValuation({
        outlet: outletParam,
        start_date: startDate,
        end_date: endDate,
        category: categoryParam,
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
  }, [endDate, selectedCategory, selectedOutlet, startDate, t, toast])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  const handleExportXlsx = async () => {
    try {
      await reportService.downloadReport(
        apiEndpoints.reports.inventoryValuationXlsx,
        {
          outlet: selectedOutlet !== "all" ? selectedOutlet : "",
          start_date: startDate,
          end_date: endDate,
          category: selectedCategory !== "all" ? selectedCategory : "",
        },
        `stock-valuation-${startDate}-to-${endDate}.xlsx`
      )
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
          outlet: selectedOutlet !== "all" ? selectedOutlet : "",
          start_date: startDate,
          end_date: endDate,
          category: selectedCategory !== "all" ? selectedCategory : "",
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
              {t("reports.actions.export_excel")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <Printer className="mr-2 h-4 w-4" />
              {t("reports.actions.print")}
            </Button>
          </div>
        }
      >
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="outlet">Outlet</Label>
              <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                <SelectTrigger id="outlet">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            <div className="flex items-end gap-2 lg:col-span-4">
              <Button onClick={loadReportData} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {isLoading ? t("common.status.loading") : t("common.actions.refresh")}
              </Button>
            </div>
          </CardContent>
        </Card>

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
    </DashboardLayout>
  )
}
