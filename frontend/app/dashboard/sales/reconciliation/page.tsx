"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { DateRangeFilter } from "@/components/dashboard/date-range-filter"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { saleService, type SalesStockReconcileRow } from "@/lib/services/saleService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"

function makeRunKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `reconcile-${Date.now()}`
}

export default function SalesReconciliationPage() {
  const { currentBusiness, currentOutlet: storeOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet } = useTenant()
  const { toast } = useToast()

  const outlet = tenantOutlet || storeOutlet
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({})
  const [rows, setRows] = useState<SalesStockReconcileRow[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isApplyLoading, setIsApplyLoading] = useState(false)
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const [rangeLabel, setRangeLabel] = useState("")

  const totals = useMemo(() => {
    let sold = 0
    let selected = 0
    for (const row of rows) {
      sold += row.sold_qty
      if (selectedProductIds.has(row.product_id)) {
        selected += row.sold_qty
      }
    }
    return { sold, selected }
  }, [rows, selectedProductIds])

  const allSelected = rows.length > 0 && selectedProductIds.size === rows.length

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProductIds(new Set(rows.map((row) => row.product_id)))
      return
    }
    setSelectedProductIds(new Set())
  }

  const toggleRow = (productId: string, checked: boolean) => {
    const next = new Set(selectedProductIds)
    if (checked) {
      next.add(productId)
    } else {
      next.delete(productId)
    }
    setSelectedProductIds(next)
  }

  const getRequestWindow = () => {
    if (!dateRange.start || !dateRange.end) {
      return null
    }
    const start = format(dateRange.start, "yyyy-MM-dd")
    const end = format(dateRange.end, "yyyy-MM-dd")
    return {
      start,
      end,
      label: `${format(dateRange.start, "dd MMM yyyy")} - ${format(dateRange.end, "dd MMM yyyy")}`,
    }
  }

  const handlePreview = async (options?: { silent?: boolean }) => {
    const outletId = outlet?.id ? String(outlet.id) : ""
    if (!outletId) {
      toast({ title: "No outlet selected", description: "Select an outlet before preview.", variant: "destructive" })
      return
    }

    const windowRange = getRequestWindow()
    if (!windowRange) {
      toast({ title: "Date range required", description: "Pick a date range first.", variant: "destructive" })
      return
    }

    setIsPreviewLoading(true)
    try {
      const response = await saleService.previewStockReconciliation({
        outlet: outletId,
        start_date: windowRange.start,
        end_date: windowRange.end,
      })
      setRows(response.rows || [])
      setSelectedProductIds(new Set((response.rows || []).map((row) => row.product_id)))
      setRangeLabel(windowRange.label)
      if (!options?.silent) {
        toast({
          title: "Preview ready",
          description: `${response.summary?.total_products || 0} product(s) found in selected range.`,
        })
      }
    } catch (error: any) {
      setRows([])
      setSelectedProductIds(new Set())
      toast({
        title: "Preview failed",
        description: error?.data?.detail || error?.message || "Failed to load preview",
        variant: "destructive",
      })
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const handleApply = async () => {
    const outletId = outlet?.id ? String(outlet.id) : ""
    if (!outletId) {
      toast({ title: "No outlet selected", description: "Select an outlet before apply.", variant: "destructive" })
      return
    }

    const windowRange = getRequestWindow()
    if (!windowRange) {
      toast({ title: "Date range required", description: "Pick a date range first.", variant: "destructive" })
      return
    }

    if (selectedProductIds.size === 0) {
      toast({ title: "No items selected", description: "Select at least one product to apply deduction.", variant: "destructive" })
      return
    }

    setIsApplyLoading(true)
    try {
      const response = await saleService.applyStockReconciliation({
        outlet: outletId,
        start_date: windowRange.start,
        end_date: windowRange.end,
        confirm: true,
        product_ids: Array.from(selectedProductIds),
        idempotency_key: makeRunKey(),
      })

      toast({
        title: response.already_applied ? "Already applied" : "Deduction applied",
        description: response.detail,
      })

      setShowApplyConfirm(false)
      await handlePreview({ silent: true })
    } catch (error: any) {
      const conflictRows = Array.isArray(error?.data?.insufficient) ? error.data.insufficient : []
      if (error?.status === 409 && conflictRows.length > 0) {
        toast({
          title: "Insufficient stock",
          description: `${conflictRows.length} product(s) have lower stock than deduction quantity.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Apply failed",
          description: error?.data?.detail || error?.message || "Failed to apply stock deduction",
          variant: "destructive",
        })
      }
    } finally {
      setIsApplyLoading(false)
    }
  }

  const requestApplyConfirmation = () => {
    const outletId = outlet?.id ? String(outlet.id) : ""
    if (!outletId) {
      toast({ title: "No outlet selected", description: "Select an outlet before apply.", variant: "destructive" })
      return
    }

    const windowRange = getRequestWindow()
    if (!windowRange) {
      toast({ title: "Date range required", description: "Pick a date range first.", variant: "destructive" })
      return
    }

    if (selectedProductIds.size === 0) {
      toast({ title: "No items selected", description: "Select at least one product to apply deduction.", variant: "destructive" })
      return
    }

    setShowApplyConfirm(true)
  }

  return (
    <div className="w-full">
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-xl font-semibold text-gray-900">Sales Stock Deduction</h2>
        <p className="text-sm text-gray-600">
          Scan sold quantities in a date range, preview impact, then apply controlled deduction.
        </p>
      </div>

      <div className="px-6 py-4 border-b border-gray-300">
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter
            defaultPreset="today"
            onRangeChange={(range) => {
              setDateRange({ start: range.start, end: range.end })
            }}
          />
          <Button variant="outline" className="border-gray-300" onClick={() => { void handlePreview() }} disabled={isPreviewLoading}>
            {isPreviewLoading ? "Scanning..." : "Scan Sold Items"}
          </Button>
          <Button
            onClick={requestApplyConfirmation}
            disabled={isApplyLoading || selectedProductIds.size === 0 || rows.length === 0}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isApplyLoading ? "Applying..." : `Apply Deduct (${selectedProductIds.size})`}
          </Button>
        </div>
      </div>

      <div className="px-6 py-4">
        {rows.length === 0 ? (
          <div className="text-center py-8 text-gray-600">Run scan to preview sold quantities for deduction.</div>
        ) : (
          <div className="rounded-md border border-gray-300 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm text-gray-700 flex items-center justify-between">
              <div>
                Range: <span className="font-medium">{rangeLabel || "-"}</span>
              </div>
              <div>
                Sold Qty: <span className="font-semibold">{totals.sold}</span> | Selected Qty: <span className="font-semibold">{totals.selected}</span>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="text-gray-900 font-semibold">Product</TableHead>
                  <TableHead className="text-gray-900 font-semibold">SKU</TableHead>
                  <TableHead className="text-gray-900 font-semibold">Sold Qty</TableHead>
                  <TableHead className="text-gray-900 font-semibold">Current Stock</TableHead>
                  <TableHead className="text-gray-900 font-semibold">Projected Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const isSelected = selectedProductIds.has(row.product_id)
                  return (
                    <TableRow key={row.product_id} className="border-gray-300">
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleRow(row.product_id, Boolean(checked))}
                          aria-label={`Select ${row.product_name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{row.product_name}</TableCell>
                      <TableCell>{row.sku || "-"}</TableCell>
                      <TableCell>{row.sold_qty}</TableCell>
                      <TableCell>{row.current_stock}</TableCell>
                      <TableCell className={row.projected_stock < 0 ? "text-red-600 font-semibold" : ""}>
                        {row.projected_stock}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="px-6 pb-6 text-xs text-gray-500">
        Outlet: {outlet?.name || "No outlet selected"} | Currency: {currentBusiness?.currencySymbol || "MWK"}
      </div>

      <AlertDialog open={showApplyConfirm} onOpenChange={setShowApplyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Stock Deduction</AlertDialogTitle>
            <AlertDialogDescription>
              Apply stock deduction for {selectedProductIds.size} selected product(s) in range {rangeLabel || "selected range"}? This action changes inventory and cannot be auto-undo from this screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApplyLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApply} disabled={isApplyLoading}>
              {isApplyLoading ? "Applying..." : "Confirm and Deduct"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
