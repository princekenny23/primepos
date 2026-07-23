"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { FilterableTabs, TabsContent, type TabConfig } from "@/components/ui/filterable-tabs"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { productService } from "@/lib/services/productService"
import { Archive, ArrowLeft, CheckCircle2, Download, Menu, Pencil, Plus, Upload, XCircle } from "lucide-react"
import * as XLSX from "xlsx"

type BatchStatus = {
  batch_id?: string
  status?: string
  is_approved?: boolean
  sync_strategy?: SyncStrategyValue
  total_rows?: number
  valid_rows?: number
  invalid_rows?: number
  warning_rows?: number
  applied_rows?: number
  preview_summary?: {
    total_rows?: number
    valid_rows?: number
    invalid_rows?: number
    warning_rows?: number
    sync_strategy?: SyncStrategyValue
  }
  apply_summary?: {
    imported?: number
    failed?: number
    total_rows?: number
    products_updated?: number
    new_products_created?: number
    stock_increases?: number
    stock_decreases?: number
    prices_changed?: number
    skipped_by_strategy?: number
    sync_strategy?: SyncStrategyValue
    errors?: number
    chunks?: Array<{
      chunk_index: number
      rows: number
      imported: number
      failed: number
      error?: string
    }>
  }
}

type SyncStrategyValue =
  | "update_existing"
  | "create_new"
  | "stock_only"
  | "prices_only"
  | "full_sync"

type PreviewErrorRow = {
  row_number: number
  errors: string[]
  raw_data?: Record<string, any>
}

type ApplyErrorRow = {
  row_number: number
  message: string
  error_code?: string
  raw_data?: Record<string, any>
}

type RejectedTableRow = {
  phase: "Preview" | "Apply"
  rowNumber: number
  productName: string
  sku: string
  barcode: string
  reason: string
  rawData?: Record<string, any>
}

type ImportedProductRow = {
  rowNumber: number
  productName: string
  sku: string
  barcode: string
  category: string
  retailPrice: string
  wholesalePrice: string
  costPrice: string
  stock: string
  lowStockThreshold: string
  batchExpiryDate: string
  description: string
  isActive: string
}

type ProductDetailRow = ImportedProductRow & {
  status: "Pending" | "Invalid" | "Ready" | "Imported" | "Failed"
  issue: string
}

type EditImportRowDraft = {
  rowNumber: number
  productName: string
  sku: string
  barcode: string
  category: string
  retailPrice: string
  costPrice: string
  stock: string
}

type ImportHistoryRow = {
  batch_id: string
  import_date: string
  source_filename: string
  status: string
  is_approved: boolean
  sync_strategy?: SyncStrategyValue
  outlet?: { id: string; name: string }
  total_rows: number
  valid_rows: number
  invalid_rows: number
  warning_rows: number
  imported: number
  failed: number
}

type ImportBatchRow = {
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
  action?: string
  matched_product_id?: string
}

type ImportRowUpdatePayload = {
  rowNumber: number
  productName: string
  sku: string
  barcode: string
  category: string
  retailPrice: string
  costPrice: string
  stock: string
  lowStockThreshold?: string
  description?: string
  isActive?: boolean
}

type MissingCatalogProduct = {
  id: string
  name: string
  sku: string
  barcode: string
  category: string
  sellable_stock: number
  low_stock_threshold: number
  retail_price: string
  is_active: boolean
}

type CreateProductDraft = {
  rowNumber: number
  productName: string
  sku: string
  barcode: string
  category: string
  retailPrice: string
  wholesalePrice: string
  costPrice: string
  stock: string
  lowStockThreshold: string
  description: string
  isActive: boolean
}

type SyncModeOption = {
  value: SyncStrategyValue
  label: string
  description: string
  recommended?: boolean
}

const PAGE_SIZE = 10

const INVENTORY_SYNC_MODES: SyncModeOption[] = [
  {
    value: "update_existing",
    label: "Update Existing Products",
    description: "Update matched catalog records without creating new products.",
  },
  {
    value: "create_new",
    label: "Create New Products",
    description: "Add products that do not already exist in the catalog.",
  },
  {
    value: "stock_only",
    label: "Update Stock Only",
    description: "Write quantity differences as stock adjustments only.",
  },
  {
    value: "prices_only",
    label: "Update Prices Only",
    description: "Apply retail, wholesale, and cost price changes only.",
  },
  {
    value: "full_sync",
    label: "Full Inventory Synchronization",
    description: "Recommended: reconcile catalog, prices, stock, and missing products together.",
    recommended: true,
  },
]

const SYNC_STRATEGY_LABELS: Record<SyncStrategyValue, string> = {
  update_existing: "Update Existing Products",
  create_new: "Create New Products",
  stock_only: "Update Stock Only",
  prices_only: "Update Prices Only",
  full_sync: "Full Inventory Synchronization",
}

const isSyncStrategyValue = (value: unknown): value is SyncStrategyValue => {
  return (
    value === "update_existing" ||
    value === "create_new" ||
    value === "stock_only" ||
    value === "prices_only" ||
    value === "full_sync"
  )
}

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, "")

const cleanBatchValue = (value: string) => {
  const normalized = String(value || "").trim()
  return normalized === "-" ? "" : normalized
}

const mapBatchRowsToImportedRows = (rows: ImportBatchRow[]): ImportedProductRow[] => {
  return rows.map((row) => ({
    rowNumber: row.row_number,
    productName: cleanBatchValue(row.product_name),
    sku: cleanBatchValue(row.sku),
    barcode: cleanBatchValue(row.barcode),
    category: cleanBatchValue(row.category),
    retailPrice: cleanBatchValue(row.price),
    wholesalePrice: "",
    costPrice: cleanBatchValue(row.cost),
    stock: cleanBatchValue(row.stock),
    lowStockThreshold: "",
    batchExpiryDate: "",
    description: "",
    isActive: "yes",
  }))
}

function parseImportRows(file: File): Promise<ImportedProductRow[]> {
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

        const mappedRows: ImportedProductRow[] = rawRows.map((rawRow, index) => {
          const normalized: Record<string, unknown> = {}
          Object.entries(rawRow).forEach(([key, val]) => {
            normalized[normalizeHeader(key)] = val
          })

          const productName = String(
            normalized.productname ||
            normalized.name ||
            normalized.product ||
            normalized.itemname ||
            ""
          ).trim()

          const sku = String(normalized.sku || normalized.code || "").trim()
          const barcode = String(normalized.barcode || normalized.barcodevalue || "").trim()
          const category = String(normalized.category || normalized.categoryname || "").trim()
          const retailPrice = String(
            normalized.retailprice || normalized.price || normalized.sellingprice || ""
          ).trim()
          const wholesalePrice = String(normalized.wholesaleprice || normalized.wholesale_price || "").trim()
          const costPrice = String(normalized.cost || normalized.costprice || "").trim()
          const stock = String(
            normalized.initialstockqty || normalized.initial_stock_qty || normalized.stock || normalized.quantity || ""
          ).trim()
          const lowStockThreshold = String(normalized.lowstockthreshold || normalized.low_stock_threshold || "").trim()
          const batchExpiryDate = String(normalized.batchexpirydate || normalized.batch_expiry_date || "").trim()
          const description = String(normalized.description || "").trim()
          const isActive = String(normalized.isactive || normalized.is_active || "").trim()

          return {
            rowNumber: index + 2,
            productName,
            sku,
            barcode,
            category,
            retailPrice,
            wholesalePrice,
            costPrice,
            stock,
            lowStockThreshold,
            batchExpiryDate,
            description,
            isActive,
          }
        })

        const filteredRows = mappedRows.filter((row) => row.productName || row.sku || row.barcode)
        resolve(filteredRows)
      } catch (error: any) {
        reject(new Error(error?.message || "Failed to parse file."))
      }
    }

    reader.onerror = () => reject(new Error("Failed to read selected file."))
    reader.readAsArrayBuffer(file)
  })
}

