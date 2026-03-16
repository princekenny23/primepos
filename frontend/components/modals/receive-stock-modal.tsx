"use client"

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PackageCheck, Pencil, Search, Trash2, X } from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useToast } from "@/components/ui/use-toast"
import { inventoryService } from "@/lib/services/inventoryService"
import { productService } from "@/lib/services/productService"
import { useTenant } from "@/contexts/tenant-context"
import type { Product } from "@/lib/types"

interface ReceiveStockModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface ReceiveItem {
  id: string
  product_id: string
  product_name?: string
  quantity: string
  cost: string
}

export function ReceiveStockModal({ open, onOpenChange, onSuccess }: ReceiveStockModalProps) {
  const { toast } = useToast()
  const { outlets } = useTenant()
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([])
  const [outletId, setOutletId] = useState("")
  const [supplier, setSupplier] = useState("")
  const [reason, setReason] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [draftQuantity, setDraftQuantity] = useState("")
  const [draftCost, setDraftCost] = useState("")
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const response = await productService.list({ is_active: true })
      setProducts(response.results || [])
    } catch (error) {
      console.error("Failed to load products:", error)
      toast({
        title: "Error",
        description: "Failed to load products. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingProducts(false)
    }
  }, [toast])

  useEffect(() => {
    if (open) {
      loadProducts()
      setReceiveItems([])
      setOutletId("")
      setSupplier("")
      setReason("")
      setSearchTerm("")
      setSelectedProductId("")
      setDraftQuantity("")
      setDraftCost("")
      setEditingItemId(null)
    }
  }, [open, loadProducts])

  const filteredProducts = useMemo(() => {
    const addedIds = new Set(
      receiveItems.filter(i => i.id !== editingItemId).map(i => i.product_id)
    )
    return products.filter(p =>
      !addedIds.has(String(p.id)) &&
      (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (p as any).sku?.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [products, receiveItems, searchTerm, editingItemId])

  const resetDraft = () => {
    setSelectedProductId("")
    setDraftQuantity("")
    setDraftCost("")
    setEditingItemId(null)
    setSearchTerm("")
  }

  const upsertItem = () => {
    const product = products.find(p => String(p.id) === selectedProductId)
    if (!product || !draftQuantity || parseInt(draftQuantity) <= 0) return
    if (editingItemId) {
      setReceiveItems(prev => prev.map(i =>
        i.id === editingItemId
          ? { ...i, product_id: selectedProductId, product_name: product.name, quantity: draftQuantity, cost: draftCost }
          : i
      ))
    } else {
      setReceiveItems(prev => [...prev, {
        id: Date.now().toString(),
        product_id: selectedProductId,
        product_name: product.name,
        quantity: draftQuantity,
        cost: draftCost,
      }])
    }
    resetDraft()
  }

  const handleEditItem = (item: ReceiveItem) => {
    setEditingItemId(item.id)
    setSelectedProductId(item.product_id)
    setDraftQuantity(item.quantity)
    setDraftCost(item.cost)
    setSearchTerm(item.product_name || "")
  }

  const handleSelectProduct = (p: Product) => {
    setSelectedProductId(String(p.id))
    setSearchTerm(p.name)
    if ((p as any).cost && !draftCost) {
      setDraftCost(String((p as any).cost))
    }
  }

  const removeReceiveItem = (id: string) => {
    setReceiveItems(prev => prev.filter(i => i.id !== id))
    if (editingItemId === id) resetDraft()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!outletId) {
      toast({
        title: "Validation Error",
        description: "Please select an outlet.",
        variant: "destructive",
      })
      return
    }

    const validItems = receiveItems.filter(item =>
      item.product_id && item.quantity && parseInt(item.quantity) > 0
    )

    if (validItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one product with valid quantity.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const items = validItems.map(item => ({
        product_id: item.product_id,
        quantity: parseInt(item.quantity),
        cost: item.cost ? parseFloat(item.cost) : undefined,
      }))

      const response = await inventoryService.receive({
        outlet_id: outletId,
        supplier: supplier || undefined,
        items: items,
        reason: reason || undefined,
      })

      if (response.errors && response.errors.length > 0) {
        if (response.results && response.results.length > 0) {
          toast({
            title: "Partial Success",
            description: `${response.results.length} product(s) received, ${response.errors.length} failed.`,
            variant: "default",
          })
        } else {
          toast({
            title: "Receiving Failed",
            description: "All items failed. Please check and try again.",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Receiving Successful",
          description: `Successfully received ${response.results?.length || validItems.length} product(s).`,
        })
      }

      onOpenChange(false)

      if (onSuccess && response.results && response.results.length > 0) {
        setTimeout(() => { onSuccess() }, 500)
      }
    } catch (error: any) {
      console.error("Failed to receive stock:", error)
      toast({
        title: "Receiving Failed",
        description: error.message || "Failed to receive stock. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Bulk Stock Receiving
          </DialogTitle>
          <DialogDescription>
            Receive multiple products from suppliers
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Receiving Details */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold text-sm">Receiving Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="outlet">Outlet *</Label>
                  <Select value={outletId} onValueChange={setOutletId} required>
                    <SelectTrigger id="outlet">
                      <SelectValue placeholder="Select outlet" />
                    </SelectTrigger>
                    <SelectContent>
                      {outlets.filter(o => o.isActive).map(outlet => (
                        <SelectItem key={outlet.id} value={outlet.id}>
                          {outlet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Supplier name (optional)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Notes</Label>
                <textarea
                  id="reason"
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Optional notes about this receiving"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            {/* Receive Items */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Products to Receive</h3>

              {/* Entry Lane */}
              <div className="p-3 border rounded-lg space-y-3 bg-muted/30">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search product..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setSelectedProductId("") }}
                    className="pl-9"
                    disabled={loadingProducts}
                  />
                </div>
                {searchTerm && !selectedProductId && (
                  <div className="border rounded-md bg-background max-h-48 overflow-y-auto">
                    {filteredProducts.slice(0, 8).length > 0 ? filteredProducts.slice(0, 8).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                        onClick={() => handleSelectProduct(p)}
                      >
                        <span>{p.name}</span>
                        <span className="text-xs text-muted-foreground">Stock: {(p as any).stock ?? "—"}</span>
                      </button>
                    )) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No products found</p>
                    )}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Quantity *</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={draftQuantity}
                      onChange={e => setDraftQuantity(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Cost (optional)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={draftCost}
                      onChange={e => setDraftCost(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedProductId || !draftQuantity || parseInt(draftQuantity) <= 0}
                    onClick={upsertItem}
                  >
                    {editingItemId ? "Update Item" : "Add Item"}
                  </Button>
                  {editingItemId && (
                    <Button type="button" size="sm" variant="outline" onClick={resetDraft}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Queued Items */}
              {receiveItems.length > 0 && (
                <div className="space-y-1">
                  {receiveItems.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${editingItemId === item.id ? "border-primary bg-primary/5" : "bg-background"}`}
                    >
                      <span className="flex-1 font-medium truncate">{item.product_name}</span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        Qty: {item.quantity}{item.cost ? ` • Cost: ${item.cost}` : ""}
                      </span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditItem(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeReceiveItem(item.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || loadingProducts || !outletId || receiveItems.length === 0}
            >
              {isLoading ? `Processing ${receiveItems.length} product(s)...` : `Receive ${receiveItems.length} Product(s)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
