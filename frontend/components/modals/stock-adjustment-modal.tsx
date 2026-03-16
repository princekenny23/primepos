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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState, useEffect, useMemo, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { inventoryService } from "@/lib/services/inventoryService"
import { productService } from "@/lib/services/productService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import type { Product } from "@/lib/types"
import { Plus, Trash2, Search, Package, Pencil, X } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"

interface StockAdjustmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface AdjustmentItem {
  id: string
  product_id: string
  product_name?: string
  current_qty: number
  adjustmentType: "increase" | "decrease"
  quantity: string
}

export function StockAdjustmentModal({ open, onOpenChange, onSuccess }: StockAdjustmentModalProps) {
  const { toast } = useToast()
  const { currentOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet, outlets } = useTenant()
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>([])
  const [commonReason, setCommonReason] = useState("")
  const [commonNotes, setCommonNotes] = useState("")
  const [selectedOutlet, setSelectedOutlet] = useState<string>("")
  const [trackingNumber, setTrackingNumber] = useState<string>("")
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProductId, setSelectedProductId] = useState<string>("")
  const [draftAdjustmentType, setDraftAdjustmentType] = useState<"increase" | "decrease">("increase")
  const [draftQuantity, setDraftQuantity] = useState<string>("")
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  const outlet = tenantOutlet || currentOutlet

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
      // Generate tracking number
      const tracking = `ADJ-${Date.now().toString().slice(-8)}`
      setTrackingNumber(tracking)
      
      // Set default outlet
      if (outlet) {
        setSelectedOutlet(String(outlet.id))
      } else if (outlets.length > 0) {
        setSelectedOutlet(String(outlets[0].id))
      }
      
      // Initialize with one empty item
      setAdjustmentItems([{
        id: Date.now().toString(),
        product_id: "",
        current_qty: 0,
        adjustmentType: "increase",
        quantity: "",
      }])
      setCommonReason("")
      setCommonNotes("")
      setDate(new Date().toISOString().split('T')[0])
      setSearchTerm("")
      setSelectedProductId("")
      setDraftAdjustmentType("increase")
      setDraftQuantity("")
      setEditingItemId(null)
    }
  }, [open, outlet, outlets, loadProducts])

  useEffect(() => {
    if (open) {
      loadProducts()
    }
  }, [open, loadProducts])

  const filteredProducts = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase()
    const selectedProductIds = new Set(
      adjustmentItems
        .filter((item) => item.id !== editingItemId)
        .map((item) => String(item.product_id))
    )

    return products.filter(product =>
      !selectedProductIds.has(String(product.id)) && (
        searchValue.length === 0 ||
        product.name?.toLowerCase().includes(searchValue) ||
        (product.sku && product.sku.toLowerCase().includes(searchValue)) ||
        (product.barcode && product.barcode.toLowerCase().includes(searchValue))
      )
    )
  }, [adjustmentItems, editingItemId, products, searchTerm])

  const selectedProduct = useMemo(
    () => products.find((product) => String(product.id) === String(selectedProductId)),
    [products, selectedProductId]
  )

  const draftCurrentQty = selectedProduct?.stock || 0
  const parsedDraftQty = parseInt(draftQuantity) || 0
  const draftNewQty = draftAdjustmentType === "increase"
    ? draftCurrentQty + parsedDraftQty
    : draftCurrentQty - parsedDraftQty

  const resetDraftFields = () => {
    setSearchTerm("")
    setSelectedProductId("")
    setDraftAdjustmentType("increase")
    setDraftQuantity("")
    setEditingItemId(null)
  }

  const upsertAdjustmentItem = () => {
    if (!selectedProductId) {
      toast({
        title: "Validation Error",
        description: "Please select a product.",
        variant: "destructive",
      })
      return
    }

    if (!draftQuantity || parsedDraftQty <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid adjustment quantity.",
        variant: "destructive",
      })
      return
    }

    const payload: AdjustmentItem = {
      id: editingItemId || Date.now().toString(),
      product_id: selectedProductId,
      product_name: selectedProduct?.name || "",
      current_qty: draftCurrentQty,
      adjustmentType: draftAdjustmentType,
      quantity: draftQuantity,
    }

    if (editingItemId) {
      setAdjustmentItems((prev) => prev.map((item) => (item.id === editingItemId ? payload : item)))
    } else {
      setAdjustmentItems((prev) => [...prev, payload])
    }

    resetDraftFields()
  }

  const handleEditItem = (item: AdjustmentItem) => {
    const product = products.find((p) => String(p.id) === String(item.product_id))
    setEditingItemId(item.id)
    setSelectedProductId(String(item.product_id))
    setSearchTerm(product?.name || item.product_name || "")
    setDraftAdjustmentType(item.adjustmentType)
    setDraftQuantity(item.quantity)
  }

  const removeAdjustmentItem = (id: string) => {
    setAdjustmentItems(adjustmentItems.filter(item => item.id !== id))
  }

  const updateAdjustmentItem = (id: string, field: keyof AdjustmentItem, value: string | "increase" | "decrease" | number) => {
    setAdjustmentItems(adjustmentItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        // Update product_name and current_qty when product_id changes
        if (field === "product_id") {
          const product = products.find(p => p.id === value)
          updated.product_name = product?.name
          updated.current_qty = product?.stock || 0
        }
        return updated
      }
      return item
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate common fields
    if (!commonReason) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for the adjustments.",
        variant: "destructive",
      })
      return
    }

    if (!selectedOutlet) {
      toast({
        title: "Error",
        description: "Please select an outlet.",
        variant: "destructive",
      })
      return
    }

    // Validate all items
    const validItems = adjustmentItems.filter(item => 
      item.product_id && item.quantity && parseInt(item.quantity) > 0
    )

    if (validItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one product adjustment with valid quantity.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Process all adjustments
      const adjustments = validItems.map(item => {
        const quantity = parseInt(item.quantity)
        const adjustmentQuantity = item.adjustmentType === "increase" ? quantity : -quantity
        return {
          product_id: item.product_id,
          outlet_id: selectedOutlet,
          quantity: adjustmentQuantity,
          reason: commonReason + (commonNotes ? ` - ${commonNotes}` : ""),
          type: "adjustment" as const,
        }
      })

      // Submit all adjustments sequentially
      const results = []
      const errors = []
      
      for (const adjustment of adjustments) {
        try {
          await inventoryService.adjust(adjustment)
          results.push(adjustment.product_id)
        } catch (error: any) {
          const productName = products.find(p => p.id === adjustment.product_id)?.name || "Unknown"
          errors.push({ product: productName, error: error.message || "Failed to adjust" })
        }
      }

      // Show results
      if (errors.length === 0) {
        toast({
          title: "Stock Adjustments Applied",
          description: `Successfully adjusted ${results.length} product${results.length > 1 ? 's' : ''}.`,
        })
      } else if (results.length > 0) {
        toast({
          title: "Partial Success",
          description: `${results.length} adjustment${results.length > 1 ? 's' : ''} succeeded, ${errors.length} failed.`,
          variant: "default",
        })
      } else {
        toast({
          title: "Adjustment Failed",
          description: "All adjustments failed. Please try again.",
          variant: "destructive",
        })
      }
      
      // Close modal first
      onOpenChange(false)
      
      // Call onSuccess callback AFTER closing to reload data
      if (onSuccess && results.length > 0) {
        setTimeout(() => {
          onSuccess()
        }, 500)
      }
    } catch (error: any) {
      console.error("Failed to adjust stock:", error)
      toast({
        title: "Adjustment Failed",
        description: error.message || "Failed to adjust stock. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Stock Adjustment</DialogTitle>
          <DialogDescription>
            Adjust inventory levels for multiple products at once
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Common Fields */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold text-sm">Common Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tracking">Tracking Number</Label>
                  <Input
                    id="tracking"
                    value={trackingNumber}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="outlet">Outlet *</Label>
                <Select 
                  value={selectedOutlet}
                  onValueChange={setSelectedOutlet}
                  required
                >
                  <SelectTrigger id="outlet">
                    <SelectValue placeholder={t("common.select_outlet")} />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets.map(outlet => (
                      <SelectItem key={outlet.id} value={String(outlet.id)}>
                        {outlet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Select 
                  value={commonReason}
                  onValueChange={setCommonReason}
                  required
                >
                  <SelectTrigger id="reason">
                    <SelectValue placeholder={t("inventory.stock_adjustment.select_reason")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Damaged">Damaged</SelectItem>
                    <SelectItem value="Theft">Theft</SelectItem>
                    <SelectItem value="Found">Found</SelectItem>
                    <SelectItem value="Return">Return</SelectItem>
                    <SelectItem value="Stock Take">Stock Take</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder={t("common.notes_placeholder")}
                  value={commonNotes}
                  onChange={(e) => setCommonNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Adjustment Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Products to Adjust</h3>
                {adjustmentItems.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {adjustmentItems.length} item{adjustmentItems.length !== 1 ? "s" : ""} queued
                  </span>
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Search Product</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder={t("common.search_products_placeholder")}
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value)
                          if (!e.target.value.trim()) {
                            setSelectedProductId("")
                          }
                        }}
                        className="pl-10"
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-md border">
                      {filteredProducts.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No matching products.</p>
                      ) : (
                        filteredProducts.slice(0, 8).map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => {
                              setSelectedProductId(String(product.id))
                              setSearchTerm(product.name || "")
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <span className="truncate">{product.name}</span>
                            <span className="ml-3 text-xs text-muted-foreground">Stock: {product.stock || 0}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Adjust</Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={draftAdjustmentType}
                        onValueChange={(value: "increase" | "decrease") => setDraftAdjustmentType(value)}
                      >
                        <SelectTrigger className="w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="increase">Increase</SelectItem>
                          <SelectItem value="decrease">Decrease</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        value={draftQuantity}
                        onChange={(e) => setDraftQuantity(e.target.value)}
                        placeholder={t("common.qty")}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded border bg-muted/40 px-2 py-1.5">
                        Current: <span className="font-semibold">{selectedProductId ? draftCurrentQty : "-"}</span>
                      </div>
                      <div className={`rounded border px-2 py-1.5 ${draftNewQty < 0 ? "bg-red-50 text-red-600" : "bg-muted/40"}`}>
                        New: <span className="font-semibold">{selectedProductId ? draftNewQty : "-"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button type="button" size="sm" onClick={upsertAdjustmentItem} disabled={loadingProducts}>
                        <Plus className="mr-2 h-4 w-4" />
                        {editingItemId ? "Update Item" : "Add Item"}
                      </Button>
                      {editingItemId && (
                        <Button type="button" size="sm" variant="ghost" onClick={resetDraftFields}>
                          <X className="mr-2 h-4 w-4" />
                          Cancel Edit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {adjustmentItems.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border rounded-lg">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No products queued yet.</p>
                  </div>
                ) : (
                  adjustmentItems.map((item) => {
                    const changeQty = parseInt(item.quantity) || 0
                    const newQty = item.adjustmentType === "increase"
                      ? item.current_qty + changeQty 
                      : item.current_qty - changeQty

                    return (
                      <div key={item.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.product_name || "N/A"}</p>
                            <p className="text-xs text-muted-foreground">
                              Current {item.current_qty} • {item.adjustmentType === "increase" ? "+" : "-"}{changeQty} • New {newQty}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleEditItem(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeAdjustmentItem(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || loadingProducts || !selectedOutlet || adjustmentItems.length === 0}
            >
              {isLoading ? `Processing ${adjustmentItems.length} adjustment${adjustmentItems.length > 1 ? 's' : ''}...` : `Apply ${adjustmentItems.length} Adjustment${adjustmentItems.length > 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