function ProductsImportPageContent() {
  const { toast } = useToast()
  const router = useRouter()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { outlets, currentOutlet: tenantOutlet } = useTenant()
  const searchParams = useSearchParams()

  const defaultOutletId = String(tenantOutlet?.id || currentOutlet?.id || "")
  const modeParam = String(searchParams?.get('mode') || '').trim().toLowerCase()
  const isSyncMode = modeParam === 'sync' || modeParam === 'inventory_sync'
  const importMode = isSyncMode ? 'inventory_sync' : 'products'
  const historyModeParam = isSyncMode ? 'sync' : 'products'
  const requestedBatchId = String(searchParams?.get('batchId') || "")
  const pageTitle = isSyncMode ? "Product & Inventory Sync" : "Import Products"
  const pageDescription = isSyncMode
    ? "Preview, reconcile, and apply product data with inventory adjustments and audit history."
    : "Preview, approve, and safely apply product imports with full rejection visibility. New products are added to your existing catalog."
  const uploadTabLabel = isSyncMode ? "Upload & Preview Sync" : "Upload & Preview"
  const summaryTabLabel = isSyncMode ? "Sync Summary" : "Import Summary"
  const historyTabLabel = isSyncMode ? "Processes" : "Import History"

  const [selectedOutletId, setSelectedOutletId] = useState<string>(defaultOutletId)
  const [selectedSyncStrategy, setSelectedSyncStrategy] = useState<SyncStrategyValue>("full_sync")
  const [file, setFile] = useState<File | null>(null)
  const [batchId, setBatchId] = useState<string>("")
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null)
  const [previewErrors, setPreviewErrors] = useState<PreviewErrorRow[]>([])
  const [applyErrors, setApplyErrors] = useState<ApplyErrorRow[]>([])
  const [importRows, setImportRows] = useState<ImportedProductRow[]>([])
  const [batchRows, setBatchRows] = useState<ImportBatchRow[]>([])
  const [chunkSize, setChunkSize] = useState<number>(100)
  const [continueOnError, setContinueOnError] = useState<boolean>(true)
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false)
  const [detailPage, setDetailPage] = useState<number>(1)
  const [rejectedPage, setRejectedPage] = useState<number>(1)
  const [detailSearchTerm, setDetailSearchTerm] = useState<string>("")
  const [historyRows, setHistoryRows] = useState<ImportHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState<boolean>(false)
  const [historyCount, setHistoryCount] = useState<number>(0)
  const [historyPage, setHistoryPage] = useState<number>(1)
  const [historyTotalPages, setHistoryTotalPages] = useState<number>(1)
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all")
  const [historySearchTerm, setHistorySearchTerm] = useState<string>("")
  const [historyDatePreset, setHistoryDatePreset] = useState<string>("all")
  const [historyDateFrom, setHistoryDateFrom] = useState<string>("")
  const [historyDateTo, setHistoryDateTo] = useState<string>("")
  const [loadingAction, setLoadingAction] = useState<"" | "preview" | "approve" | "apply" | "refresh" | "rescan" | "recover" | "rollback_preview" | "rollback_execute" | "cancel_sync">("")
  const [activeTab, setActiveTab] = useState("upload-preview")
  const [missingProducts, setMissingProducts] = useState<MissingCatalogProduct[]>([])
  const [missingLoading, setMissingLoading] = useState(false)
  const [missingSearchTerm, setMissingSearchTerm] = useState("")
  const [archivingProductId, setArchivingProductId] = useState("")
  const [newProductsPage, setNewProductsPage] = useState(1)
  const [missingProductsPage, setMissingProductsPage] = useState(1)
  const [archivingAllMissing, setArchivingAllMissing] = useState(false)
  const [showArchiveAllDialog, setShowArchiveAllDialog] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createdRowNumbers, setCreatedRowNumbers] = useState<Set<number>>(new Set())
  const [showEditRowDialog, setShowEditRowDialog] = useState(false)
  const [editRowSubmitting, setEditRowSubmitting] = useState(false)
  const [editRowDraft, setEditRowDraft] = useState<EditImportRowDraft>({
    rowNumber: 0,
    productName: "",
    sku: "",
    barcode: "",
    category: "",
    retailPrice: "",
    costPrice: "",
    stock: "",
  })
  const [createDraft, setCreateDraft] = useState<CreateProductDraft>({
    rowNumber: 0,
    productName: "",
    sku: "",
    barcode: "",
    category: "",
    retailPrice: "",
    wholesalePrice: "",
    costPrice: "",
    stock: "0",
    lowStockThreshold: "0",
    description: "",
    isActive: true,
  })
  const lastRestoredBatchRef = useRef<string>("")
  const requestMode = isSyncMode ? importMode : undefined
  const requestSyncStrategy = isSyncMode ? selectedSyncStrategy : undefined

  const summary = useMemo(() => {
    const preview = batchStatus?.preview_summary || {}
    return {
      totalRows: preview.total_rows ?? batchStatus?.total_rows ?? 0,
      validRows: preview.valid_rows ?? batchStatus?.valid_rows ?? 0,
      invalidRows: preview.invalid_rows ?? batchStatus?.invalid_rows ?? 0,
      warningRows: preview.warning_rows ?? batchStatus?.warning_rows ?? 0,
      importedRows: batchStatus?.apply_summary?.imported ?? 0,
      failedRows: batchStatus?.apply_summary?.failed ?? 0,
    }
  }, [batchStatus])

  const summaryRows = useMemo(
    () => {
      if (isSyncMode) {
        const applySummary = batchStatus?.apply_summary || {}
        const syncStrategy =
          batchStatus?.sync_strategy ||
          batchStatus?.preview_summary?.sync_strategy ||
          batchStatus?.apply_summary?.sync_strategy ||
          selectedSyncStrategy
        return [
          { label: "Batch ID", value: batchId || "-" },
          { label: "Status", value: batchStatus?.status || "-" },
          { label: "Sync Strategy", value: SYNC_STRATEGY_LABELS[syncStrategy] || syncStrategy },
          { label: "Approved", value: batchStatus?.is_approved ? "Yes" : "No" },
          { label: "Total Rows", value: String(summary.totalRows) },
          { label: "Valid Rows", value: String(summary.validRows) },
          { label: "Invalid Rows", value: String(summary.invalidRows) },
          { label: "Products Updated", value: String(applySummary.products_updated ?? 0) },
          { label: "New Products Created", value: String(applySummary.new_products_created ?? 0) },
          { label: "Stock Increases", value: String(applySummary.stock_increases ?? 0) },
          { label: "Stock Decreases", value: String(applySummary.stock_decreases ?? 0) },
          { label: "Prices Changed", value: String(applySummary.prices_changed ?? 0) },
          { label: "Skipped By Strategy", value: String(applySummary.skipped_by_strategy ?? 0) },
          { label: "Errors", value: String(applySummary.errors ?? summary.failedRows) },
        ]
      }

      return [
        { label: "Batch ID", value: batchId || "-" },
        { label: "Status", value: batchStatus?.status || "-" },
        { label: "Approved", value: batchStatus?.is_approved ? "Yes" : "No" },
        { label: "Total Rows", value: String(summary.totalRows) },
        { label: "Valid Rows", value: String(summary.validRows) },
        { label: "Invalid Rows", value: String(summary.invalidRows) },
        { label: "Warning Rows", value: String(summary.warningRows) },
        { label: "Imported Rows", value: String(summary.importedRows) },
        { label: "Failed Rows", value: String(summary.failedRows) },
      ]
    },
    [batchId, batchStatus?.status, batchStatus?.is_approved, batchStatus?.sync_strategy, batchStatus?.preview_summary?.sync_strategy, batchStatus?.apply_summary, summary, isSyncMode, selectedSyncStrategy]
  )

  const importTabs: TabConfig[] = useMemo(
    () => [
      {
        value: "upload-preview",
        label: uploadTabLabel,
        icon: Upload,
      },
      {
        value: "import-summary",
        label: summaryTabLabel,
        icon: CheckCircle2,
      },
      ...(isSyncMode
        ? [{
            value: "new-products",
            label: "New Products",
            icon: Plus,
            badgeCount: batchRows.filter((row) => row.action === "create").length,
            badgeVariant: "secondary" as const,
          }, {
            value: "not-in-file",
            label: "Not In File",
            icon: Archive,
            badgeCount: missingProducts.length,
            badgeVariant: "secondary" as const,
          }]
        : []),
      {
        value: "rejected-products",
        label: "Rejected Products",
        icon: XCircle,
        badgeCount: previewErrors.length + applyErrors.length,
        badgeVariant: "destructive",
      },
      {
        value: "import-history",
        label: historyTabLabel,
        icon: CheckCircle2,
      },
    ],
    [previewErrors.length, applyErrors.length, uploadTabLabel, summaryTabLabel, historyTabLabel, isSyncMode, batchRows, missingProducts.length]
  )

  const getRawValue = (rawData: Record<string, any> | undefined, keys: string[]) => {
    if (!rawData) return ""
    for (const key of keys) {
      const value = rawData[key]
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value)
      }
    }
    return ""
  }

  const rejectedRows = useMemo<RejectedTableRow[]>(() => {
    const previewRows: RejectedTableRow[] = previewErrors.map((row) => ({
      phase: "Preview",
      rowNumber: row.row_number,
      productName:
        getRawValue(row.raw_data, ["name", "product_name", "product", "item_name"]) || "-",
      sku: getRawValue(row.raw_data, ["sku", "code", "product_code"]) || "-",
      barcode: getRawValue(row.raw_data, ["barcode", "bar_code"]) || "-",
      reason: row.errors.join(", "),
      rawData: row.raw_data,
    }))

    const applyRows: RejectedTableRow[] = applyErrors.map((row) => ({
      phase: "Apply",
      rowNumber: row.row_number,
      productName:
        getRawValue(row.raw_data, ["name", "product_name", "product", "item_name"]) || "-",
      sku: getRawValue(row.raw_data, ["sku", "code", "product_code"]) || "-",
      barcode: getRawValue(row.raw_data, ["barcode", "bar_code"]) || "-",
      reason: `${row.message}${row.error_code ? ` (${row.error_code})` : ""}`,
      rawData: row.raw_data,
    }))

    return [...previewRows, ...applyRows]
  }, [previewErrors, applyErrors])

  const totalRejectedPages = useMemo(
    () => Math.max(1, Math.ceil(rejectedRows.length / PAGE_SIZE)),
    [rejectedRows.length]
  )

  const paginatedRejectedRows = useMemo(() => {
    const start = (rejectedPage - 1) * PAGE_SIZE
    return rejectedRows.slice(start, start + PAGE_SIZE)
  }, [rejectedRows, rejectedPage])

  const newProductRows = useMemo(() => {
    if (!isSyncMode) return []

    return batchRows.filter((row) => row.action === "create")
  }, [batchRows, isSyncMode])

  const totalNewProductsPages = useMemo(
    () => Math.max(1, Math.ceil(newProductRows.length / PAGE_SIZE)),
    [newProductRows.length]
  )

  const paginatedNewProductRows = useMemo(() => {
    const start = (newProductsPage - 1) * PAGE_SIZE
    return newProductRows.slice(start, start + PAGE_SIZE)
  }, [newProductRows, newProductsPage])

  const previewErrorMap = useMemo(() => {
    const map = new Map<number, string>()
    previewErrors.forEach((row) => {
      map.set(row.row_number, row.errors.join(", "))
    })
    return map
  }, [previewErrors])

  const applyErrorMap = useMemo(() => {
    const map = new Map<number, string>()
    applyErrors.forEach((row) => {
      map.set(row.row_number, `${row.message}${row.error_code ? ` (${row.error_code})` : ""}`)
    })
    return map
  }, [applyErrors])

  const productDetailRows = useMemo<ProductDetailRow[]>(() => {
    return importRows.map((row) => {
      const previewIssue = previewErrorMap.get(row.rowNumber)
      const applyIssue = applyErrorMap.get(row.rowNumber)

      if (previewIssue) {
        return { ...row, status: "Invalid", issue: previewIssue }
      }

      if (applyIssue) {
        return { ...row, status: "Failed", issue: applyIssue }
      }

      if (batchStatus?.status === "applied") {
        return { ...row, status: "Imported", issue: "-" }
      }

      if (batchStatus?.is_approved) {
        return { ...row, status: "Ready", issue: "Ready for apply" }
      }

      return { ...row, status: "Pending", issue: "Awaiting preview/approval" }
    })
  }, [importRows, previewErrorMap, applyErrorMap, batchStatus?.status, batchStatus?.is_approved])

  const filteredDetailRows = useMemo(() => {
    const term = detailSearchTerm.trim().toLowerCase()
    if (!term) return productDetailRows

    return productDetailRows.filter((row) =>
      row.productName.toLowerCase().includes(term) ||
      row.sku.toLowerCase().includes(term) ||
      row.barcode.toLowerCase().includes(term)
    )
  }, [productDetailRows, detailSearchTerm])

  const totalDetailPages = Math.max(1, Math.ceil(filteredDetailRows.length / PAGE_SIZE))
  const detailPageRows = useMemo(() => {
    const start = (detailPage - 1) * PAGE_SIZE
    return filteredDetailRows.slice(start, start + PAGE_SIZE)
  }, [filteredDetailRows, detailPage])

  useEffect(() => {
    setDetailPage(1)
  }, [batchId, importRows.length, detailSearchTerm, batchRows.length])

  useEffect(() => {
    setDetailPage((prev) => Math.min(prev, totalDetailPages))
  }, [totalDetailPages])

  useEffect(() => {
    setRejectedPage(1)
  }, [batchId, rejectedRows.length])

  useEffect(() => {
    setRejectedPage((prev) => Math.min(prev, totalRejectedPages))
  }, [totalRejectedPages])

  useEffect(() => {
    setNewProductsPage(1)
  }, [batchId, newProductRows.length])

  useEffect(() => {
    setNewProductsPage((prev) => Math.min(prev, totalNewProductsPages))
  }, [totalNewProductsPages])

  useEffect(() => {
    setMissingProductsPage(1)
  }, [batchId, missingSearchTerm, missingProducts.length])

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

    setFile(selected)
    setBatchId("")
    setBatchStatus(null)
    setPreviewErrors([])
    setApplyErrors([])

    setIsParsingFile(true)
    try {
      const parsedRows = await parseImportRows(selected)
      setImportRows(parsedRows)
    } catch (error: any) {
      setImportRows([])
      toast({
        title: "Read Failed",
        description: error?.message || "Failed to read product rows from file.",
        variant: "destructive",
      })
    } finally {
      setIsParsingFile(false)
    }
  }

  const handleDownloadOutletProducts = async () => {
    if (!selectedOutletId) {
      toast({
        title: "Outlet Required",
        description: "Select an outlet before downloading products.",
        variant: "destructive",
      })
      return
    }

    try {
      const exported = await productService.export({
        format: "csv",
        outlet_id: selectedOutletId,
        include_inactive: true,
        include_stock: true,
        include_batches: true,
        include_units: true,
      })

      const link = document.createElement("a")
      link.href = exported.url
      link.download = exported.filename || `outlet-${selectedOutletId}-products.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(exported.url)

      toast({
        title: "Download Started",
        description: "Full outlet products file is being downloaded.",
      })
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error?.message || "Unable to download outlet products file.",
        variant: "destructive",
      })
    }
  }

  const loadBatchRows = useCallback(async (targetBatchId: string) => {
    const collectedRows: ImportBatchRow[] = []
    let currentPage = 1
    let totalPages = 1

    do {
      const response = await productService.getImportRows(targetBatchId, {
        page: currentPage,
        pageSize: 100,
        mode: requestMode,
        syncStrategy: requestSyncStrategy,
      })

      collectedRows.push(...(response.results || []))
      totalPages = response.total_pages || 1
      currentPage += 1
    } while (currentPage <= totalPages)

    setBatchRows(collectedRows)
    return collectedRows
  }, [requestMode, requestSyncStrategy])

  const loadMissingProducts = useCallback(async (targetBatchId: string) => {
    setMissingLoading(true)
    try {
      const response = await productService.getImportMissingProducts(targetBatchId, {
        page: 1,
        pageSize: 500,
        mode: requestMode,
        syncStrategy: requestSyncStrategy,
      })
      setMissingProducts(response.results || [])
    } catch {
      setMissingProducts([])
    } finally {
      setMissingLoading(false)
    }
  }, [requestMode, requestSyncStrategy])

  const loadCategories = useCallback(async () => {
    try {
      const categoryList = await productService.getCategories({
        outlet: selectedOutletId || undefined,
        limit: 500,
      })
      setCategoryOptions(categoryList.map((category) => ({ id: String(category.id), name: category.name })))
    } catch {
      setCategoryOptions([])
    }
  }, [selectedOutletId])

  const refreshBatch = useCallback(async (targetBatchId: string) => {
    setLoadingAction("refresh")
    try {
      let statusPayload: any
      let errorsPayload: any

      try {
        ;[statusPayload, errorsPayload] = await Promise.all([
          productService.getImportStatus(targetBatchId, requestMode, requestSyncStrategy),
          productService.getImportErrors(targetBatchId, requestMode, requestSyncStrategy),
        ])
      } catch (initialError: any) {
        const isBatchNotFound =
          initialError?.status === 404 &&
          String(initialError?.message || "").toLowerCase().includes("import batch not found")

        if (isBatchNotFound && requestMode) {
          // Fallback for legacy links or stale mode filters: try unscoped batch lookup once.
          ;[statusPayload, errorsPayload] = await Promise.all([
            productService.getImportStatus(targetBatchId),
            productService.getImportErrors(targetBatchId),
          ])
        } else {
          throw initialError
        }
      }

      setBatchStatus(statusPayload)
      if (isSyncMode && statusPayload?.sync_strategy) {
        setSelectedSyncStrategy(statusPayload.sync_strategy)
      }
      setPreviewErrors(errorsPayload.preview_errors || [])
      setApplyErrors(errorsPayload.apply_errors || [])
      const loadedRows = await loadBatchRows(targetBatchId)
      if (loadedRows.length > 0) {
        setImportRows(mapBatchRowsToImportedRows(loadedRows))
      }

      if (isSyncMode) {
        await loadMissingProducts(targetBatchId)
      } else {
        setMissingProducts([])
      }
    } catch (error: any) {
      const isBatchNotFound =
        error?.status === 404 &&
        String(error?.message || "").toLowerCase().includes("import batch not found")

      if (isBatchNotFound) {
        setBatchId("")
        setBatchStatus(null)
        setPreviewErrors([])
        setApplyErrors([])
        setBatchRows([])
        const basePath = isSyncMode
          ? "/dashboard/inventory/products/import?mode=sync"
          : "/dashboard/inventory/products/import"
        router.replace(basePath)
      }

      toast({
        title: isBatchNotFound ? "Batch Not Found" : "Status Load Failed",
        description: isBatchNotFound
          ? "This batch does not exist in the current environment. Start a new preview or open a valid batch from history."
          : error?.message || "Failed to load import status.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction("")
    }
  }, [isSyncMode, loadBatchRows, loadMissingProducts, requestMode, requestSyncStrategy, router, toast])

  const archiveMissingProduct = async (product: MissingCatalogProduct) => {
    if (!product.id) return

    setArchivingProductId(product.id)
    try {
      await productService.archiveProduct(product.id)
      setMissingProducts((prev) => prev.filter((item) => item.id !== product.id))
      toast({
        title: "Product Archived",
        description: `${product.name || "Product"} has been archived.`,
      })
    } catch (error: any) {
      toast({
        title: "Archive Failed",
        description: error?.message || "Unable to archive this product.",
        variant: "destructive",
      })
    } finally {
      setArchivingProductId("")
    }
  }

  const archiveAllMissingProducts = async () => {
    if (filteredMissingProducts.length === 0) return

    setArchivingAllMissing(true)
    try {
      const productIds = filteredMissingProducts.map((product) => String(product.id))
      const response = await productService.bulkDelete(productIds)

      setMissingProducts((prev) =>
        prev.filter((item) => !productIds.includes(String(item.id)))
      )

      const archivedCount = response.archived_count || 0
      const deletedCount = response.deleted_count || 0
      toast({
        title: "Products Archived",
        description:
          deletedCount > 0
            ? `${archivedCount} archived, ${deletedCount} deleted from the filtered list.`
            : `${archivedCount} products archived from the filtered list.`,
      })
    } catch (error: any) {
      toast({
        title: "Archive All Failed",
        description: error?.message || "Unable to archive missing products.",
        variant: "destructive",
      })
    } finally {
      setArchivingAllMissing(false)
    }
  }

  const filteredMissingProducts = useMemo(() => {
    const term = missingSearchTerm.trim().toLowerCase()
    if (!term) return missingProducts

    return missingProducts.filter((row) => {
      return [row.name, row.sku, row.barcode, row.category].join(" ").toLowerCase().includes(term)
    })
  }, [missingProducts, missingSearchTerm])

  const totalMissingProductsPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMissingProducts.length / PAGE_SIZE)),
    [filteredMissingProducts.length]
  )

  const paginatedMissingProducts = useMemo(() => {
    const start = (missingProductsPage - 1) * PAGE_SIZE
    return filteredMissingProducts.slice(start, start + PAGE_SIZE)
  }, [filteredMissingProducts, missingProductsPage])

  useEffect(() => {
    setMissingProductsPage((prev) => Math.min(prev, totalMissingProductsPages))
  }, [totalMissingProductsPages])

  const loadImportHistory = useCallback(async (pageOverride?: number) => {
    const targetPage = pageOverride || historyPage
    setHistoryLoading(true)
    try {
      const today = new Date()
      const toDate = (date: Date) => date.toISOString().slice(0, 10)

      let dateFrom: string | undefined
      let dateTo: string | undefined

      if (historyDatePreset === "today") {
        const d = toDate(today)
        dateFrom = d
        dateTo = d
      } else if (historyDatePreset === "last7") {
        const from = new Date(today)
        from.setDate(today.getDate() - 6)
        dateFrom = toDate(from)
        dateTo = toDate(today)
      } else if (historyDatePreset === "last30") {
        const from = new Date(today)
        from.setDate(today.getDate() - 29)
        dateFrom = toDate(from)
        dateTo = toDate(today)
      } else if (historyDatePreset === "custom") {
        dateFrom = historyDateFrom || undefined
        dateTo = historyDateTo || undefined
      }

      const payload = await productService.getImportHistory({
        outletId: selectedOutletId || undefined,
        status: historyStatusFilter !== "all" ? historyStatusFilter : undefined,
        search: historySearchTerm,
        dateFrom,
        dateTo,
        mode: requestMode,
        syncStrategy: requestSyncStrategy,
        page: targetPage,
        pageSize: 10,
      })

      const normalizedHistoryRows: ImportHistoryRow[] = (payload.results || []).map((row) => ({
        ...row,
        sync_strategy: isSyncStrategyValue(row.sync_strategy) ? row.sync_strategy : undefined,
      }))

      setHistoryRows(normalizedHistoryRows)
      setHistoryCount(payload.count || 0)
      setHistoryPage(payload.page || targetPage)
      setHistoryTotalPages(payload.total_pages || 1)
    } catch (error: any) {
      toast({
        title: "History Load Failed",
        description: error?.message || "Unable to load import history.",
        variant: "destructive",
      })
    } finally {
      setHistoryLoading(false)
    }
  }, [historyPage, historyStatusFilter, historySearchTerm, historyDatePreset, historyDateFrom, historyDateTo, selectedOutletId, toast, requestMode, requestSyncStrategy])

  const formatDateTime = (value?: string) => {
    if (!value) return "-"
    try {
      return new Date(value).toLocaleString()
    } catch {
      return value
    }
  }

  useEffect(() => {
    if (activeTab !== "import-history") return
    loadImportHistory(1)
  }, [activeTab, loadImportHistory])

  useEffect(() => {
    if (!requestedBatchId) return
    if (lastRestoredBatchRef.current === requestedBatchId) return

    const restoreBatchFromQuery = async () => {
      lastRestoredBatchRef.current = requestedBatchId
      setBatchId(requestedBatchId)
      await refreshBatch(requestedBatchId)
      setActiveTab("import-summary")
    }

    void restoreBatchFromQuery()
  }, [requestedBatchId, refreshBatch])

  useEffect(() => {
    if (!isSyncMode) return
    loadCategories()
  }, [isSyncMode, loadCategories])

  useEffect(() => {
    setHistoryPage(1)
  }, [historyStatusFilter, historySearchTerm, historyDatePreset, historyDateFrom, historyDateTo, selectedOutletId])

  const handlePreview = async () => {
    if (!file) {
      toast({
        title: "No File",
        description: "Select a file before preview.",
        variant: "destructive",
      })
      return
    }

    if (!selectedOutletId) {
      toast({
        title: "Outlet Required",
        description: "Select an outlet before preview.",
        variant: "destructive",
      })
      return
    }

    setLoadingAction("preview")
    try {
      const idempotencyKey = `preview-${importMode}-${selectedOutletId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const preview = await productService.previewImport(file, selectedOutletId, idempotencyKey, importMode, selectedSyncStrategy)
      setBatchId(preview.batch_id)

      await refreshBatch(preview.batch_id)
      await loadImportHistory(1)
      setActiveTab("import-summary")

      toast({
        title: "Preview Ready",
        description: `${preview.summary.valid_rows}/${preview.summary.total_rows} rows are valid.`,
      })
    } catch (error: any) {
      toast({
        title: "Preview Failed",
        description: error?.message || "Unable to create preview.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction("")
    }
  }

  const handleApprove = async () => {
    if (!batchId) return

    if (batchStatus?.status === "applied") {
      toast({
        title: "Already Applied",
        description: "This batch is already applied.",
      })
      return
    }

    setLoadingAction("approve")
    try {
      await productService.approveImport(batchId)
      await refreshBatch(batchId)
      await loadImportHistory(1)
      setActiveTab("import-summary")
      toast({
        title: "Approved",
        description: "Batch approved. You can apply now.",
      })
    } catch (error: any) {
      if (
        error?.status === 409 &&
        String(error?.message || "").toLowerCase().includes("status: applied")
      ) {
        await refreshBatch(batchId)
        toast({
          title: "Already Applied",
          description: "This batch was already applied.",
        })
        return
      }

      toast({
        title: "Approval Failed",
        description: error?.message || "Unable to approve batch.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction("")
    }
  }

  const handleApply = async () => {
    if (!batchId) return

    setLoadingAction("apply")
    try {
      if (!batchStatus?.is_approved) {
        await productService.approveImport(batchId)
      }

      const applyKey = `apply-${importMode}-${batchId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      await productService.applyImportWithOptions(batchId, {
        chunkSize,
        continueOnError,
        idempotencyKey: applyKey,
        mode: requestMode,
        syncStrategy: requestSyncStrategy,
      })

      await refreshBatch(batchId)
      await loadImportHistory(1)
      setActiveTab("rejected-products")

      toast({
        title: "Apply Completed",
        description: "Batch apply completed. Review summary and rejected rows below.",
      })
    } catch (error: any) {
      toast({
        title: "Apply Failed",
        description: error?.message || "Unable to apply batch.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction("")
    }
  }

  const handleResumeFromHistory = async (row: ImportHistoryRow) => {
    setLoadingAction("refresh")
    try {
      if (row.outlet?.id) {
        setSelectedOutletId(String(row.outlet.id))
      }
      if (isSyncMode && row.sync_strategy) {
        setSelectedSyncStrategy(row.sync_strategy)
      }

      setBatchId(row.batch_id)
      await refreshBatch(row.batch_id)
      setActiveTab("import-summary")

      toast({
        title: "Batch Loaded",
        description:
          row.status === "applied"
            ? "This sync is already applied. Review summary details."
            : "You can now continue this sync from summary, approval, and apply steps.",
      })
    } catch (error: any) {
      toast({
        title: "Load Failed",
        description: error?.message || "Unable to load this sync batch.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction("")
    }
  }

  const handleRecoverFromHistory = async (row: ImportHistoryRow) => {
    setLoadingAction("recover")
    try {
      if (row.outlet?.id) {
        setSelectedOutletId(String(row.outlet.id))
      }
      if (isSyncMode && row.sync_strategy) {
        setSelectedSyncStrategy(row.sync_strategy)
      }

      const recovery = await productService.recoverImport(row.batch_id, {
        mode: requestMode,
        syncStrategy: row.sync_strategy || requestSyncStrategy,
        restorePreviousState: false,
        autoApply: false,
        deleteSourceBatch: false,
      })

      setBatchId(recovery.batch_id)
      if (isSyncMode && isSyncStrategyValue(recovery.sync_strategy)) {
        setSelectedSyncStrategy(recovery.sync_strategy)
      }

      await refreshBatch(recovery.batch_id)
      await loadImportHistory(1)
      setActiveTab("import-summary")

      toast({
        title: "Recovery Ready For Re-Approval",
        description: "Previous state is staged. Approve Process and then Run Sync when you are ready.",
      })
    } catch (error: any) {
      toast({
        title: "Recovery Failed",
        description: error?.message || "Unable to create a recovery batch.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction("")
    }
  }

  const handleCancelSync = async () => {
    if (!batchId) return

    if (batchStatus?.status === "applying") {
      toast({
        title: "Sync In Progress",
        description: "Wait for the current apply process to finish before cancelling.",
        variant: "destructive",
      })
      return
    }

    if (batchStatus?.status === "applied" && isSyncMode) {
      setLoadingAction("cancel_sync")
      try {
        const preview = await productService.rollbackImportPreview(batchId, { mode: requestMode })
        if (!preview.can_rollback) {
          toast({
            title: "Cancel Not Allowed",
            description: preview.detail || "This applied sync cannot be reversed safely.",
            variant: "destructive",
          })
          return
        }

        const confirmed = window.confirm(
          `Cancel this applied sync and reverse stock changes?\n\nRows: ${preview.summary.rows}\nProducts: ${preview.summary.products}\nNet Delta: ${preview.summary.net_delta}`
        )
        if (!confirmed) return

        const rollbackKey = `cancel-sync-${batchId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        await productService.rollbackImport(batchId, {
          mode: requestMode,
          idempotencyKey: rollbackKey,
        })

        await refreshBatch(batchId)
        setHistoryStatusFilter("cancelled")
        setHistorySearchTerm(batchId)
        await loadImportHistory(1)
        setActiveTab("import-history")

        toast({
          title: "Sync Cancelled",
          description: "Applied sync was cancelled and reversed. Check Process History for confirmation.",
        })
      } catch (error: any) {
        toast({
          title: "Cancel Sync Failed",
          description: error?.message || "Unable to cancel this applied sync.",
          variant: "destructive",
        })
      } finally {
        setLoadingAction("")
      }
      return
    }

    const confirmed = window.confirm(
      "Cancel current sync process? This will mark the batch as Cancelled in sync history."
    )
    if (!confirmed) return

    setLoadingAction("cancel_sync")
    try {
      await productService.cancelImport(batchId, { mode: requestMode })
      await refreshBatch(batchId)
      setHistoryStatusFilter("cancelled")
      setHistorySearchTerm(batchId)
      await loadImportHistory(1)
      setActiveTab("import-history")

      toast({
        title: "Sync Cancelled",
        description: "Batch was marked as Cancelled. Check Process History for confirmation.",
      })
    } catch (error: any) {
      toast({
        title: "Cancel Sync Failed",
        description: error?.message || "Unable to cancel this sync batch.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction("")
    }
  }

  const handleRollbackFromHistory = async (row: ImportHistoryRow) => {
    if (!isSyncMode) return
    if (!row?.batch_id) return

    setLoadingAction("rollback_preview")
    try {
      const preview = await productService.rollbackImportPreview(row.batch_id, {
        mode: requestMode,
      })

      if (!preview.can_rollback) {
        toast({
          title: "Rollback Not Allowed",
          description:
            preview.detail ||
            `Rollback cannot continue. ${preview.summary?.would_be_negative || 0} product(s) would go negative.`,
          variant: "destructive",
        })
        return
      }

      const confirmed = window.confirm(
        `Reverse this sync batch?\n\nRows: ${preview.summary.rows}\nProducts: ${preview.summary.products}\nNet Delta: ${preview.summary.net_delta}`
      )
      if (!confirmed) return

      setLoadingAction("rollback_execute")
      const rollbackKey = `rollback-${row.batch_id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      await productService.rollbackImport(row.batch_id, {
        mode: requestMode,
        idempotencyKey: rollbackKey,
      })

      await loadImportHistory(1)
      if (batchId === row.batch_id) {
        await refreshBatch(row.batch_id)
      }

      toast({
        title: "Sync Reversed",
        description: "Stock deltas from this sync were reversed successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Rollback Failed",
        description: error?.message || "Unable to reverse this sync batch.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction("")
    }
  }

  const handleDownloadBatchSource = async (targetBatchId?: string) => {
    const batchToDownload = targetBatchId || batchId
    if (!batchToDownload) {
      toast({
        title: "Batch Required",
        description: "Select an import batch before downloading source file.",
        variant: "destructive",
      })
      return
    }

    try {
      const source = await productService.downloadImportSource(batchToDownload, {
        mode: requestMode,
        syncStrategy: requestSyncStrategy,
      })
      const link = document.createElement("a")
      link.href = source.url
      link.download = source.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(source.url)
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error?.message || "Unable to download this batch source file.",
        variant: "destructive",
      })
    }
  }

  const rescanBatchRows = useCallback(async (rowsToRescan: ImportRowUpdatePayload[]) => {
    if (!batchId) {
      return { rescanned: 0, failed: 0 }
    }

    const candidateRows = rowsToRescan.filter((row) => row.rowNumber > 0)
    if (candidateRows.length === 0) {
      return { rescanned: 0, failed: 0 }
    }

    const results = await Promise.allSettled(
      candidateRows.map((row) =>
        productService.updateImportRow(
          batchId,
          row.rowNumber,
          {
            product_name: row.productName,
            sku: row.sku,
            barcode: row.barcode,
            category: row.category,
            price: row.retailPrice,
            cost: row.costPrice,
            stock: row.stock,
            low_stock_threshold: row.lowStockThreshold,
            description: row.description,
            is_active: row.isActive === undefined ? undefined : row.isActive ? "yes" : "no",
          },
          {
            mode: requestMode,
            syncStrategy: requestSyncStrategy,
          }
        )
      )
    )

    const rescanned = results.filter((result) => result.status === "fulfilled").length
    const failed = results.length - rescanned

    return { rescanned, failed }
  }, [batchId, requestMode, requestSyncStrategy])

  const handleRescanNewProducts = async () => {
    if (!batchId || newProductRows.length === 0) return

    setLoadingAction("rescan")
    try {
      const { rescanned, failed } = await rescanBatchRows(
        newProductRows.map((row) => ({
          rowNumber: row.row_number,
          productName: cleanBatchValue(row.product_name),
          sku: cleanBatchValue(row.sku),
          barcode: cleanBatchValue(row.barcode),
          category: cleanBatchValue(row.category),
          retailPrice: cleanBatchValue(row.price),
          costPrice: cleanBatchValue(row.cost),
          stock: cleanBatchValue(row.stock),
        }))
      )

      await refreshBatch(batchId)

      toast({
        title: failed > 0 ? "Rescan Completed With Warnings" : "Rescan Completed",
        description:
          failed > 0
            ? `${rescanned} row(s) revalidated, ${failed} row(s) could not be rescanned.`
            : `${rescanned} row(s) revalidated. Review New Products and Summary for updates.`,
        variant: failed > 0 ? "destructive" : undefined,
      })
    } catch (error: any) {
      toast({
        title: "Rescan Failed",
        description: error?.message || "Unable to rescan new products.",
        variant: "destructive",
      })
    } finally {
      setLoadingAction("")
    }
  }

  const openEditRowDialog = (row: ProductDetailRow) => {
    setEditRowDraft({
      rowNumber: row.rowNumber,
      productName: row.productName,
      sku: row.sku,
      barcode: row.barcode,
      category: row.category,
      retailPrice: row.retailPrice,
      costPrice: row.costPrice,
      stock: row.stock,
    })
    setShowEditRowDialog(true)
  }

  const openRejectedRowEditDialog = (row: RejectedTableRow) => {
    openEditRowDialog({
      rowNumber: row.rowNumber,
      productName: getRawValue(row.rawData, ["name", "product_name", "product", "item_name"]) || row.productName,
      sku: getRawValue(row.rawData, ["sku", "code", "product_code"]) || row.sku,
      barcode: getRawValue(row.rawData, ["barcode", "bar_code"]) || row.barcode,
      category: getRawValue(row.rawData, ["category", "category_name", "product_category"]),
      retailPrice: getRawValue(row.rawData, ["retail_price", "price", "sale_price"]),
      wholesalePrice: getRawValue(row.rawData, ["wholesale_price", "wholesale"]),
      costPrice: getRawValue(row.rawData, ["cost_price", "cost"]),
      stock: getRawValue(row.rawData, ["stock", "quantity", "opening_stock"]),
      lowStockThreshold: getRawValue(row.rawData, ["low_stock_threshold", "lowStockThreshold"]) || "0",
      batchExpiryDate: getRawValue(row.rawData, ["batch_expiry_date", "expiry_date", "expiry"]),
      description: getRawValue(row.rawData, ["description", "notes"]),
      isActive: getRawValue(row.rawData, ["is_active", "isActive"]) || "true",
      status: "Invalid",
      issue: row.reason,
    })
  }

  const saveEditedRow = async () => {
    if (!batchId || editRowDraft.rowNumber <= 0) return

    setEditRowSubmitting(true)
    try {
      await productService.updateImportRow(
        batchId,
        editRowDraft.rowNumber,
        {
          product_name: editRowDraft.productName,
          sku: editRowDraft.sku,
          barcode: editRowDraft.barcode,
          category: editRowDraft.category,
          price: editRowDraft.retailPrice,
          cost: editRowDraft.costPrice,
          stock: editRowDraft.stock,
        },
        {
          mode: requestMode,
          syncStrategy: requestSyncStrategy,
        }
      )

      await refreshBatch(batchId)
      setShowEditRowDialog(false)
      toast({
        title: "Row Updated",
        description: `Row ${editRowDraft.rowNumber} was updated. Review summary and continue when ready.`,
      })
    } catch (error: any) {
      toast({
        title: "Row Update Failed",
        description: error?.message || "Could not save row changes.",
        variant: "destructive",
      })
    } finally {
      setEditRowSubmitting(false)
    }
  }

  const openCreateDialog = (row: ImportBatchRow) => {
    setCreateDraft({
      rowNumber: row.row_number,
      productName: cleanBatchValue(row.product_name),
      sku: cleanBatchValue(row.sku),
      barcode: cleanBatchValue(row.barcode),
      category: cleanBatchValue(row.category),
      retailPrice: cleanBatchValue(row.price),
      wholesalePrice: "",
      costPrice: cleanBatchValue(row.cost),
      stock: cleanBatchValue(row.stock) || "0",
      lowStockThreshold: "0",
      description: "",
      isActive: true,
    })
    setShowCreateDialog(true)
  }

  const createProductFromDraft = async () => {
    const productName = createDraft.productName.trim()
    if (!productName) {
      toast({
        title: "Product Name Required",
        description: "Enter a product name before creating.",
        variant: "destructive",
      })
      return
    }

    const retailPrice = Number(createDraft.retailPrice)
    if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
      toast({
        title: "Retail Price Required",
        description: "Retail price must be greater than 0.",
        variant: "destructive",
      })
      return
    }

    if (!selectedOutletId) {
      toast({
        title: "Outlet Required",
        description: "Select an outlet before creating a product.",
        variant: "destructive",
      })
      return
    }

    const stock = Number(createDraft.stock || "0")
    const lowStockThreshold = Number(createDraft.lowStockThreshold || "0")
    const costPrice = createDraft.costPrice.trim() === "" ? undefined : Number(createDraft.costPrice)
    const wholesalePrice = createDraft.wholesalePrice.trim() === "" ? undefined : Number(createDraft.wholesalePrice)

    if (costPrice !== undefined && (!Number.isFinite(costPrice) || costPrice < 0)) {
      toast({
        title: "Invalid Cost Price",
        description: "Cost price must be a number greater than or equal to 0.",
        variant: "destructive",
      })
      return
    }

    if (wholesalePrice !== undefined && (!Number.isFinite(wholesalePrice) || wholesalePrice <= 0)) {
      toast({
        title: "Invalid Wholesale Price",
        description: "Wholesale price must be greater than 0 or left blank.",
        variant: "destructive",
      })
      return
    }

    const matchedCategory = categoryOptions.find(
      (category) => category.name.trim().toLowerCase() === createDraft.category.trim().toLowerCase()
    )

    const payload: any = {
      name: productName,
      sku: createDraft.sku.trim(),
      barcode: createDraft.barcode.trim(),
      retail_price: retailPrice,
      price: retailPrice,
      stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
      lowStockThreshold: Number.isFinite(lowStockThreshold) && lowStockThreshold >= 0 ? lowStockThreshold : 0,
      isActive: createDraft.isActive,
      outletId: selectedOutletId,
      description: createDraft.description.trim(),
    }

    if (costPrice !== undefined) {
      payload.cost = costPrice
    }

    if (wholesalePrice !== undefined) {
      payload.wholesale_enabled = true
      payload.wholesale_price = wholesalePrice
      payload.minimum_wholesale_quantity = 1
    } else {
      payload.wholesale_enabled = false
    }

    if (matchedCategory) {
      payload.categoryId = matchedCategory.id
    }

    setCreateSubmitting(true)
    try {
      await productService.create(payload)

      const rescanResult = await rescanBatchRows([{
        rowNumber: createDraft.rowNumber,
        productName: createDraft.productName,
        sku: createDraft.sku,
        barcode: createDraft.barcode,
        category: createDraft.category,
        retailPrice: createDraft.retailPrice,
        costPrice: createDraft.costPrice,
        stock: createDraft.stock,
        lowStockThreshold: createDraft.lowStockThreshold,
        description: createDraft.description,
        isActive: createDraft.isActive,
      }])

      if (batchId) {
        await refreshBatch(batchId)
      }

      setCreatedRowNumbers((prev) => {
        const next = new Set(prev)
        next.add(createDraft.rowNumber)
        return next
      })
      setShowCreateDialog(false)
      toast({
        title: rescanResult.failed > 0 ? "Product Created With Warning" : "Product Created",
        description:
          rescanResult.failed > 0
            ? `${productName} was created, but the sync row could not be rescanned automatically.`
            : `${productName} was created and the sync row was rescanned.`,
        variant: rescanResult.failed > 0 ? "destructive" : undefined,
      })
    } catch (error: any) {
      toast({
        title: "Create Failed",
        description: error?.message || "Could not create product from this row.",
        variant: "destructive",
      })
    } finally {
      setCreateSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={pageTitle}
        description={pageDescription}
        actions={
          <Button asChild variant="outline" className="border-gray-300">
            <Link href="/dashboard/inventory/products">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back To Products
            </Link>
          </Button>
        }
      >
        <FilterableTabs
          tabs={importTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          <TabsContent value="upload-preview" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>{uploadTabLabel}</CardTitle>
                <CardDescription>
                  {isSyncMode
                    ? "Use the same initial stock template, then preview product updates and inventory adjustments before processing."
                    : "Select outlet and file, then generate preview before any apply action."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Business</Label>
                    <div className="h-10 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700">
                      {currentBusiness?.name || "No business selected"}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Outlet</Label>
                    <Select value={selectedOutletId || ""} onValueChange={setSelectedOutletId}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Select outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        {outlets.map((outlet) => (
                          <SelectItem key={String(outlet.id)} value={String(outlet.id)}>
                            {outlet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isSyncMode ? (
                  <div className="space-y-2">
                    <Label>Sync Strategy</Label>
                    <Select value={selectedSyncStrategy} onValueChange={(value) => setSelectedSyncStrategy(value as SyncStrategyValue)}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Select sync strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        {INVENTORY_SYNC_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      {INVENTORY_SYNC_MODES.find((mode) => mode.value === selectedSyncStrategy)?.description}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label>Import File</Label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="block w-full rounded-md border border-gray-300 bg-white p-2 text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Download the current outlet product file, edit it, then upload it for preview and synchronization.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handlePreview} disabled={loadingAction !== "" || !file || !selectedOutletId}>
                    <Upload className="mr-2 h-4 w-4" />
                    {loadingAction === "preview" ? "Previewing..." : (isSyncMode ? "Preview Sync" : "Preview Import")}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-gray-300"
                    onClick={handleDownloadOutletProducts}
                    disabled={!selectedOutletId || loadingAction !== ""}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Outlet Products
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import-summary" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>{summaryTabLabel}</CardTitle>
                <CardDescription>
                  {isSyncMode
                    ? "Process status, row-by-row product checks, and sync outcome."
                    : "Batch status, approval, row-by-row product checks, and apply outcome."}
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

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" className="border-gray-300" onClick={() => batchId && refreshBatch(batchId)} disabled={!batchId || loadingAction !== ""}>
                    {loadingAction === "refresh" ? "Refreshing..." : (isSyncMode ? "Refresh Process" : "Refresh Status")}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-gray-300"
                    onClick={() => handleDownloadBatchSource()}
                    disabled={!batchId || loadingAction !== ""}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Source File
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="import-detail-search">Search Imported Products</Label>
                  <input
                    id="import-detail-search"
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
                        <TableHead className="w-32">Barcode</TableHead>
                        <TableHead className="w-28">Category</TableHead>
                        <TableHead className="w-24">Price</TableHead>
                        <TableHead className="w-24">Cost</TableHead>
                        <TableHead className="w-24">Stock</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead>Mismatch / Error</TableHead>
                        <TableHead className="w-24 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isParsingFile ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center text-sm text-gray-600">
                            Reading product rows...
                          </TableCell>
                        </TableRow>
                      ) : detailPageRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center text-sm text-gray-600">
                            {detailSearchTerm.trim()
                              ? "No matching products found for your search."
                              : "No products loaded yet. Upload a file to see all rows."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        detailPageRows.map((row) => (
                          <TableRow key={row.rowNumber}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>{row.productName || "-"}</TableCell>
                            <TableCell>{row.sku || "-"}</TableCell>
                            <TableCell>{row.barcode || "-"}</TableCell>
                            <TableCell>{row.category || "-"}</TableCell>
                            <TableCell>{row.retailPrice || "-"}</TableCell>
                            <TableCell>{row.costPrice || "-"}</TableCell>
                            <TableCell>{row.stock || "-"}</TableCell>
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
                            <TableCell>{row.issue}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => openEditRowDialog(row)}
                                disabled={!batchId || batchStatus?.status === "applied" || batchStatus?.status === "applying" || loadingAction !== ""}
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                Edit
                              </Button>
                            </TableCell>
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

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Chunk Size</Label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={chunkSize}
                      onChange={(e) => setChunkSize(Math.max(1, Math.min(1000, Number(e.target.value) || 100)))}
                      className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Continue On Chunk Error</Label>
                    <label className="flex h-10 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm">
                      <input
                        type="checkbox"
                        checked={continueOnError}
                        onChange={(e) => setContinueOnError(e.target.checked)}
                      />
                      Keep applying next chunks if one chunk fails
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-3">
                  <Button
                    variant="outline"
                    className="border-gray-300"
                    onClick={handleApprove}
                    disabled={!batchId || loadingAction !== "" || !!batchStatus?.is_approved || batchStatus?.status === "applied"}
                  >
                    {loadingAction === "approve" ? "Approving..." : (batchStatus?.is_approved ? "Approved" : (isSyncMode ? "Approve Process" : "Approve Batch"))}
                  </Button>
                  <Button
                    onClick={handleApply}
                    disabled={!batchId || loadingAction !== "" || batchStatus?.status === "applied"}
                  >
                    {loadingAction === "apply" ? "Applying..." : (isSyncMode ? "Run Sync" : "Apply Import")}
                  </Button>
                  {isSyncMode && (
                    <Button
                      variant="outline"
                      className="border-gray-300"
                      onClick={handleCancelSync}
                      disabled={!batchId || loadingAction !== ""}
                    >
                      {loadingAction === "cancel_sync" ? "Cancelling..." : "Cancel Sync"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rejected-products" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Rejected Products</CardTitle>
                <CardDescription>Readable product-level rejections from preview and apply phases. Use Edit to fill missing fields, revalidate, and move rows back into the import flow.</CardDescription>
              </CardHeader>
              <CardContent>
                {rejectedRows.length === 0 ? (
                  <p className="text-sm text-gray-600">No rejected products.</p>
                ) : (
                  <div className="rounded-md border border-gray-300">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Phase</TableHead>
                          <TableHead className="w-20">Row</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="w-36">SKU</TableHead>
                          <TableHead className="w-36">Barcode</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead className="w-24 text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRejectedRows.map((row, idx) => (
                          <TableRow key={`${row.phase}-${row.rowNumber}-${idx}`}>
                            <TableCell>{row.phase}</TableCell>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>{row.productName}</TableCell>
                            <TableCell>{row.sku}</TableCell>
                            <TableCell>{row.barcode}</TableCell>
                            <TableCell>{row.reason}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => openRejectedRowEditDialog(row)}
                                disabled={!batchId || batchStatus?.status === "applied" || batchStatus?.status === "applying" || loadingAction !== ""}
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {rejectedRows.length > PAGE_SIZE && (
                      <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-gray-600">
                          Showing {(rejectedPage - 1) * PAGE_SIZE + 1}-{Math.min(rejectedPage * PAGE_SIZE, rejectedRows.length)} of {rejectedRows.length}
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">Page {rejectedPage} of {totalRejectedPages}</span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRejectedPage((prev) => Math.max(1, prev - 1))}
                              disabled={rejectedPage === 1}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRejectedPage((prev) => Math.min(totalRejectedPages, prev + 1))}
                              disabled={rejectedPage === totalRejectedPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isSyncMode && (
            <TabsContent value="new-products" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>New Products</CardTitle>
                  <CardDescription>
                    Products found in the sync file that are not yet in the catalog and will be created or activated on apply.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-gray-600">
                      Re-scan after creating products manually so this batch can match them before apply.
                    </p>
                    <Button
                      variant="outline"
                      className="border-gray-300"
                      onClick={handleRescanNewProducts}
                      disabled={!batchId || newProductRows.length === 0 || loadingAction !== ""}
                    >
                      {loadingAction === "rescan" ? "Rescanning..." : "Rescan New Products"}
                    </Button>
                  </div>
                  {newProductRows.length === 0 ? (
                    <p className="text-sm text-gray-600">No new products detected yet.</p>
                  ) : (
                    <div className="rounded-md border border-gray-300 bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="w-16">Row</TableHead>
                            <TableHead>Product Name</TableHead>
                            <TableHead className="w-32">SKU</TableHead>
                            <TableHead className="w-32">Barcode</TableHead>
                            <TableHead className="w-28">Category</TableHead>
                            <TableHead className="w-24">Stock</TableHead>
                            <TableHead className="w-24">Price</TableHead>
                            <TableHead className="w-28">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedNewProductRows.map((row) => (
                            <TableRow key={`${row.row_number}-${row.product_name}`}>
                              <TableCell>{row.row_number}</TableCell>
                              <TableCell>{row.product_name || "-"}</TableCell>
                              <TableCell>{row.sku || "-"}</TableCell>
                              <TableCell>{row.barcode || "-"}</TableCell>
                              <TableCell>{row.category || "-"}</TableCell>
                              <TableCell>{row.stock || "-"}</TableCell>
                              <TableCell>{row.price || "-"}</TableCell>
                              <TableCell>
                                {createdRowNumbers.has(row.row_number) ? (
                                  <Badge variant="secondary" className="text-[11px]">
                                    Added
                                  </Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => openCreateDialog(row)}
                                    disabled={loadingAction !== ""}
                                  >
                                    Create
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {newProductRows.length > PAGE_SIZE && (
                        <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-gray-600">
                            Showing {(newProductsPage - 1) * PAGE_SIZE + 1}-{Math.min(newProductsPage * PAGE_SIZE, newProductRows.length)} of {newProductRows.length}
                          </p>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">Page {newProductsPage} of {totalNewProductsPages}</span>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setNewProductsPage((prev) => Math.max(1, prev - 1))}
                                disabled={newProductsPage === 1}
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setNewProductsPage((prev) => Math.min(totalNewProductsPages, prev + 1))}
                                disabled={newProductsPage === totalNewProductsPages}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isSyncMode && (
            <TabsContent value="not-in-file" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Products Not In File</CardTitle>
                  <CardDescription>
                    Active catalog products for this outlet that were not found in the uploaded sync file. Archive them if they are no longer sold.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="missing-search">Search Missing Products</Label>
                      <input
                        id="missing-search"
                        type="text"
                        value={missingSearchTerm}
                        onChange={(e) => setMissingSearchTerm(e.target.value)}
                        placeholder="Search by name, SKU, barcode, or category"
                        className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="border-gray-300"
                      onClick={() => setShowArchiveAllDialog(true)}
                      disabled={archivingAllMissing || filteredMissingProducts.length === 0}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      {archivingAllMissing ? "Archiving All..." : "Archive All"}
                    </Button>
                  </div>

                  {missingLoading ? (
                    <p className="text-sm text-gray-600">Loading missing products...</p>
                  ) : filteredMissingProducts.length === 0 ? (
                    <p className="text-sm text-gray-600">No missing products detected.</p>
                  ) : (
                    <div className="rounded-md border border-gray-300 bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Product Name</TableHead>
                            <TableHead className="w-32">SKU</TableHead>
                            <TableHead className="w-32">Barcode</TableHead>
                            <TableHead className="w-32">Category</TableHead>
                            <TableHead className="w-24">Stock</TableHead>
                            <TableHead className="w-28">Low-Stock Limit</TableHead>
                            <TableHead className="w-28">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedMissingProducts.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{row.name || "-"}</TableCell>
                              <TableCell>{row.sku || "-"}</TableCell>
                              <TableCell>{row.barcode || "-"}</TableCell>
                              <TableCell>{row.category || "-"}</TableCell>
                              <TableCell>{row.sellable_stock}</TableCell>
                              <TableCell>{row.low_stock_threshold}</TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => archiveMissingProduct(row)}
                                  disabled={archivingProductId === row.id}
                                >
                                  {archivingProductId === row.id ? "Archiving..." : "Archive"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {filteredMissingProducts.length > PAGE_SIZE && (
                        <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-gray-600">
                            Showing {(missingProductsPage - 1) * PAGE_SIZE + 1}-{Math.min(missingProductsPage * PAGE_SIZE, filteredMissingProducts.length)} of {filteredMissingProducts.length}
                          </p>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">Page {missingProductsPage} of {totalMissingProductsPages}</span>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMissingProductsPage((prev) => Math.max(1, prev - 1))}
                                disabled={missingProductsPage === 1}
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setMissingProductsPage((prev) => Math.min(totalMissingProductsPages, prev + 1))}
                                disabled={missingProductsPage === totalMissingProductsPages}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="import-history" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>{historyTabLabel}</CardTitle>
                <CardDescription>
                  {isSyncMode
                    ? "Process date, row details, and quick access to full sync history."
                    : "Import date, row details, and quick access to full batch history."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="history-search">Search Import History</Label>
                    <input
                      id="history-search"
                      type="text"
                      value={historySearchTerm}
                      onChange={(e) => setHistorySearchTerm(e.target.value)}
                      placeholder="Search by file, outlet, batch id, status, or user"
                      className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label>Status Filter</Label>
                    <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="preview_ready">Preview Ready</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="applying">Applying</SelectItem>
                        <SelectItem value="applied">Applied</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label>Date Range</Label>
                    <Select value={historyDatePreset} onValueChange={setHistoryDatePreset}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="All dates" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Dates</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="last7">Last 7 Days</SelectItem>
                        <SelectItem value="last30">Last 30 Days</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <Label>Custom From / To</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={historyDateFrom}
                        onChange={(e) => setHistoryDateFrom(e.target.value)}
                        disabled={historyDatePreset !== "custom"}
                        className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm disabled:bg-gray-100"
                      />
                      <input
                        type="date"
                        value={historyDateTo}
                        onChange={(e) => setHistoryDateTo(e.target.value)}
                        disabled={historyDatePreset !== "custom"}
                        className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-gray-300">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-52">Import Date</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead className="w-36">Outlet</TableHead>
                        <TableHead className="w-44">Sync Strategy</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead className="w-24">Approved</TableHead>
                        <TableHead>List Details</TableHead>
                        <TableHead className="w-20 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-sm text-gray-600">
                            Loading import history...
                          </TableCell>
                        </TableRow>
                      ) : historyRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-sm text-gray-600">
                            No import history found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        historyRows.map((row) => (
                          <TableRow key={row.batch_id}>
                            <TableCell>{formatDateTime(row.import_date)}</TableCell>
                            <TableCell>{row.source_filename || "-"}</TableCell>
                            <TableCell>{row.outlet?.name || "-"}</TableCell>
                            <TableCell>{row.sync_strategy ? SYNC_STRATEGY_LABELS[row.sync_strategy] : "-"}</TableCell>
                            <TableCell>{row.status}</TableCell>
                            <TableCell>{row.is_approved ? "Yes" : "No"}</TableCell>
                            <TableCell>
                              {row.total_rows} rows | valid {row.valid_rows} | invalid {row.invalid_rows} | imported {row.imported} | failed {row.failed}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="border-gray-300"
                                      aria-label={`Open actions for batch ${row.batch_id}`}
                                    >
                                      <Menu className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuLabel>Batch Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleResumeFromHistory(row)}
                                      disabled={loadingAction !== ""}
                                    >
                                      {row.status === "applied" ? "Open Batch" : "Continue Sync"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleRecoverFromHistory(row)}
                                      disabled={loadingAction !== "" || row.status?.toLowerCase() !== "applied"}
                                    >
                                      {loadingAction === "recover" ? "Recovering..." : "Full Recovery"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleRollbackFromHistory(row)}
                                      disabled={
                                        loadingAction !== "" ||
                                        !isSyncMode ||
                                        row.status?.toLowerCase() !== "applied"
                                      }
                                    >
                                      {loadingAction === "rollback_preview" || loadingAction === "rollback_execute"
                                        ? "Reversing..."
                                        : "Reverse Sync"}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                      <Link href={`/dashboard/inventory/products/import/history/${row.batch_id}?mode=${historyModeParam}`}>
                                        View Full History
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDownloadBatchSource(row.batch_id)}
                                      disabled={loadingAction !== ""}
                                    >
                                      Source
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {historyCount > 10 && (
                  <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-600">
                      Showing {(historyPage - 1) * 10 + 1}-{Math.min(historyPage * 10, historyCount)} of {historyCount}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">Page {historyPage} of {historyTotalPages}</span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadImportHistory(Math.max(1, historyPage - 1))}
                          disabled={historyPage === 1 || historyLoading}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadImportHistory(Math.min(historyTotalPages, historyPage + 1))}
                          disabled={historyPage === historyTotalPages || historyLoading}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </FilterableTabs>

        <Dialog open={showArchiveAllDialog} onOpenChange={setShowArchiveAllDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Archive All Filtered Products?</DialogTitle>
              <DialogDescription>
                This will archive all products currently listed in Not In File based on your search filter.
                You can restore archived products later from product management.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowArchiveAllDialog(false)}
                disabled={archivingAllMissing}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  await archiveAllMissingProducts()
                  setShowArchiveAllDialog(false)
                }}
                disabled={archivingAllMissing || filteredMissingProducts.length === 0}
              >
                {archivingAllMissing ? "Archiving..." : "Confirm Archive All"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditRowDialog} onOpenChange={setShowEditRowDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Import Row</DialogTitle>
              <DialogDescription>
                Update row {editRowDraft.rowNumber} and save changes to refresh validation, summary, and apply readiness.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Product Name</Label>
                <input
                  type="text"
                  value={editRowDraft.productName}
                  onChange={(e) => setEditRowDraft((prev) => ({ ...prev, productName: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>SKU</Label>
                <input
                  type="text"
                  value={editRowDraft.sku}
                  onChange={(e) => setEditRowDraft((prev) => ({ ...prev, sku: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Barcode</Label>
                <input
                  type="text"
                  value={editRowDraft.barcode}
                  onChange={(e) => setEditRowDraft((prev) => ({ ...prev, barcode: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <input
                  type="text"
                  value={editRowDraft.category}
                  onChange={(e) => setEditRowDraft((prev) => ({ ...prev, category: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Retail Price</Label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editRowDraft.retailPrice}
                  onChange={(e) => setEditRowDraft((prev) => ({ ...prev, retailPrice: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Cost Price</Label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editRowDraft.costPrice}
                  onChange={(e) => setEditRowDraft((prev) => ({ ...prev, costPrice: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Stock</Label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editRowDraft.stock}
                  onChange={(e) => setEditRowDraft((prev) => ({ ...prev, stock: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditRowDialog(false)} disabled={editRowSubmitting}>
                Cancel
              </Button>
              <Button onClick={saveEditedRow} disabled={editRowSubmitting}>
                {editRowSubmitting ? "Saving..." : "Save Row Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Product From Sync Row</DialogTitle>
              <DialogDescription>
                Row {createDraft.rowNumber} is prefilled. Confirm or edit values before creating this product.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Product Name</Label>
                <input
                  type="text"
                  value={createDraft.productName}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, productName: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>SKU</Label>
                <input
                  type="text"
                  value={createDraft.sku}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, sku: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Barcode</Label>
                <input
                  type="text"
                  value={createDraft.barcode}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, barcode: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Category Name</Label>
                <input
                  type="text"
                  value={createDraft.category}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, category: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Retail Price</Label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createDraft.retailPrice}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, retailPrice: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Cost Price</Label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createDraft.costPrice}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, costPrice: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Wholesale Price (optional)</Label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createDraft.wholesalePrice}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, wholesalePrice: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Stock</Label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={createDraft.stock}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, stock: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Low Stock Threshold</Label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={createDraft.lowStockThreshold}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, lowStockThreshold: e.target.value }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <textarea
                  value={createDraft.description}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={createDraft.isActive}
                    onChange={(e) => setCreateDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Active product
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={createSubmitting}>
                Cancel
              </Button>
              <Button onClick={createProductFromDraft} disabled={createSubmitting}>
                {createSubmitting ? "Creating..." : "Create Product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </DashboardLayout>
  )
}

export default function ProductsImportPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Loading import page...</div>}>
      <ProductsImportPageContent />
    </Suspense>
  )
}
