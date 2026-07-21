import { useState, useEffect } from "react"
import { Search, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { inventoryService } from "@/lib/services/inventoryService"
import { productService } from "@/lib/services/productService"
import { cn } from "@/lib/utils"

interface ImportedStockTakeRow {
  rowNumber: number
  productName: string
  countedQuantity: number
  sku?: string
  barcode?: string
}

interface AddRejectedProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rejectedRow: ImportedStockTakeRow | null
  stockTakeId: string
  outletId: string
  existingProductIds: string[]
  onProductAdded: () => void
}

export function AddRejectedProductDialog({
  open,
  onOpenChange,
  rejectedRow,
  stockTakeId,
  outletId,
  existingProductIds,
  onProductAdded,
}: AddRejectedProductDialogProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  // Populate search term from rejected row
  useEffect(() => {
    if (open && rejectedRow) {
      setSearchTerm(rejectedRow.productName || rejectedRow.sku || rejectedRow.barcode || "")
      setSelectedProduct(null)
      setSearchResults([])
    }
  }, [open, rejectedRow])

  // Debounced search
  useEffect(() => {
    const searchProducts = async () => {
      if (!searchTerm.trim()) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const response = await productService.list({
          outlet: outletId,
          search: searchTerm,
          limit: 50,
        })

        // Filter out products already in stock take and sort by relevance
        const filtered = response.results
          .filter((p: any) => !existingProductIds.includes(String(p.id)))
          .sort((a: any, b: any) => {
            // Prioritize exact name matches
            const aNameMatch = a.name.toLowerCase().includes(searchTerm.toLowerCase())
            const bNameMatch = b.name.toLowerCase().includes(searchTerm.toLowerCase())
            if (aNameMatch && !bNameMatch) return -1
            if (!aNameMatch && bNameMatch) return 1
            return 0
          })

        setSearchResults(filtered)
      } catch (error) {
        console.error("Failed to search products:", error)
        toast({
          title: "Search Failed",
          description: "Could not search for products.",
          variant: "destructive",
        })
      } finally {
        setIsSearching(false)
      }
    }

    const timer = setTimeout(searchProducts, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, outletId, existingProductIds])

  const handleAddProduct = async () => {
    if (!selectedProduct || !rejectedRow) return

    setIsAdding(true)
    try {
      // Create stock take item with the counted quantity from rejected row
      await inventoryService.createStockTakeItem(stockTakeId, {
        product_id: String(selectedProduct.id),
        counted_quantity: rejectedRow.countedQuantity,
        notes: `Added from rejected import row ${rejectedRow.rowNumber}`,
      })

      toast({
        title: "Product Added",
        description: `${selectedProduct.name} added to stock take with count ${rejectedRow.countedQuantity}.`,
      })

      // Reset and close
      setSearchTerm("")
      setSelectedProduct(null)
      setSearchResults([])
      onProductAdded()
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Add Failed",
        description: error?.message || "Failed to add product to stock take.",
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Rejected Product to Stock Take</DialogTitle>
          <DialogDescription>
            {rejectedRow && (
              <span>
                Row {rejectedRow.rowNumber}: <strong>{rejectedRow.productName}</strong> (Qty: {rejectedRow.countedQuantity})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Products */}
          <div>
            <Label htmlFor="product-search">Find Product in Outlet</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="product-search"
                placeholder="Search by product name, SKU, or barcode..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isAdding}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Search results show available products not yet in this stock take
            </p>
          </div>

          {/* Search Results */}
          <div className="border rounded-md max-h-64 overflow-y-auto">
            {isSearching ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Searching products...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {searchTerm ? "No products found matching your search" : "Enter a search term above"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="w-24">SKU</TableHead>
                    <TableHead className="w-28">Barcode</TableHead>
                    <TableHead className="w-20">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((product) => (
                    <TableRow
                      key={product.id}
                      className={cn(
                        "cursor-pointer hover:bg-blue-50",
                        selectedProduct?.id === product.id && "bg-blue-100"
                      )}
                      onClick={() => setSelectedProduct(product)}
                    >
                      <TableCell>
                        <input
                          type="radio"
                          checked={selectedProduct?.id === product.id}
                          onChange={() => setSelectedProduct(product)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku || "--"}</TableCell>
                      <TableCell>{product.barcode || "--"}</TableCell>
                      <TableCell>
                        <Badge variant={product.stock > 0 ? "default" : "secondary"}>
                          {product.stock || 0}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Selected Product Summary */}
          {selectedProduct && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm font-medium text-blue-900">Selected: {selectedProduct.name}</p>
              <p className="text-xs text-blue-700 mt-1">
                Will be added with count: <strong>{rejectedRow?.countedQuantity}</strong>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
            Cancel
          </Button>
          <Button
            onClick={handleAddProduct}
            disabled={isAdding || !selectedProduct}
          >
            <Plus className="mr-2 h-4 w-4" />
            {isAdding ? "Adding..." : "Add Product to Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
