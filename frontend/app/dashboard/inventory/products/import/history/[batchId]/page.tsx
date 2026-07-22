"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { productService } from "@/lib/services/productService"
import { ArrowLeft, Download } from "lucide-react"

type ImportRowDetail = {
  row_number: number
  product_name: string
  sku: string
  barcode: string
  category: string
  price: string
  cost: string
  stock: string
  status: string
  mismatch_error: string
}

type ImportRowsPayload = {
  batch_id: string
  status: string
  is_approved: boolean
  import_date: string
  source_filename: string
  outlet: { id: string; name: string }
  count: number
  page: number
  page_size: number
  total_pages: number
  results: ImportRowDetail[]
}

const PAGE_SIZE = 10

export default function ImportHistoryDetailPage() {
  const { toast } = useToast()
  const params = useParams<{ batchId: string }>()
  const searchParams = useSearchParams()
  const batchId = String(params?.batchId || "")
  const importMode = searchParams?.get('mode') === 'sync' ? 'inventory_sync' : 'products'
  const isSyncMode = importMode === 'inventory_sync'

  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const [payload, setPayload] = useState<ImportRowsPayload | null>(null)

  const csvEscape = (value: string | number) => {
    const text = String(value ?? "")
    if (text.includes(",") || text.includes("\n") || text.includes("\"")) {
      return `"${text.replace(/\"/g, "\"\"")}"`
    }
    return text
  }

  const loadRows = useCallback(async (targetPage?: number) => {
    if (!batchId) return
    const pageToLoad = targetPage || page

    setLoading(true)
    try {
      const data = await productService.getImportRows(batchId, {
        page: pageToLoad,
        pageSize: PAGE_SIZE,
        search: searchTerm,
        mode: importMode,
      })
      setPayload(data)
      setPage(data.page || pageToLoad)
    } catch (error: any) {
      toast({
        title: "History Detail Failed",
        description: error?.message || "Failed to load import history details.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [batchId, page, searchTerm, toast, importMode])

  useEffect(() => {
    loadRows(1)
  }, [batchId, loadRows])

  useEffect(() => {
    const id = setTimeout(() => {
      loadRows(1)
    }, 250)

    return () => clearTimeout(id)
  }, [searchTerm, loadRows])

  const summaryRows = useMemo(
    () => [
      { label: "Batch ID", value: payload?.batch_id || "-" },
      { label: "Import Date", value: payload?.import_date ? new Date(payload.import_date).toLocaleString() : "-" },
      { label: "File", value: payload?.source_filename || "-" },
      { label: "Outlet", value: payload?.outlet?.name || "-" },
      { label: "Status", value: payload?.status || "-" },
      { label: "Approved", value: payload?.is_approved ? "Yes" : "No" },
      { label: "Rows", value: String(payload?.count || 0) },
    ],
    [payload]
  )

  const handleExportCsv = async () => {
    if (!batchId) return

    setIsExporting(true)
    try {
      const pageSize = 100
      const firstPage = await productService.getImportRows(batchId, {
        page: 1,
        pageSize,
        search: searchTerm,
        mode: importMode,
      })

      let allRows = [...(firstPage.results || [])]
      const totalPages = firstPage.total_pages || 1

      for (let current = 2; current <= totalPages; current += 1) {
        const nextPage = await productService.getImportRows(batchId, {
          page: current,
          pageSize,
          search: searchTerm,
          mode: importMode,
        })
        allRows = allRows.concat(nextPage.results || [])
      }

      const headers = [
        "Row",
        "Product Name",
        "SKU",
        "Barcode",
        "Category",
        "Price",
        "Cost",
        "Stock",
        "Status",
        "Mismatch / Error",
      ]

      const lines = [
        headers.join(","),
        ...allRows.map((row) =>
          [
            row.row_number,
            row.product_name,
            row.sku,
            row.barcode,
            row.category,
            row.price,
            row.cost,
            row.stock,
            row.status,
            row.mismatch_error,
          ]
            .map(csvEscape)
            .join(",")
        ),
      ]

      const csvText = lines.join("\n")
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)

      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `import-history-${batchId}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error?.message || "Unable to export import history rows.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={isSyncMode ? "Sync Process Details" : "Import History Details"}
        description={isSyncMode ? "Full row-level history for selected sync batch." : "Full row-level history for selected import batch."}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-gray-300"
              onClick={handleExportCsv}
              disabled={isExporting || loading}
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button asChild variant="default">
              <Link href={isSyncMode ? `/dashboard/inventory/products/import?mode=sync&batchId=${batchId}` : `/dashboard/inventory/products/import?batchId=${batchId}`}>
                Open In Import Workspace
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-gray-300">
              <Link href={isSyncMode ? "/dashboard/inventory/products/import?mode=sync" : "/dashboard/inventory/products/import"}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {isSyncMode ? "Back To Processes" : "Back To Import History"}
              </Link>
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Summary</CardTitle>
              <CardDescription>Overview of the selected import history batch.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-gray-300 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-1/3">Metric</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryRows.map((row) => (
                      <TableRow key={row.label}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell>{row.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Full Import Rows</CardTitle>
              <CardDescription>Row, Product Name, SKU, Barcode, Category, Price, Cost, Stock, Status, Mismatch / Error.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="history-row-search">Search Rows</Label>
                <input
                  id="history-row-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by product name, SKU, barcode, status, mismatch"
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="rounded-md border border-gray-300 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="w-28">SKU</TableHead>
                      <TableHead className="w-28">Barcode</TableHead>
                      <TableHead className="w-28">Category</TableHead>
                      <TableHead className="w-20">Price</TableHead>
                      <TableHead className="w-20">Cost</TableHead>
                      <TableHead className="w-20">Stock</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead>Mismatch / Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-sm text-gray-600">
                          Loading batch rows...
                        </TableCell>
                      </TableRow>
                    ) : (payload?.results || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-sm text-gray-600">
                          No rows found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (payload?.results || []).map((row) => (
                        <TableRow key={row.row_number}>
                          <TableCell>{row.row_number}</TableCell>
                          <TableCell>{row.product_name}</TableCell>
                          <TableCell>{row.sku}</TableCell>
                          <TableCell>{row.barcode}</TableCell>
                          <TableCell>{row.category}</TableCell>
                          <TableCell>{row.price}</TableCell>
                          <TableCell>{row.cost}</TableCell>
                          <TableCell>{row.stock}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                row.status === "Failed" || row.status === "Invalid"
                                  ? "destructive"
                                  : row.status === "Imported"
                                    ? "default"
                                    : "secondary"
                              }
                              className="text-[11px]"
                            >
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.mismatch_error}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {(payload?.count || 0) > PAGE_SIZE && (
                <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-600">
                    Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, payload?.count || 0)} of {payload?.count || 0}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">Page {page} of {payload?.total_pages || 1}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadRows(Math.max(1, page - 1))}
                        disabled={page === 1 || loading}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadRows(Math.min(payload?.total_pages || 1, page + 1))}
                        disabled={page === (payload?.total_pages || 1) || loading}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    </DashboardLayout>
  )
}
