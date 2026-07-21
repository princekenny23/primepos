"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import * as XLSX from "xlsx"
import { ArrowLeft, CheckCircle2, Download, Upload, XCircle, Plus } from "lucide-react"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { FilterableTabs, TabsContent, type TabConfig } from "@/components/ui/filterable-tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { inventoryService } from "@/lib/services/inventoryService"
import { useToast } from "@/components/ui/use-toast"
import { AddRejectedProductDialog } from "@/components/dialogs/add-rejected-product-dialog"

interface StockTakingItem {
  id: string
  product_id: string
  product_name: string
  barcode: string
}

interface ImportedStockTakeRow {
  rowNumber: number
  productName: string
  countedQuantity: number
  sku?: string
  barcode?: string
}

interface StockTakeImportDetailRow extends ImportedStockTakeRow {
  status: "Pending" | "Ready" | "Rejected" | "Imported" | "Failed"
  issue: string
  targetItemId?: string
  targetProductId?: string
}

interface StockTakeImportHistoryRow {
  id: string
  importedAt: string
  fileName: string
  totalRows: number
  matchedRows: number
  rejectedRows: number
  updatedItems: number
  importedRows: number
  failedRows: number
  status: "Previewed" | "Applied" | "Applied With Errors"
}

const PAGE_SIZE = 10
const HISTORY_STORAGE_PREFIX = "stock-take-import-history"

const normalizeHeader = (value: string) =>
  value.toLowerCase().trim().replace(/[\s\-_]+/g, "")

const normalizeValue = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")

function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  const parsed = Number(String(value ?? "").trim())
  return Number.isFinite(parsed) ? parsed : NaN
}

function parseImportRows(file: File): Promise<ImportedStockTakeRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const data = event.target?.result
        if (!data) {
          reject(new Error("Unable to read file content."))
          return
        }

        const workbook = XLSX.read(data, { type: "array" })
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) {
          reject(new Error("No worksheet found in file."))
          return
        }

        const sheet = workbook.Sheets[firstSheetName]
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
        })

        if (!rawRows.length) {
          reject(new Error("The selected file is empty."))
          return
        }

        const mappedRows: ImportedStockTakeRow[] = rawRows
          .map((rawRow, index) => {
            const normalized: Record<string, unknown> = {}
            Object.entries(rawRow).forEach(([key, val]) => {
              normalized[normalizeHeader(key)] = val
            })

            const productName = String(
              normalized.productname || normalized.name || normalized.product || ""
            ).trim()

            const countedQuantityRaw =
              normalized.countedquantity || normalized.quantity || normalized.count || ""
            const countedQuantity = toNumber(countedQuantityRaw)

            const sku = String(normalized.sku || "").trim()
            const barcode = String(normalized.barcode || "").trim()

            return {
              rowNumber: index + 2,
              productName,
              countedQuantity,
              sku: sku || undefined,
              barcode: barcode || undefined,
            }
          })
          .filter((row) => row.productName || row.sku || row.barcode)

        const invalidQty = mappedRows.find(
          (row) => !Number.isFinite(row.countedQuantity) || row.countedQuantity < 0
        )
        if (invalidQty) {
          reject(
            new Error(
              `Invalid counted quantity for product '${invalidQty.productName}'. Use a number greater than or equal to 0.`
            )
          )
          return
        }

        if (!mappedRows.length) {
          reject(
            new Error(
              "No valid rows found. Provide at least one identifier such as Product Name, SKU, or Barcode, plus a counted quantity."
            )
          )
          return
        }

        resolve(mappedRows)
      } catch (error: any) {
        reject(new Error(error?.message || "Failed to parse file."))
      }
    }

    reader.onerror = () => reject(new Error("Failed to read selected file."))
    reader.readAsArrayBuffer(file)
  })
}

