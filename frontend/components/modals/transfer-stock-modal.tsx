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
import { ArrowRightLeft, Pencil, Search, Trash2, X } from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useToast } from "@/components/ui/use-toast"
import { inventoryService } from "@/lib/services/inventoryService"
import { productService } from "@/lib/services/productService"
import { useTenant } from "@/contexts/tenant-context"
import type { Product } from "@/lib/types"

interface TransferStockModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface TransferItem {
  id: string
  product_id: string
  product_name?: string
  quantity: string
}

export function TransferStockModal({ open, onOpenChange, onSuccess }: TransferStockModalProps) {
  const { toast } = useToast()
  const { outlets } = useTenant()
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [transferItems, setTransferItems] = useState<TransferItem[]>([])
  const [fromOutletId, setFromOutletId] = useState("")
  const [toOutletId, setToOutletId] = useState("")
  const [commonReason, setCommonReason] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [draftQuantity, setDraftQuantity] = useState("")
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
      setTransferItems([])
      setFromOutletId("")
      setToOutletId("")
      setCommonReason("")
      setSearchTerm("")
      setSelectedProductId("")
      setDraftQuantity("")
      setEditingItemId(null)
    }
  }, [open, loadProducts])

  const filteredProducts = useMemo(() => {
    const addedIds = new Set(
      transferItems.filter(i => i.id !== editingItemId).map(i => i.product_id)
    )
    return products.filter(p =>
      !addedIds.has(String(p.id)) &&
      (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (p as any).sku?.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [products, transferItems, searchTerm, editingItemId])

  const resetDraft = () => {
    setSelectedProductId("")
    setDraftQuantity("")
    setEditingItemId(null)
    setSearchTerm("")
  }

  const upsertItem = () => {
    const product = products.find(p => String(p.id) === selectedProductId)
    if (!product || !draftQuantity || parseInt(draftQuantity) <= 0) return
    if (editingItemId) {
      setTransferItems(prev => prev.map(i =>
        i.id === editingItemId
          ? { ...i, product_id: selectedProductId, product_name: product.name, quantity: draftQuantity }
          : i
      ))
    } else {
      setTransferItems(prev => [...prev, {
        id: Date.now().toString(),
        product_id: selectedProductId,
        product_name: product.name,
        quantity: draftQuantity,
      }])
    }
    resetDraft()
  }

  const handleEditItem = (item: TransferItem) => {
    setEditingItemId(item.id)
    setSelectedProductId(item.product_id)
    setDraftQuantity(item.quantity)
    setSearchTerm(item.product_name || "")
  }

  const removeTransferItem = (id: string) => {
    setTransferItems(prev => prev.filter(i => i.id !== id))
    if (editingItemId === id) resetDraft()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!fromOutletId || !toOutletId) {
      toast({
        title: "Validation Error",
        description: "Please select both source and destination outlets.",
        variant: "destructive",
      })
      return
    }

    if (fromOutletId === toOutletId) {
      toast({
        title: "Validation Error",
        description: "Source and destination outlets must be different.",
        variant: "destructive",
      })
      return
    }

    const validItems = transferItems.filter(item =>
      item.product_id && item.quantity && parseInt(item.quantity) > 0
    )

    if (validItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one product transfer with valid quantity.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const transfers = validItems.map(item => ({
        product_id: item.product_id,
        from_outlet_id: fromOutletId,
        to_outlet_id: toOutletId,
        quantity: parseInt(item.quantity),
        reason: commonReason || "Stock transfer",
      }))

      const results = []
      const errors = []
      
      for (const transfer of transfers) {
        try {
          await inventoryService.transfer(transfer)
          results.push(transfer.product_id)
        } catch (error: any) {
          const productName = products.find(p => p.id === transfer.product_id)?.name || "Unknown"
          errors.push({ product: productName, error: error.message || "Failed to transfer" })
        }
      }

      if (errors.length === 0) {
        toast({
          title: "Transfers Initiated",
          description: `Successfully transferred ${results.length} product${results.length > 1 ? "s" : ""}.`,
        })
      } else if (results.length > 0) {
        toast({
          title: "Partial Success",
          description: `${results.length} transfer${results.length > 1 ? "s" : ""} succeeded, ${errors.length} failed.`,
          variant: "default",
        })
      } else {
        toast({
          title: "Transfer Failed",
          description: "All transfers failed. Please try again.",
          variant: "destructive",
        })
      }
      
      onOpenChange(false)
      
      if (onSuccess && results.length > 0) {
        setTimeout(() => { onSuccess() }, 500)
      }
    } catch (error: any) {
      console.error("Failed to transfer stock:", error)
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to transfer stock. Please try again.",
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
            <ArrowRightLeft className="h-5 w-5" />
            Bulk Stock Transfer
          </DialogTitle>
          <DialogDescription>
            Transfer multiple products from one outlet to another
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Outlet Selection */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold text-sm">Outlet Selection</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from">From Outlet *</Label>
                  <Select value={fromOutletId} onValueChange={setFromOutletId} required>
                    <SelectTrigger id="from">
                      <SelectValue placeholder="Select source outlet" />
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
                  <Label htmlFor="to">To Outlet *</Label>
                  <Select value={toOutletId} onValueChange={setToOutletId} required>
                    <SelectTrigger id="to">
                      <SelectValue placeholder="Select destination outlet" />
                    </SelectTrigger>
                    <SelectContent>
                      {outlets
                        .filter(o => o.isActive && o.id !== fromOutletId)
                        .map(outlet => (
                          <SelectItem key={outlet.id} value={outlet.id}>
                            {outlet.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason/Notes</Label>
                <textarea
                  id="reason"
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Optional reason or notes for this transfer"
                  value={commonReason}
                  onChange={(e) => setCommonReason(e.target.value)}
                />
              </div>
            </div>

            {/* Transfer Items */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Products to Transfer</h3>

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
                        onClick={() => { setSelectedProductId(String(p.id)); setSearchTerm(p.name) }}
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
              {transferItems.length > 0 && (
                <div className="space-y-1">
                  {transferItems.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${editingItemId === item.id ? "border-primary bg-primary/5" : "bg-background"}`}
                    >
                      <span className="flex-1 font-medium truncate">{item.product_name}</span>
                      <span className="text-muted-foreground whitespace-nowrap">Qty: {item.quantity}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditItem(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTransferItem(item.id)}>
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
              disabled={isLoading || loadingProducts || outlets.length < 2 || !fromOutletId || !toOutletId || transferItems.length === 0}
            >
              {isLoading ? `Processing ${transferItems.length} transfer${transferItems.length > 1 ? "s" : ""}...` : `Transfer ${transferItems.length} Product${transferItems.length > 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
