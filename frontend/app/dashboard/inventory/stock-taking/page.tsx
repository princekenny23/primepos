"use client";

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Label } from "@/components/ui/label"
import { Plus, MoreVertical, AlertCircle, CheckCircle2, Eye, Users, Upload, Menu, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { StartStockTakeModal } from "@/components/modals/start-stock-take-modal"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { inventoryService } from "@/lib/services/inventoryService"
import { productService } from "@/lib/services/productService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import Link from "next/link"
import { useI18n } from "@/contexts/i18n-context"
import * as XLSX from "xlsx"

interface StockTake {
  id: string
  outletId: string
  outletName: string
  date: string
  time: string
  createdAt: string
  description?: string
  status: "RUNNING" | "FINISHED"
  progress: number
  totalItems: number
  countedItems: number
  startedBy: string
  participants?: number
  completedAt?: string
  operatingDate?: string
}

interface ImportedStockTakeRow {
  productName: string
  countedQuantity: number
  sku?: string
  barcode?: string
}

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[\s\-_]+/g, "")

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
          .map((rawRow) => {
            const normalized: Record<string, unknown> = {}
            Object.entries(rawRow).forEach(([key, val]) => {
              normalized[normalizeHeader(key)] = val
            })

            const productName = String(
              normalized.productname ||
                normalized.name ||
                normalized.product ||
                ""
            ).trim()

            const countedQuantityRaw =
              normalized.countedquantity || normalized.quantity || normalized.count || ""
            const countedQuantity = toNumber(countedQuantityRaw)

            const sku = String(normalized.sku || "").trim()
            const barcode = String(normalized.barcode || "").trim()

            return {
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
          reject(new Error("No valid rows found. Provide at least one identifier such as Product Name, SKU, or Barcode, plus a counted quantity."))
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
  const dp = Array.from({ length: leftChars.length + 1 }, () => new Array(rightChars.length + 1).fill(0))

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

function findBestStockTakeItem(row: ImportedStockTakeRow, stockTakeItems: any[]) {
  const rowBarcode = normalizeValue(row.barcode)
  const rowSku = normalizeValue(row.sku)
  const rowName = normalizeValue(row.productName)

  const exactBarcodeCandidates = rowBarcode
    ? stockTakeItems.filter((item) => normalizeValue(item.product?.barcode || item.barcode || "") === rowBarcode)
    : []
  if (exactBarcodeCandidates.length === 1) return exactBarcodeCandidates[0]
  if (exactBarcodeCandidates.length > 1) return null

  const exactSkuCandidates = rowSku
    ? stockTakeItems.filter((item) => normalizeValue(item.product?.sku || item.sku || "") === rowSku)
    : []
  if (exactSkuCandidates.length === 1) return exactSkuCandidates[0]
  if (exactSkuCandidates.length > 1) return null

  const exactNameCandidates = rowName
    ? stockTakeItems.filter((item) => normalizeValue(item.product?.name || item.product_name || "") === rowName)
    : []
  if (exactNameCandidates.length === 1) return exactNameCandidates[0]
  if (exactNameCandidates.length > 1) return null

  if (!rowName) return null

  const nameCandidates = stockTakeItems
    .map((item) => {
      const candidateName = normalizeValue(item.product?.name || item.product_name || "")
      if (!candidateName) return null

      const containsMatch = candidateName.includes(rowName) || rowName.includes(candidateName)
      const similarity = calculateSimilarity(rowName, candidateName)

      return {
        item,
        similarity,
        containsMatch,
      }
    })
    .filter((candidate): candidate is { item: any; similarity: number; containsMatch: boolean } => Boolean(candidate))

  if (!nameCandidates.length) return null

  const bestCandidate = nameCandidates.reduce((best, current) => {
    if (current.containsMatch && !best.containsMatch) return current
    if (!current.containsMatch && best.containsMatch) return best
    if (current.similarity > best.similarity) return current
    return best
  }, nameCandidates[0])

  if (bestCandidate.containsMatch) return bestCandidate.item
  if (bestCandidate.similarity >= 0.9) return bestCandidate.item

  return null
}

export default function StockTakingHistoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { currentBusiness, currentOutlet, outlets } = useBusinessStore()
  const { t } = useI18n()
  const [showStartModal, setShowStartModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [allStockTakes, setAllStockTakes] = useState<StockTake[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<StockTake | null>(null)
  const useReal = useRealAPI()

  useEffect(() => {
    const loadStockTakes = async () => {
      if (!currentBusiness || !currentOutlet) return
      
      setIsLoading(true)
      try {
        if (useReal) {
          // Load all products for the outlet to get actual inventory count
          const productList = await productService.list({
            outlet: String(currentOutlet.id),
            is_active: true,
          })
          const actualInventoryCount = productList.count || 0

          const response = await inventoryService.getStockTakes({
            outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
          })
          const stockTakes = response.results || []
          
          // Transform all stock takes into unified format with actual inventory count
          const transformed = stockTakes.map((st: any) => {
            const isRunning = st.status === 'running'
            const items = st.items || []
            const countedItems = items.filter((i: any) => i.counted_quantity > 0).length
            
            // Use actual inventory count instead of session items count
            const totalItems = actualInventoryCount
            const progress = totalItems > 0 
              ? Math.round((countedItems / totalItems) * 100) 
              : 0

            return {
              id: String(st.id),
              outletId: String(st.outlet?.id || st.outlet || ""),
              outletName: st.outlet?.name || outlets.find(o => o.id === String(st.outlet))?.name || "--",
              date: st.created_at,
              time: new Date(st.created_at).toLocaleTimeString(),
              createdAt: st.created_at,
              description: st.description || "",
              status: isRunning ? "RUNNING" as const : "FINISHED" as const,
              progress: isRunning ? progress : 100,
              totalItems,
              countedItems: isRunning ? countedItems : totalItems,
              startedBy: st.user_name || st.user?.name || st.user?.email || "System",
              participants: 1,
              completedAt: st.completed_at,
              operatingDate: st.operating_date || st.created_at?.split('T')[0] || "--",
            }
          })
          
          // Sort by created date (newest first)
          transformed.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          
          setAllStockTakes(transformed)
        } else {
          setAllStockTakes([])
        }
      } catch (error) {
        console.error("Failed to load stock takes:", error)
        setAllStockTakes([])
      } finally {
        setIsLoading(false)
      }
    }
    
    loadStockTakes()
  }, [currentBusiness, currentOutlet?.id, useReal, outlets])

  const handleJoinStockTake = (id: string) => {
    router.push(`/dashboard/inventory/stock-taking/${id}`)
  }

  const handleViewStockTake = (id: string) => {
    router.push(`/dashboard/inventory/stock-taking/${id}`)
  }

  const handleDeleteStockTake = (stockTake: StockTake) => {
    setPendingDelete(stockTake)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteStockTake = async () => {
    if (!pendingDelete) return
    try {
      await inventoryService.deleteStockTake(pendingDelete.id)
      setAllStockTakes((prev) => prev.filter((st) => st.id !== pendingDelete.id))
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.message || "Could not delete stock take.",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setPendingDelete(null)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return format(date, "yyyy/MM/dd HH:mm")
    } catch {
      return dateString
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      const fileName = selectedFile.name.toLowerCase()
      
      // Validate file type
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an Excel (.xlsx, .xls) or CSV (.csv) file.",
          variant: "destructive",
        })
        return
      }
      
      setImportFile(selectedFile)
    }
  }

  const handleDownloadTemplate = () => {
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

  return (
    <DashboardLayout>
      <PageLayout
        title={t("inventory.menu.stock_taking")}
        description={t("inventory.stock_take.description")}
        actions={
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setShowStartModal(true)}
              className="bg-white border-white text-[#1e3a8a] hover:bg-blue-50 hover:border-blue-50"
            >
              <Plus className="mr-2 h-4 w-4" />
              Start New Stock Take
            </Button>
          </div>
        }
      >
        {/* Unified Stock Takes Table */}
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Stock Taking Sessions</h3>
            <p className="text-sm text-gray-600">
              View all stock taking sessions, both running and completed
            </p>
          </div>
          <div className="rounded-md border border-gray-300 bg-white">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading stock takes...</p>
              </div>
            ) : allStockTakes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No stock taking sessions found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="text-gray-900 font-semibold">STARTS</TableHead>
                    <TableHead className="text-gray-900 font-semibold">STATUS</TableHead>
                    <TableHead className="text-gray-900 font-semibold">OPERATING DATE</TableHead>
                    <TableHead className="text-gray-900 font-semibold">OUTLET</TableHead>
                    <TableHead className="text-gray-900 font-semibold">USER(S)</TableHead>
                    <TableHead className="text-gray-900 font-semibold">ITEMS</TableHead>
                    <TableHead className="text-gray-900 font-semibold">PERCENTAGE</TableHead>
                    <TableHead className="text-right text-gray-900 font-semibold">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allStockTakes.map((stockTake) => (
                    <TableRow key={stockTake.id} className="border-gray-300">
                        {/* Status Icon */}
                        <TableCell>
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded",
                            stockTake.status === "RUNNING" 
                              ? "bg-yellow-100 dark:bg-yellow-900/20" 
                              : "bg-green-100 dark:bg-green-900/20"
                          )}>
                            {stockTake.status === "RUNNING" ? (
                              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                            )}
                          </div>
                        </TableCell>

                        {/* STARTS */}
                        <TableCell className="font-medium">
                          {formatDate(stockTake.createdAt)}
                        </TableCell>

                        {/* CLOSED */}
                        <TableCell>
                          {stockTake.status === "RUNNING" ? (
                            <span className="text-blue-900 dark:text-blue-900">Running...</span>
                          ) : stockTake.completedAt ? (
                            formatDate(stockTake.completedAt)
                          ) : (
                            formatDate(stockTake.createdAt)
                          )}
                        </TableCell>

                        {/* OPERATING DATE */}
                        <TableCell>
                          {stockTake.operatingDate && stockTake.operatingDate !== "--" 
                            ? stockTake.operatingDate 
                            : "--"}
                        </TableCell>

                        {/* OUTLET */}
                        <TableCell>
                          {stockTake.outletName !== "--" ? stockTake.outletName : "--"}
                        </TableCell>

                        {/* USER(S) */}
                        <TableCell>
                          {stockTake.startedBy || "System"}
                        </TableCell>

                        {/* ITEMS */}
                        <TableCell>
                          {stockTake.countedItems}/{stockTake.totalItems}
                        </TableCell>

                        {/* PERCENTAGE */}
                        <TableCell>
                          {stockTake.progress.toFixed(2)}%
                        </TableCell>

                        {/* ACTION */}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Menu className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {stockTake.status === "RUNNING" ? (
                                <DropdownMenuItem onClick={() => handleJoinStockTake(stockTake.id)}>
                                  <Users className="mr-2 h-4 w-4" />
                                  Join Stock Take
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleViewStockTake(stockTake.id)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteStockTake(stockTake)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            }
          </div>
        </div>
      </PageLayout>

      {/* Start New Stock Take Modal */}
      <StartStockTakeModal
        open={showStartModal}
        onOpenChange={setShowStartModal}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stock take?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected stock take session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteStockTake}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
