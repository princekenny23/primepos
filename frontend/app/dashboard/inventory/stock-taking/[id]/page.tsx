"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ClipboardCheck, Search, Save, ArrowLeft, CheckCircle2, Upload } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { inventoryService } from "@/lib/services/inventoryService"
import { productService } from "@/lib/services/productService"
import { useToast } from "@/components/ui/use-toast"
import { useBusinessStore } from "@/stores/businessStore"
import * as XLSX from "xlsx"

interface StockTakingItem {
  id: string
  product_id: string
  product_name: string
  barcode: string
  expectedQty: number
  countedQty: number
  difference: number
  isCounted: boolean
  notes?: string
}

interface ImportedStockTakeRow {
  productName: string
  countedQuantity: number
  sku?: string
  barcode?: string
}

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

function findBestStockTakeItem(row: ImportedStockTakeRow, stockTakeItems: StockTakingItem[]) {
  const rowBarcode = normalizeValue(row.barcode)
  const rowSku = normalizeValue(row.sku)
  const rowName = normalizeValue(row.productName)

  const isPlaceholderItem = (item: StockTakingItem) => String(item.id).startsWith("placeholder-")

  const exactBarcodeCandidates = rowBarcode
    ? stockTakeItems.filter((item) => normalizeValue(item.barcode) === rowBarcode)
    : []
  if (exactBarcodeCandidates.length) {
    const exactBarcodeReal = exactBarcodeCandidates.filter((item) => !isPlaceholderItem(item))
    if (exactBarcodeReal.length === 1) return exactBarcodeReal[0]
    if (exactBarcodeReal.length > 1) return exactBarcodeReal[0]
    if (exactBarcodeCandidates.length === 1) return exactBarcodeCandidates[0]
    return null
  }

  const exactSkuCandidates = rowSku
    ? stockTakeItems.filter((item) => normalizeValue(item.product_id) === rowSku)
    : []
  if (exactSkuCandidates.length) {
    const exactSkuReal = exactSkuCandidates.filter((item) => !isPlaceholderItem(item))
    if (exactSkuReal.length === 1) return exactSkuReal[0]
    if (exactSkuReal.length > 1) return exactSkuReal[0]
    if (exactSkuCandidates.length === 1) return exactSkuCandidates[0]
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
      (candidate): candidate is { item: StockTakingItem; similarity: number; containsMatch: boolean; isPlaceholder: boolean } => Boolean(candidate)
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

  if (bestCandidate.containsMatch) return bestCandidate.item
  if (bestCandidate.similarity >= 0.9) return bestCandidate.item

  return null
}

export default function StockTakingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const stockTakeId = params.id as string
  const { toast } = useToast()
  const { currentOutlet } = useBusinessStore()

  const [searchTerm, setSearchTerm] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState<"all" | "remaining" | "counted">("all")
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<StockTakingItem | null>(null)
  const [editCountValue, setEditCountValue] = useState("")
  const [items, setItems] = useState<StockTakingItem[]>([])
  const [stockTake, setStockTake] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchPage, setSearchPage] = useState(1)
  const itemsPerPage = 10
  const [isCompleting, setIsCompleting] = useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [totalInventoryCount, setTotalInventoryCount] = useState(0)
  useEffect(() => {
    loadStockTakeData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockTakeId])

  useEffect(() => {
    if (searchParams?.get("focus") === "remaining") {
      setSearchFilter("remaining")
      setSearchOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    setCurrentPage(1)
    setSearchPage(1)
  }, [items.length, searchTerm, searchFilter])

  const loadStockTakeData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    try {
      const [stockTakeData, itemsData] = await Promise.all([
        inventoryService.getStockTake(stockTakeId),
        inventoryService.getStockTakeItems(stockTakeId),
      ])
      
      setStockTake(stockTakeData)
      
      console.log("Raw items data from API:", itemsData)
      
      const transformedItems: StockTakingItem[] = itemsData.map((item: any) => {
        // Ensure we parse the counted_quantity correctly
        const countedQty = typeof item.counted_quantity === 'number' 
          ? item.counted_quantity 
          : parseInt(String(item.counted_quantity || 0))
        const isCounted = countedQty > 0
        
        const transformed = {
          id: String(item.id),
          product_id: String(item.product?.id || item.product_id || ""),
          product_name: item.product?.name || "Unknown Product",
          barcode: item.product?.barcode || "",
          expectedQty: typeof item.expected_quantity === 'number'
            ? item.expected_quantity
            : parseInt(String(item.expected_quantity || 0)),
          countedQty: countedQty,
          difference: typeof item.difference === 'number'
            ? item.difference
            : parseInt(String(item.difference || 0)),
          isCounted: isCounted,
          notes: item.notes || "",
        }
        
        // Log if we find an item with countedQty > 0
        if (countedQty > 0) {
          console.log("Found counted item:", {
            id: transformed.id,
            name: transformed.product_name,
            countedQty: transformed.countedQty,
            isCounted: transformed.isCounted,
            rawCountedQuantity: item.counted_quantity,
            rawItem: item
          })
        }
        
        return transformed
      })
      
      let allItems = transformedItems
      
      // Load all products for outlet and merge with stock take items
      if (currentOutlet) {
        try {
          let page = 1
          let fetchedProducts: any[] = []
          let productList

          do {
            productList = await productService.list({
              outlet: String(currentOutlet.id),
              is_active: true,
              page,
            })
            fetchedProducts.push(...(productList.results || []))
            page += 1
          } while (productList.next)

          setTotalInventoryCount(productList.count || fetchedProducts.length)
          console.log("Total inventory count for outlet:", productList.count || fetchedProducts.length)
          
          const existingItemsByProductId = new Map<string, StockTakingItem>()
          transformedItems.forEach(item => {
            existingItemsByProductId.set(item.product_id, item)
          })
          
          const missingProducts = fetchedProducts.filter(
            (product: any) => !existingItemsByProductId.has(String(product.id))
          )
          
          const placeholderItems: StockTakingItem[] = missingProducts.map((product: any) => ({
            id: `placeholder-${product.id}`,
            product_id: String(product.id),
            product_name: product.name || "Unknown",
            barcode: product.barcode || "",
            expectedQty: product.stock || 0,
            countedQty: 0,
            difference: 0,
            isCounted: false,
            notes: "",
          }))
          
          allItems = [...transformedItems, ...placeholderItems]
          console.log("Merged items:", {
            existing: transformedItems.length,
            missing: placeholderItems.length,
            total: allItems.length,
          })
        } catch (error) {
          console.error("Failed to load product list:", error)
        }
      }
      
      const countedItemsList = allItems.filter(i => i.countedQty > 0)
      console.log("Loaded stock take items:", {
        total: allItems.length,
        counted: countedItemsList.length,
        itemsWithCountedQty: allItems.filter(i => i.countedQty > 0).length,
        countedItems: countedItemsList.map(i => ({
          id: i.id,
          name: i.product_name,
          countedQty: i.countedQty,
          isCounted: i.isCounted
        }))
      })
      
      setItems(allItems)
    } catch (error) {
      console.error("Failed to load stock take data:", error)
      toast({
        title: "Error",
        description: "Failed to load stock take data. Please try again.",
        variant: "destructive",
      })
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  // Filter items for search dropdown (with filter options)
  const searchableItems = useMemo(() => {
    return items.filter(item => {
      // Apply search term filter
      const matchesSearch = !searchTerm || (
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.barcode.toLowerCase().includes(searchTerm.toLowerCase())
      )
      
      // Apply status filter
      const matchesFilter = 
        searchFilter === "all" ||
        (searchFilter === "counted" && item.isCounted) ||
        (searchFilter === "remaining" && !item.isCounted)
      
      return matchesSearch && matchesFilter
    })
  }, [items, searchTerm, searchFilter])

  const paginatedSearchableItems = useMemo(() => {
    const startIndex = (searchPage - 1) * itemsPerPage
    return searchableItems.slice(startIndex, startIndex + itemsPerPage)
  }, [searchableItems, searchPage, itemsPerPage])

  // Filter items for stock count table (only counted items with countedQty > 0)
  const countedItems = useMemo(() => {
    const filtered = items
      .filter(item => {
        // Item is counted if countedQty > 0
        const isCounted = (item.countedQty || 0) > 0
        return isCounted
      })
      .sort((a, b) => a.product_name.localeCompare(b.product_name))
    
    console.log("Counted items filter:", {
      totalItems: items.length,
      countedItems: filtered.length,
      itemsWithCountedQty: items.filter(i => i.countedQty > 0).length,
      sampleItems: filtered.slice(0, 3).map(i => ({
        id: i.id,
        name: i.product_name,
        countedQty: i.countedQty,
        isCounted: i.isCounted
      }))
    })
    
    return filtered
  }, [items])

  const paginatedCountedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return countedItems.slice(startIndex, startIndex + itemsPerPage)
  }, [countedItems, currentPage, itemsPerPage])

  const totalCountedPages = Math.max(1, Math.ceil(countedItems.length / itemsPerPage))
  const totalSearchPages = Math.max(1, Math.ceil(searchableItems.length / itemsPerPage))

  const handleCountChange = async (itemId: string, value: string) => {
    const numValue = parseInt(value) || 0
    const item = items.find(i => i.id === itemId)
    if (!item) return

    console.log("Updating item count:", { 
      itemId, 
      numValue, 
      itemName: item.product_name, 
      currentCountedQty: item.countedQty,
      stockTakeId 
    })

    // Save to backend first
    try {
      console.log("Calling updateStockTakeItem with:", {
        stockTakeId,
        itemId,
        data: { counted_quantity: numValue }
      })
      
      const response = await inventoryService.updateStockTakeItem(stockTakeId, itemId, {
        counted_quantity: numValue,
      })
      
      console.log("Backend response after update:", response)
      
      // Small delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Reload data to ensure sync with backend (don't show loading spinner)
      await loadStockTakeData(false)
      
      console.log("Data reloaded after update, items state:", items.length)
      
      toast({
        title: "Count Updated",
        description: `${item.product_name} count has been updated to ${numValue}.`,
      })
    } catch (error: any) {
      console.error("Failed to update item count - Full error:", error)
      console.error("Error details:", {
        message: error?.message,
        status: error?.status,
        data: error?.data,
        stack: error?.stack,
      })
      
      const errorMessage = error?.message || 
                          error?.data?.detail || 
                          error?.data?.message ||
                          "Failed to save count. Please try again."
      
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      })
      // Reload to get correct state
      await loadStockTakeData(false)
    }
  }

  const handleItemClick = async (item: StockTakingItem) => {
    // If this is a placeholder item (not yet in database), create it first
    if (String(item.id).startsWith("placeholder-")) {
      try {
        // Create the stock take item in the database using the product ID
        const response = await inventoryService.createStockTakeItem(stockTakeId, {
          product_id: item.product_id,
          expected_quantity: item.expectedQty,
          counted_quantity: 0,
        })

        // Reload data to get the real item ID from database
        await loadStockTakeData(false)

        const newItem = response
        if (newItem) {
          const transformed = {
            id: String(newItem.id),
            product_id: String(newItem.product?.id || newItem.product_id || ""),
            product_name: newItem.product?.name || "Unknown Product",
            barcode: newItem.product?.barcode || "",
            expectedQty: typeof newItem.expected_quantity === 'number'
              ? newItem.expected_quantity
              : parseInt(String(newItem.expected_quantity || 0)),
            countedQty: typeof newItem.counted_quantity === 'number'
              ? newItem.counted_quantity
              : parseInt(String(newItem.counted_quantity || 0)),
            difference: typeof newItem.difference === 'number'
              ? newItem.difference
              : parseInt(String(newItem.difference || 0)),
            isCounted: (typeof newItem.counted_quantity === 'number' ? newItem.counted_quantity : parseInt(String(newItem.counted_quantity || 0))) > 0,
            notes: newItem.notes || "",
          }
          setSelectedItemForEdit(transformed)
          setEditCountValue(transformed.countedQty.toString())
        }
        setSearchOpen(false)
      } catch (error) {
        console.error("Failed to create stock take item:", error)
        toast({
          title: "Error",
          description: "Failed to add item to stock take. Please try again.",
          variant: "destructive",
        })
      }
    } else {
      setSelectedItemForEdit(item)
      setEditCountValue(item.countedQty.toString())
      setSearchOpen(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedItemForEdit) return
    
    const numValue = parseInt(editCountValue) || 0
    await handleCountChange(selectedItemForEdit.id, numValue.toString())
    setSelectedItemForEdit(null)
    setEditCountValue("")
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      // Save all items that have been counted
      const savePromises = items
        .filter(item => item.isCounted)
        .map(item => 
          inventoryService.updateStockTakeItem(stockTakeId, item.id, {
            counted_quantity: item.countedQty,
          })
        )
      
      await Promise.all(savePromises)
      
      toast({
        title: "Progress Saved",
        description: "All counts have been saved successfully.",
      })
      
      // Reload to ensure sync
      loadStockTakeData()
    } catch (error) {
      console.error("Failed to save progress:", error)
      toast({
        title: "Save Failed",
        description: "Failed to save progress. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      await inventoryService.completeStockTake(stockTakeId)
      
      toast({
        title: "Stock Take Completed",
        description: "Stock take has been completed and adjustments have been applied.",
      })
      
      // Reload data
      loadStockTakeData()
      
      // Optionally navigate back to list
      setTimeout(() => {
        router.push("/dashboard/inventory/stock-taking")
      }, 2000)
    } catch (error: any) {
      console.error("Failed to complete stock take:", error)
      toast({
        title: "Completion Failed",
        description: error.message || "Failed to complete stock take. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCompleting(false)
    }
  }

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0]
      const fileName = selectedFile.name.toLowerCase()

      if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls") && !fileName.endsWith(".csv")) {
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

  const handleImportCounts = async () => {
    if (!importFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to import.",
        variant: "destructive",
      })
      return
    }

    setIsImporting(true)
    try {
      const savedStockTakeItems = items.filter((item) => !String(item.id).startsWith("placeholder-"))
      const savedItemsByProductId = new Map<string, StockTakingItem>(
        savedStockTakeItems
          .filter((item) => item.product_id)
          .map((item) => [item.product_id, item] as [string, StockTakingItem])
      )

      const importedRows = await parseImportRows(importFile)
      const matchedCounts = new Map<string, { itemId: string; productId?: string; expectedQuantity?: number; quantity: number }>()
      const unmatchedNames: string[] = []
      let unmatchedRows = 0

      for (const row of importedRows) {
        const matchedItem = findBestStockTakeItem(row, savedStockTakeItems)
        if (!matchedItem) {
          unmatchedRows += 1
          unmatchedNames.push(row.productName)
          continue
        }

        const productId = String(matchedItem.product_id || "")
        const itemId = String(matchedItem.id)
        const mapKey = productId ? `product-${productId}` : itemId

        const existing = matchedCounts.get(mapKey)
        const merged = existing
          ? {
              itemId: existing.itemId,
              productId: existing.productId || productId,
              quantity: existing.quantity + row.countedQuantity,
            }
          : {
              itemId,
              productId: productId || undefined,
              quantity: row.countedQuantity,
            }

        matchedCounts.set(mapKey, merged)
      }

      const updates: Promise<any>[] = []
      // Ensure we never call update/create with placeholder ids. Map to real saved IDs when possible.
      const savedItemsMap = new Map<string, StockTakingItem>(
        savedStockTakeItems.map((it) => [it.product_id, it])
      )

      const plannedUpdates: Array<{ itemId: string; productId?: string; quantity: number }> = []
      for (const existing of matchedCounts.values()) {
        let targetId = existing.itemId
        if (String(targetId).startsWith("placeholder-")) {
          // try to find the saved item for this product
          if (existing.productId && savedItemsMap.has(existing.productId)) {
            targetId = savedItemsMap.get(existing.productId)!.id
          } else {
            console.warn("Skipping import row: no saved item found for placeholder", existing)
            continue
          }
        }

        plannedUpdates.push({ itemId: targetId, productId: existing.productId, quantity: existing.quantity })
      }

      console.debug("Planned stock take updates:", plannedUpdates)

      for (const u of plannedUpdates) {
        updates.push(
          inventoryService.updateStockTakeItem(stockTakeId, u.itemId, {
            counted_quantity: u.quantity,
            notes: `Imported from ${importFile.name}`,
          })
        )
      }

      await Promise.all(updates)
      await loadStockTakeData(false)

      setShowImportModal(false)
      setImportFile(null)

      const totalMatched = matchedCounts.size
      toast({
        title: "Import completed",
        description: `Matched ${totalMatched} of ${importedRows.length} imported row(s).${
          unmatchedRows ? ` ${unmatchedRows} row(s) were not matched.` : ""
        }${unmatchedNames.length ? ` Unmatched: ${unmatchedNames.slice(0, 5).join(", ")}${unmatchedNames.length > 5 ? "..." : ""}` : ""}`,
      })
    } catch (error: any) {
      console.error("Failed to import stock take counts:", error)
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import stock take counts. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
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

  // Calculate progress using actual inventory count
  const totalItems = totalInventoryCount || items.length
  const countedItemsCount = items.filter(item => item.isCounted).length
  const progress = totalItems > 0 ? Math.round((countedItemsCount / totalItems) * 100) : 0
  const isCompleted = stockTake?.status === 'completed'
  const hasUncountedItems = items.some(item => !item.isCounted)

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading stock take...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Stock Taking Session"
        description={`${stockTake?.outlet_name || stockTake?.outlet?.name || "Outlet"} - ${stockTake?.operating_date || ""}${stockTake?.description ? ` - ${stockTake.description}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/inventory/stock-taking")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {!isCompleted && (
              <>
                <Button variant="outline" onClick={() => setShowImportModal(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Counts
                </Button>
                <Button onClick={handleSaveAll} disabled={isSaving} variant="outline">
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Progress"}
                </Button>
                <Button
                  onClick={() => setCompleteDialogOpen(true)}
                  disabled={isCompleting || countedItemsCount === 0}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isCompleting ? "Completing..." : "Complete Stock Take"}
                </Button>
              </>
            )}
            {isCompleted && (
              <Badge className="bg-green-600">Completed</Badge>
            )}
          </div>
        }
      >
        <div className="space-y-6">

        {/* Progress Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Stock Taking Progress</Label>
                <span className="text-sm font-medium text-muted-foreground">
                  {countedItemsCount} / {totalItems} items ({progress}%)
                </span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          </CardContent>
        </Card>


        {searchFilter === "remaining" && hasUncountedItems && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <p className="text-sm text-amber-800">
                {items.filter((item) => !item.isCounted).length} item(s) are still uncounted. Use the search box below to enter the remaining counts manually.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Search Bar with Dropdown */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Add Items</CardTitle>
            <CardDescription>
              Search for items to count. Click on an item to adjust its count.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search items by name or barcode..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setSearchOpen(true)
                      }}
                      onFocus={() => setSearchOpen(true)}
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[var(--radix-popover-trigger-width)] p-0" 
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  {/* Filter Buttons */}
                  <div className="flex gap-1 p-2 border-b">
                    <Button
                      variant={searchFilter === "all" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => setSearchFilter("all")}
                    >
                      All ({items.length})
                    </Button>
                    <Button
                      variant={searchFilter === "remaining" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => setSearchFilter("remaining")}
                    >
                      Remaining ({items.filter(i => !i.isCounted).length})
                    </Button>
                    <Button
                      variant={searchFilter === "counted" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => setSearchFilter("counted")}
                    >
                      Counted ({items.filter(i => i.isCounted).length})
                    </Button>
                  </div>
                  
                  {/* Scrollable Items List */}
                  <div className="max-h-60 overflow-y-auto overflow-x-hidden">
                    {paginatedSearchableItems.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No items found
                      </div>
                    ) : (
                      <div className="divide-y">
                        {paginatedSearchableItems.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className="p-3 cursor-pointer hover:bg-accent transition-colors"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="font-medium truncate">{item.product_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  Barcode: {item.barcode || "N/A"} | Expected: {item.expectedQty}
                                  {item.isCounted && (
                                    <span className="text-green-600"> | Counted: {item.countedQty}</span>
                                  )}
                                </span>
                              </div>
                              <div className="ml-2 flex-shrink-0">
                                {item.isCounted ? (
                                  <Badge className="bg-green-600">Counted</Badge>
                                ) : (
                                  <Badge variant="outline">Not Counted</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {searchableItems.length > itemsPerPage && (
                    <div className="flex items-center justify-between border-t p-2 text-sm text-muted-foreground">
                      <span>Page {searchPage} of {totalSearchPages}</span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSearchPage((prev) => Math.max(1, prev - 1))}
                          disabled={searchPage === 1}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSearchPage((prev) => Math.min(totalSearchPages, prev + 1))}
                          disabled={searchPage === totalSearchPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Stock Count Table - Only Counted Items */}
        <Card>
          <CardHeader>
            <CardTitle>Stock Count</CardTitle>
            <CardDescription>
              Items that have been counted ({countedItems.length} items)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {countedItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No items counted yet. Use the search bar above to find and count items.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCountedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.barcode || "N/A"}</TableCell>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.expectedQty}</TableCell>
                      <TableCell className="text-right">{item.countedQty}</TableCell>
                      <TableCell className={cn(
                        "text-right font-semibold",
                        item.difference === 0 
                          ? "text-muted-foreground" 
                          : item.difference > 0 
                          ? "text-green-600" 
                          : "text-red-600"
                      )}>
                        {item.difference >= 0 ? "+" : ""}{item.difference}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-600">Counted</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleItemClick(item)}
                          disabled={isCompleted}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {countedItems.length > itemsPerPage && (
              <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
                <span>Page {currentPage} of {totalCountedPages}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalCountedPages, prev + 1))}
                    disabled={currentPage === totalCountedPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Count Dialog */}
      <Dialog open={!!selectedItemForEdit} onOpenChange={(open) => !open && setSelectedItemForEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Count</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="count">Counted</Label>
              <Input
                id="count"
                type="number"
                min="0"
                value={editCountValue}
                onChange={(e) => setEditCountValue(e.target.value)}
                placeholder="Counted"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItemForEdit(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Count
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Stock Take Dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete stock take?</AlertDialogTitle>
            <AlertDialogDescription>
              This will apply all adjustments to stock levels and close this session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>
              Complete Stock Take
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Stock Take Counts</DialogTitle>
            <DialogDescription>
              Upload an Excel or CSV file to import counts into the current stock take session.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>File (Excel or CSV)</Label>
              <div className="rounded-lg border-2 border-dashed p-6 text-center">
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">
                  {importFile ? importFile.name : "No file selected"}
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportFileChange}
                  className="hidden"
                  id="stock-take-import-upload"
                  aria-label="Upload stock take import file"
                  title="Upload stock take import file"
                />
                <Label htmlFor="stock-take-import-upload">
                  <Button variant="outline" asChild>
                    <span>Choose File</span>
                  </Button>
                </Label>
              </div>
            </div>

            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
              <p className="mb-1 font-medium">File Format Requirements:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Product Name, SKU, or Barcode</li>
                <li>Counted Quantity</li>
              </ul>
              <div className="mt-3">
                <Button type="button" size="sm" variant="outline" onClick={handleDownloadImportTemplate}>
                  Download Template
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowImportModal(false)
              setImportFile(null)
            }} disabled={isImporting}>
              Cancel
            </Button>
            <Button onClick={handleImportCounts} disabled={!importFile || isImporting}>
              {isImporting ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </PageLayout>
    </DashboardLayout>
  )
}