function calculateSimilarity(left: string, right: string): number {
  if (!left || !right) return 0
  if (left === right) return 1

  const maxLength = Math.max(left.length, right.length)
  if (maxLength === 0) return 1

  const leftChars = left.split("")
  const rightChars = right.split("")
  const dp = Array.from({ length: leftChars.length + 1 }, () =>
    new Array(rightChars.length + 1).fill(0)
  )

  for (let i = 0; i <= leftChars.length; i += 1) dp[i][0] = i
  for (let j = 0; j <= rightChars.length; j += 1) dp[0][j] = j

  for (let i = 1; i <= leftChars.length; i += 1) {
    for (let j = 1; j <= rightChars.length; j += 1) {
      const cost = leftChars[i - 1] === rightChars[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }

  return 1 - dp[leftChars.length][rightChars.length] / maxLength
}

function findBestStockTakeMatch(
  row: ImportedStockTakeRow,
  stockTakeItems: StockTakingItem[]
): { item: StockTakingItem; matchLabel: string } | null {
  const rowBarcode = normalizeValue(row.barcode)
  const rowSku = normalizeValue(row.sku)
  const rowName = normalizeValue(row.productName)

  const isPlaceholderItem = (item: StockTakingItem) => String(item.id).startsWith("placeholder-")

  const exactBarcodeCandidates = rowBarcode
    ? stockTakeItems.filter((item) => normalizeValue(item.barcode) === rowBarcode)
    : []
  if (exactBarcodeCandidates.length) {
    const exactBarcodeReal = exactBarcodeCandidates.filter((item) => !isPlaceholderItem(item))
    if (exactBarcodeReal.length >= 1) {
      return { item: exactBarcodeReal[0], matchLabel: "Matched by barcode" }
    }
    if (exactBarcodeCandidates.length === 1) {
      return { item: exactBarcodeCandidates[0], matchLabel: "Matched by barcode" }
    }
    return null
  }

  const exactSkuCandidates = rowSku
    ? stockTakeItems.filter((item) => normalizeValue(item.product_id) === rowSku)
    : []
  if (exactSkuCandidates.length) {
    const exactSkuReal = exactSkuCandidates.filter((item) => !isPlaceholderItem(item))
    if (exactSkuReal.length >= 1) {
      return { item: exactSkuReal[0], matchLabel: "Matched by SKU" }
    }
    if (exactSkuCandidates.length === 1) {
      return { item: exactSkuCandidates[0], matchLabel: "Matched by SKU" }
    }
    return null
  }

  if (!rowName) return null

  const nameCandidates = stockTakeItems
    .map((item) => {
      const candidateName = normalizeValue(item.product_name)
      if (!candidateName) return null

      const containsMatch = candidateName.includes(rowName) || rowName.includes(candidateName)
      const similarity = calculateSimilarity(rowName, candidateName)

      return {
        item,
        similarity,
        containsMatch,
        isPlaceholder: isPlaceholderItem(item),
      }
    })
    .filter(
      (candidate): candidate is {
        item: StockTakingItem
        similarity: number
        containsMatch: boolean
        isPlaceholder: boolean
      } => Boolean(candidate)
    )

  if (!nameCandidates.length) return null

  const bestCandidate = nameCandidates.reduce((best, current) => {
    if (best.isPlaceholder && !current.isPlaceholder) return current
    if (!best.isPlaceholder && current.isPlaceholder) return best
    if (current.containsMatch && !best.containsMatch) return current
    if (!current.containsMatch && best.containsMatch) return best
    if (current.similarity > best.similarity) return current
    return best
  }, nameCandidates[0])

  if (bestCandidate.containsMatch) {
    return { item: bestCandidate.item, matchLabel: "Matched by product name" }
  }

  if (bestCandidate.similarity >= 0.9) {
    return { item: bestCandidate.item, matchLabel: "Matched by product name similarity" }
  }

  return null
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function getHistoryStorageKey(stockTakeId: string) {
  return `${HISTORY_STORAGE_PREFIX}:${stockTakeId}`
}

export default function StockTakingImportPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const stockTakeId = params.id as string
  const { toast } = useToast()

  const [stockTake, setStockTake] = useState<any>(null)
  const [items, setItems] = useState<StockTakingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importRows, setImportRows] = useState<ImportedStockTakeRow[]>([])
  const [previewRows, setPreviewRows] = useState<StockTakeImportDetailRow[]>([])
  const [historyRows, setHistoryRows] = useState<StockTakeImportHistoryRow[]>([])
  const [historySearchTerm, setHistorySearchTerm] = useState("")
  const [detailSearchTerm, setDetailSearchTerm] = useState("")
  const [detailPage, setDetailPage] = useState(1)
  const [isParsingFile, setIsParsingFile] = useState(false)
  const [loadingAction, setLoadingAction] = useState<"" | "preview" | "apply">("")
  const [activeTab, setActiveTab] = useState("upload-preview")
  const [showAddRejectedDialog, setShowAddRejectedDialog] = useState(false)
  const [selectedRejectedRow, setSelectedRejectedRow] = useState<ImportedStockTakeRow | null>(null)
  const [viewingHistoricalImportId, setViewingHistoricalImportId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [stockTakeData, itemsData] = await Promise.all([
        inventoryService.getStockTake(stockTakeId),
        inventoryService.getStockTakeItems(stockTakeId),
      ])

      setStockTake(stockTakeData)
      setItems(
        itemsData.map((item: any) => ({
          id: String(item.id),
          product_id: String(item.product?.id || item.product_id || ""),
          product_name: item.product?.name || "Unknown Product",
          barcode: item.product?.barcode || "",
        }))
      )
    } catch (error: any) {
      const status = error?.status
      setLoadError(
        status === 404
          ? "This stock take was not found for your current outlet or may have been deleted."
          : "Failed to load stock take data. Please try again."
      )
    } finally {
      setIsLoading(false)
    }
  }, [stockTakeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const raw = window.localStorage.getItem(getHistoryStorageKey(stockTakeId))
      setHistoryRows(raw ? JSON.parse(raw) : [])
    } catch {
      setHistoryRows([])
    }
  }, [stockTakeId])

  useEffect(() => {
    setDetailPage(1)
  }, [detailSearchTerm, previewRows.length])

  // Load historical import if importId query param exists
  useEffect(() => {
    if (typeof window === "undefined") return

    const importId = searchParams?.get("importId")
    if (!importId) {
      setViewingHistoricalImportId(null)
      return
    }

    try {
      const raw = window.localStorage.getItem(getHistoryStorageKey(stockTakeId))
      const history = raw ? JSON.parse(raw) : []
      const historicalImport = history.find((h: StockTakeImportHistoryRow) => h.id === importId)

      if (historicalImport) {
        setViewingHistoricalImportId(importId)
        // Reconstruct preview rows from historical data if available
        // For now, show the summary stats
        setActiveTab("import-summary")
      }
    } catch (error) {
      console.error("Failed to load historical import:", error)
    }
  }, [searchParams, stockTakeId])

  const summary = useMemo(() => {
    const matchedRows = previewRows.filter((row) => row.status !== "Rejected").length
    const rejectedRows = previewRows.filter((row) => row.status === "Rejected").length
    const importedRowsCount = previewRows.filter((row) => row.status === "Imported").length
    const failedRows = previewRows.filter((row) => row.status === "Failed").length
    const updatedItems = new Set(
      previewRows
        .filter((row) => row.status !== "Rejected" && row.targetItemId)
        .map((row) => row.targetItemId)
    ).size

    let status = "Not started"
    if (previewRows.length > 0) status = "Previewed"
    if (importedRowsCount > 0 && failedRows === 0) status = "Applied"
    if (importedRowsCount > 0 && failedRows > 0) status = "Applied With Errors"

    return {
      totalRows: importRows.length,
      matchedRows,
      rejectedRows,
      updatedItems,
      importedRows: importedRowsCount,
      failedRows,
      status,
    }
  }, [importRows.length, previewRows])

  const summaryRows = useMemo(
    () => [
      { label: "File", value: importFile?.name || "-" },
      { label: "Stock Take", value: stockTake?.description || stockTake?.id || "-" },
      { label: "Status", value: summary.status },
      { label: "Total Rows", value: String(summary.totalRows) },
      { label: "Matched Rows", value: String(summary.matchedRows) },
      { label: "Rejected Rows", value: String(summary.rejectedRows) },
      { label: "Unique Items To Update", value: String(summary.updatedItems) },
      { label: "Imported Rows", value: String(summary.importedRows) },
      { label: "Failed Rows", value: String(summary.failedRows) },
    ],
    [importFile?.name, stockTake?.description, stockTake?.id, summary]
  )

  const importTabs: TabConfig[] = useMemo(
    () => [
      {
        value: "upload-preview",
        label: "Upload & Preview",
        icon: Upload,
      },
      {
        value: "import-summary",
        label: "Import Count Summary",
        icon: CheckCircle2,
      },
      {
        value: "rejected-counts",
        label: "Rejected",
        icon: XCircle,
        badgeCount: previewRows.filter((row) => row.status === "Rejected" || row.status === "Failed").length,
        badgeVariant: "destructive",
      },
      {
        value: "history",
        label: "History",
        icon: CheckCircle2,
      },
    ],
    [previewRows]
  )

  const filteredDetailRows = useMemo(() => {
    const term = detailSearchTerm.trim().toLowerCase()
    if (!term) return previewRows

    return previewRows.filter((row) =>
      row.productName.toLowerCase().includes(term) ||
      (row.sku || "").toLowerCase().includes(term) ||
      (row.barcode || "").toLowerCase().includes(term)
    )
  }, [previewRows, detailSearchTerm])

  const totalDetailPages = Math.max(1, Math.ceil(filteredDetailRows.length / PAGE_SIZE))
  const detailPageRows = useMemo(() => {
    const start = (detailPage - 1) * PAGE_SIZE
    return filteredDetailRows.slice(start, start + PAGE_SIZE)
  }, [detailPage, filteredDetailRows])

  const previewPageRows = useMemo(() => importRows.slice(0, PAGE_SIZE), [importRows])

  const rejectedRows = useMemo(
    () => previewRows.filter((row) => row.status === "Rejected" || row.status === "Failed"),
    [previewRows]
  )

  const filteredHistoryRows = useMemo(() => {
    const term = historySearchTerm.trim().toLowerCase()
    if (!term) return historyRows

    return historyRows.filter((row) =>
      row.fileName.toLowerCase().includes(term) ||
      row.status.toLowerCase().includes(term) ||
      formatDateTime(row.importedAt).toLowerCase().includes(term)
    )
  }, [historyRows, historySearchTerm])

  const buildPreviewRows = (rows: ImportedStockTakeRow[]): StockTakeImportDetailRow[] => {
    const savedStockTakeItems = items.filter((item) => !String(item.id).startsWith("placeholder-"))

    return rows.map((row) => {
      const match = findBestStockTakeMatch(row, savedStockTakeItems)
      if (!match) {
        return {
          ...row,
          status: "Rejected",
          issue: "No matching item found in this stock take session.",
        }
      }

      return {
        ...row,
        status: "Ready",
        issue: match.matchLabel,
        targetItemId: String(match.item.id),
        targetProductId: String(match.item.product_id || ""),
      }
    })
  }

  const persistHistory = (entry: StockTakeImportHistoryRow) => {
    setHistoryRows((prev) => {
      const next = [entry, ...prev]
      if (typeof window !== "undefined") {
        window.localStorage.setItem(getHistoryStorageKey(stockTakeId), JSON.stringify(next))
      }
      return next
    })
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return

    const fileName = selected.name.toLowerCase()
    if (!fileName.match(/\.(xlsx?|csv)$/)) {
      toast({
        title: "Invalid File",
        description: "Select an Excel (.xlsx/.xls) or CSV (.csv) file.",
        variant: "destructive",
      })
      return
    }

    setImportFile(selected)
    setImportRows([])
    setPreviewRows([])
    setDetailSearchTerm("")
    setActiveTab("upload-preview")

    setIsParsingFile(true)
    try {
      const parsedRows = await parseImportRows(selected)
      setImportRows(parsedRows)
      toast({
        title: "File Loaded",
        description: `${parsedRows.length} row(s) ready for preview.`,
      })
    } catch (error: any) {
      setImportFile(null)
      toast({
        title: "Read Failed",
        description: error?.message || "Failed to read stock take rows from file.",
        variant: "destructive",
      })
    } finally {
      setIsParsingFile(false)
    }
  }

  const handlePreviewImport = async () => {
    if (!importFile || importRows.length === 0) {
      toast({
        title: "No File Loaded",
        description: "Select a valid import file before previewing.",
        variant: "destructive",
      })
      return
    }

    setLoadingAction("preview")
    try {
      const nextPreviewRows = buildPreviewRows(importRows)
      setPreviewRows(nextPreviewRows)
      setActiveTab("import-summary")
      toast({
        title: "Preview Ready",
        description: `Matched ${nextPreviewRows.filter((row) => row.status !== "Rejected").length} of ${nextPreviewRows.length} row(s).`,
      })
    } finally {
      setLoadingAction("")
    }
  }

  const handleApplyImport = async () => {
    if (!importFile || importRows.length === 0) {
      toast({
        title: "No File Loaded",
        description: "Select a valid import file before importing.",
        variant: "destructive",
      })
      return
    }

    const currentPreviewRows = previewRows.length > 0 ? previewRows : buildPreviewRows(importRows)
    setPreviewRows(currentPreviewRows)

    const readyRows = currentPreviewRows.filter((row) => row.status !== "Rejected" && row.targetItemId)
    if (readyRows.length === 0) {
      setActiveTab("rejected-counts")
      toast({
        title: "Nothing To Import",
        description: "No matched rows are available to import.",
        variant: "destructive",
      })
      return
    }

    setLoadingAction("apply")
    try {
      const groupedUpdates = new Map<string, {
        itemId: string
        productId?: string
        quantity: number
        rowNumbers: number[]
      }>()

      readyRows.forEach((row) => {
        const key = row.targetProductId ? `product-${row.targetProductId}` : String(row.targetItemId)
        const existing = groupedUpdates.get(key)
        if (existing) {
          existing.quantity += row.countedQuantity
          existing.rowNumbers.push(row.rowNumber)
          return
        }

        groupedUpdates.set(key, {
          itemId: String(row.targetItemId),
          productId: row.targetProductId,
          quantity: row.countedQuantity,
          rowNumbers: [row.rowNumber],
        })
      })

      const plans = Array.from(groupedUpdates.entries())
      const results = await Promise.allSettled(
        plans.map(([_, plan]) =>
          inventoryService.updateStockTakeItem(stockTakeId, plan.itemId, {
            counted_quantity: plan.quantity,
            notes: `Imported from ${importFile.name}`,
          })
        )
      )

      const outcomeMap = new Map<string, { success: boolean; reason: string }>()
      plans.forEach(([key], index) => {
        const result = results[index]
        if (result.status === "fulfilled") {
          outcomeMap.set(key, { success: true, reason: "Imported successfully." })
          return
        }

        const reason = (result.reason as any)?.message || "Failed to update stock take item."
        outcomeMap.set(key, { success: false, reason })
      })

      const nextPreviewRows = currentPreviewRows.map((row) => {
        if (row.status === "Rejected") return row

        const key = row.targetProductId ? `product-${row.targetProductId}` : String(row.targetItemId)
        const outcome = outcomeMap.get(key)
        if (!outcome) {
          return {
            ...row,
            status: "Failed" as const,
            issue: "Import outcome unavailable.",
          }
        }

        if (outcome.success) {
          return {
            ...row,
            status: "Imported" as const,
            issue: "Imported successfully.",
          }
        }

        return {
          ...row,
          status: "Failed" as const,
          issue: outcome.reason,
        }
      })

      setPreviewRows(nextPreviewRows)

      const importedRowsCount = nextPreviewRows.filter((row) => row.status === "Imported").length
      const failedRows = nextPreviewRows.filter((row) => row.status === "Failed").length
      const rejectedCount = nextPreviewRows.filter((row) => row.status === "Rejected").length

      persistHistory({
        id: `${Date.now()}`,
        importedAt: new Date().toISOString(),
        fileName: importFile.name,
        totalRows: nextPreviewRows.length,
        matchedRows: nextPreviewRows.filter((row) => row.status !== "Rejected").length,
        rejectedRows: rejectedCount,
        updatedItems: plans.length,
        importedRows: importedRowsCount,
        failedRows,
        status: failedRows > 0 ? "Applied With Errors" : "Applied",
      })

      if (failedRows > 0 || rejectedCount > 0) {
        setActiveTab("rejected-counts")
      } else {
        setActiveTab("import-summary")
      }

      toast({
        title: failedRows > 0 ? "Import Completed With Errors" : "Import Completed",
        description: `Imported ${importedRowsCount} row(s).${failedRows > 0 ? ` ${failedRows} row(s) failed.` : ""}`,
        variant: failedRows > 0 ? "destructive" : undefined,
      })
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error?.message || "Failed to import stock take counts. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction("")
    }
  }

  const handleDownloadImportTemplate = () => {
    const sampleRows = [
      {
        "Product Name": "Sample Product A",
        "Counted Quantity": 24,
        SKU: "SKU-001",
        Barcode: "",
      },
      {
        "Product Name": "Sample Product B",
        "Counted Quantity": 10,
        SKU: "",
        Barcode: "1234567890123",
      },
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(sampleRows)
    XLSX.utils.book_append_sheet(workbook, worksheet, "StockTakeTemplate")
    XLSX.writeFile(workbook, "stock_take_import_template.xlsx")
  }

  const handleAddRejectedProduct = (row: StockTakeImportDetailRow) => {
    setSelectedRejectedRow({
      rowNumber: row.rowNumber,
      productName: row.productName,
      countedQuantity: row.countedQuantity,
      sku: row.sku,
      barcode: row.barcode,
    })
    setShowAddRejectedDialog(true)
  }

  const handleLoadHistoricalImport = (importId: string) => {
    // Navigate to same page but with importId query param
    router.push(`/dashboard/inventory/stock-taking/${stockTakeId}/import?importId=${importId}`)
  }

  const handleBackToUpload = () => {
    // Clear the importId from URL to go back to upload
    setViewingHistoricalImportId(null)
    setActiveTab("upload-preview")
    router.push(`/dashboard/inventory/stock-taking/${stockTakeId}/import`)
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">Loading stock take import page...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (loadError) {
    return (
      <DashboardLayout>
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">{loadError}</p>
          <Button onClick={() => router.push(`/dashboard/inventory/stock-taking/${stockTakeId}`)}>
            Back to Stock Taking Session
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Import Stock Take Counts"
        description={`${stockTake?.outlet_name || stockTake?.outlet?.name || "Outlet"} - ${stockTake?.operating_date || ""}`}
        actions={
          <Button variant="outline" className="border-gray-300" onClick={() => router.push(`/dashboard/inventory/stock-taking/${stockTakeId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Session
          </Button>
        }
      >
        {viewingHistoricalImportId && (
          <div className="mb-4 rounded-md border border-blue-300 bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Viewing Previous Import</p>
                  <p className="text-sm text-blue-700">You can fix rejected items and re-import if needed.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleBackToUpload} className="border-blue-300 text-blue-700 hover:bg-blue-100">
                Back to Upload New File
              </Button>
            </div>
          </div>
        )}
        <FilterableTabs
          tabs={importTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          <TabsContent value="upload-preview" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Upload & Preview Stock Take Counts</CardTitle>
                <CardDescription>
                  Select a file, preview matched stock take rows, then import counted quantities into this active session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!viewingHistoricalImportId ? (
                  <>
                    <div className="space-y-2">
                      <Label>Import File</Label>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileChange}
                        className="block w-full rounded-md border border-gray-300 bg-white p-2 text-sm"
                        aria-label="Upload stock take import file"
                        title="Upload stock take import file"
                        disabled={viewingHistoricalImportId !== null}
                      />
                      <p className="text-xs text-gray-500">Accepted formats: .xlsx, .xls, .csv</p>
                      {importFile && <p className="text-xs text-green-700">Selected: {importFile.name}</p>}
                    </div>

                    <div className="rounded-md border border-gray-300 bg-white p-3 text-sm">
                      <p className="mb-2 font-medium text-gray-900">File Format Requirements</p>
                      <ul className="list-inside list-disc space-y-1 text-xs text-gray-700">
                        <li>At least one identifier: Product Name, SKU, or Barcode</li>
                        <li>Counted Quantity (number, 0 or greater)</li>
                      </ul>
                      <p className="mt-3 text-xs text-gray-600">
                        Matching priority: Barcode, then SKU, then Product Name similarity.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button type="button" variant="outline" className="border-gray-300" onClick={handleDownloadImportTemplate}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Template
                      </Button>
                      <Button onClick={handlePreviewImport} disabled={!importFile || isParsingFile || loadingAction !== ""}>
                        <Upload className="mr-2 h-4 w-4" />
                        {loadingAction === "preview" ? "Previewing..." : "Preview Import"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm text-amber-900">
                      You are viewing a previous import. Go to the History tab to manage other imports, or click &quot;Back to Upload New File&quot; above to upload a new file.
                    </p>
                  </div>
                )}

                <div className="rounded-md border border-gray-300 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead className="w-32">SKU</TableHead>
                        <TableHead className="w-40">Barcode</TableHead>
                        <TableHead className="w-32 text-right">Counted Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isParsingFile ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-gray-600">
                            Reading stock take rows...
                          </TableCell>
                        </TableRow>
                      ) : previewPageRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-gray-600">
                            No rows loaded yet. Upload a file to preview stock take counts.
                          </TableCell>
                        </TableRow>
                      ) : (
                        previewPageRows.map((row) => (
                          <TableRow key={row.rowNumber}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>{row.productName || "-"}</TableCell>
                            <TableCell>{row.sku || "-"}</TableCell>
                            <TableCell>{row.barcode || "-"}</TableCell>
                            <TableCell className="text-right">{row.countedQuantity}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import-summary" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Import Count Summary</CardTitle>
                <CardDescription>
                  Review matched rows, rejected rows, and final import status before or after apply.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="space-y-2">
                  <Label htmlFor="stock-take-detail-search">Search Preview Rows</Label>
                  <input
                    id="stock-take-detail-search"
                    type="text"
                    value={detailSearchTerm}
                    onChange={(e) => setDetailSearchTerm(e.target.value)}
                    placeholder="Search by product name, SKU, or barcode"
                    className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  />
                </div>

                <div className="rounded-md border border-gray-300 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead className="w-32">SKU</TableHead>
                        <TableHead className="w-40">Barcode</TableHead>
                        <TableHead className="w-24 text-right">Count</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailPageRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-sm text-gray-600">
                            {detailSearchTerm.trim()
                              ? "No matching rows found for your search."
                              : "Preview rows will appear here after you run Preview Import."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        detailPageRows.map((row) => (
                          <TableRow key={row.rowNumber}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>{row.productName || "-"}</TableCell>
                            <TableCell>{row.sku || "-"}</TableCell>
                            <TableCell>{row.barcode || "-"}</TableCell>
                            <TableCell className="text-right">{row.countedQuantity}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  row.status === "Rejected" || row.status === "Failed"
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
                            <TableCell>{row.issue}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {filteredDetailRows.length > PAGE_SIZE && (
                    <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-gray-600">
                        Showing {(detailPage - 1) * PAGE_SIZE + 1}-{Math.min(detailPage * PAGE_SIZE, filteredDetailRows.length)} of {filteredDetailRows.length}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">Page {detailPage} of {totalDetailPages}</span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailPage((prev) => Math.max(1, prev - 1))}
                            disabled={detailPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailPage((prev) => Math.min(totalDetailPages, prev + 1))}
                            disabled={detailPage === totalDetailPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-3">
                  <Button variant="outline" className="border-gray-300" onClick={handlePreviewImport} disabled={!importFile || loadingAction !== ""}>
                    {loadingAction === "preview" ? "Previewing..." : "Refresh Preview"}
                  </Button>
                  <Button onClick={handleApplyImport} disabled={!importFile || loadingAction !== "" || importRows.length === 0}>
                    {loadingAction === "apply" ? "Importing..." : "Apply Import"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rejected-counts" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Rejected Products</CardTitle>
                <CardDescription>
                  Rows that could not be matched. Click &quot;Add&quot; to search for the product and add it to this stock take.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rejectedRows.length === 0 ? (
                  <p className="text-sm text-gray-600">No rejected rows.</p>
                ) : (
                  <div className="rounded-md border border-gray-300 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-20">Row</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="w-32">SKU</TableHead>
                          <TableHead className="w-40">Barcode</TableHead>
                          <TableHead className="w-24 text-right">Count</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead className="w-32 text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rejectedRows.map((row) => (
                          <TableRow key={`${row.rowNumber}-${row.productName}-${row.status}`}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>{row.productName || "-"}</TableCell>
                            <TableCell>{row.sku || "-"}</TableCell>
                            <TableCell>{row.barcode || "-"}</TableCell>
                            <TableCell className="text-right font-medium">{row.countedQuantity}</TableCell>
                            <TableCell className="text-sm text-orange-700">{row.issue}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddRejectedProduct(row)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rejected-counts" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Rejected Products</CardTitle>
                <CardDescription>
                  Rows that could not be matched. Click &quot;Add&quot; to search for the product and add it to this stock take.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rejectedRows.length === 0 ? (
                  <p className="text-sm text-gray-600">No rejected rows.</p>
                ) : (
                  <div className="rounded-md border border-gray-300 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-20">Row</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="w-32">SKU</TableHead>
                          <TableHead className="w-40">Barcode</TableHead>
                          <TableHead className="w-24 text-right">Count</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead className="w-32 text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rejectedRows.map((row) => (
                          <TableRow key={`${row.rowNumber}-${row.productName}-${row.status}`}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>{row.productName || "-"}</TableCell>
                            <TableCell>{row.sku || "-"}</TableCell>
                            <TableCell>{row.barcode || "-"}</TableCell>
                            <TableCell className="text-right font-medium">{row.countedQuantity}</TableCell>
                            <TableCell className="text-sm text-orange-700">{row.issue}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddRejectedProduct(row)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
                <CardDescription>
                  Previous stock take count imports saved for this session in this browser.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="history-search">Search History</Label>
                  <input
                    id="history-search"
                    type="text"
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    placeholder="Search by file, date, or status"
                    className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  />
                </div>

                <div className="rounded-md border border-gray-300 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-52">Import Date</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="w-24 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistoryRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-gray-600">
                            No import history found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredHistoryRows.map((row) => (
                          <TableRow key={row.id} className="cursor-pointer hover:bg-gray-50">
                            <TableCell>{formatDateTime(row.importedAt)}</TableCell>
                            <TableCell>{row.fileName}</TableCell>
                            <TableCell>{row.status}</TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {row.totalRows} rows | matched {row.matchedRows} | rejected {row.rejectedRows}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleLoadHistoricalImport(row.id)}
                              >
                                Load
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </FilterableTabs>

        <AddRejectedProductDialog
          open={showAddRejectedDialog}
          onOpenChange={setShowAddRejectedDialog}
          rejectedRow={selectedRejectedRow}
          stockTakeId={stockTakeId}
          outletId={stockTake?.outlet?.id || ""}
          existingProductIds={items.map((i) => i.product_id)}
          onProductAdded={() => {
            toast({
              title: "Product Added",
              description: "Reloading stock take data...",
            })
            loadData()
          }}
        />
      </PageLayout>
    </DashboardLayout>
  )
}
