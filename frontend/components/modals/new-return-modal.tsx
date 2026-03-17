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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useEffect, useMemo } from "react"
import { useToast } from "@/components/ui/use-toast"
import { returnService, type ReturnType, type ReturnItem, type CreateReturnData } from "@/lib/services/returnService"
import { productService } from "@/lib/services/productService"
import { supplierService } from "@/lib/services/supplierService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { Pencil, Search, Trash2, X } from "lucide-react"

interface NewReturnModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReturnCreated?: () => void
}

export function NewReturnModal({ open, onOpenChange, onReturnCreated }: NewReturnModalProps) {
  const { toast } = useToast()
  const { currentOutlet } = useBusinessStore()
  const { outlets } = useTenant()
  const [isLoading, setIsLoading] = useState(false)
  const [returnType, setReturnType] = useState<ReturnType>("supplier")
  const [products, setProducts] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedSupplier, setSelectedSupplier] = useState<string>("")
  const [fromOutlet, setFromOutlet] = useState<string>("")
  const [toOutlet, setToOutlet] = useState<string>("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<ReturnItem[]>([])
  const [draftQuantity, setDraftQuantity] = useState("")
  const [draftUnitPrice, setDraftUnitPrice] = useState("")
  const [draftItemReason, setDraftItemReason] = useState("")
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Load data
  useEffect(() => {
    if (!open) return

    const loadData = async () => {
      try {
        const suppliersData = await supplierService.list()
        setSuppliers(Array.isArray(suppliersData) ? suppliersData : suppliersData.results || [])

        const productsData = await productService.list({ is_active: true })
        setProducts(Array.isArray(productsData) ? productsData : productsData.results || [])
      } catch (error) {
        console.error("Failed to load data:", error)
      }
    }

    loadData()
  }, [open])

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setReturnType("supplier")
      setSelectedSupplier("")
      setFromOutlet("")
      setToOutlet("")
      setReason("")
      setNotes("")
      setItems([])
      setSearchTerm("")
      setSelectedProductId("")
      setDraftQuantity("")
      setDraftUnitPrice("")
      setDraftItemReason("")
      setEditingIndex(null)
    }
  }, [open])

  const filteredProducts = useMemo(() => {
    const addedIds = new Set(
      items
        .filter((_, i) => i !== editingIndex)
        .map(i => i.product_id)
    )
    return products.filter(p =>
      !addedIds.has(String(p.id)) &&
      (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       p.sku?.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [products, items, searchTerm, editingIndex])

  const resetDraft = () => {
    setSelectedProductId("")
    setDraftQuantity("")
    setDraftUnitPrice("")
    setDraftItemReason("")
    setEditingIndex(null)
    setSearchTerm("")
  }

  const upsertItem = () => {
    const product = products.find(p => String(p.id) === selectedProductId)
    if (!product || !draftQuantity || parseInt(draftQuantity) <= 0) return

    const newItem: ReturnItem = {
      product_id: String(product.id),
      product_name: product.name,
      quantity: parseInt(draftQuantity),
      unit_price: draftUnitPrice || undefined,
      reason: draftItemReason || undefined,
    }

    if (editingIndex !== null) {
      setItems(prev => prev.map((item, i) => i === editingIndex ? newItem : item))
    } else {
      setItems(prev => [...prev, newItem])
    }
    resetDraft()
  }

  const handleEditItem = (index: number) => {
    const item = items[index]
    setEditingIndex(index)
    setSelectedProductId(item.product_id)
    setDraftQuantity(String(item.quantity))
    setDraftUnitPrice(item.unit_price || "")
    setDraftItemReason(item.reason || "")
    setSearchTerm(item.product_name || "")
  }

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
    if (editingIndex === index) resetDraft()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (items.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to return",
        variant: "destructive",
      })
      return
    }

    if (!reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the return",
        variant: "destructive",
      })
      return
    }

    if (!currentOutlet?.id) {
      toast({
        title: "Error",
        description: "Please select an outlet",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const returnData: CreateReturnData = {
        return_type: returnType,
        outlet_id: String(currentOutlet.id),
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        items: items,
      }

      if (returnType === "supplier") {
        if (!selectedSupplier) {
          toast({
            title: "Error",
            description: "Please select a supplier",
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }
        returnData.supplier_id = selectedSupplier
        returnData.return_date = new Date().toISOString().split("T")[0]
      } else if (returnType === "outlet") {
        if (!fromOutlet || !toOutlet) {
          toast({
            title: "Error",
            description: "Please select both from and to outlets",
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }
        returnData.from_outlet_id = fromOutlet
        returnData.to_outlet_id = toOutlet
      }

      await returnService.create(returnData)

      toast({
        title: "Success",
        description: "Return created successfully",
      })

      onReturnCreated?.()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Failed to create return:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create return. Please try again.",
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
          <DialogTitle>New Return</DialogTitle>
          <DialogDescription>
            Create a new supplier or outlet return
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Return Type Selection */}
            <Tabs value={returnType} onValueChange={(v) => setReturnType(v as ReturnType)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="supplier">Supplier Return</TabsTrigger>
                <TabsTrigger value="outlet">Outlet Return</TabsTrigger>
              </TabsList>

              {/* Supplier Return Tab */}
              <TabsContent value="supplier" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={String(supplier.id)}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              {/* Outlet Return Tab */}
              <TabsContent value="outlet" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Outlet *</Label>
                    <Select value={fromOutlet} onValueChange={setFromOutlet}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        {outlets.map((outlet) => (
                          <SelectItem key={outlet.id} value={String(outlet.id)}>
                            {outlet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>To Outlet *</Label>
                    <Select value={toOutlet} onValueChange={setToOutlet}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        {outlets.map((outlet) => (
                          <SelectItem key={outlet.id} value={String(outlet.id)}>
                            {outlet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for return"
                required
                rows={2}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes"
                rows={2}
              />
            </div>

            {/* Items */}
            <div className="space-y-3">
              <Label>Items to Return</Label>

              {/* Entry Lane */}
              <div className="p-3 border rounded-lg space-y-3 bg-muted/30">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search product..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setSelectedProductId("") }}
                    className="pl-9"
                  />
                </div>
                {searchTerm && !selectedProductId && (
                  <div className="border rounded-md bg-background max-h-48 overflow-y-auto">
                    {filteredProducts.slice(0, 8).length > 0 ? filteredProducts.slice(0, 8).map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                        onClick={() => {
                          setSelectedProductId(String(product.id))
                          setSearchTerm(product.name)
                          if (product.price || product.retail_price) {
                            setDraftUnitPrice(String(product.price || product.retail_price))
                          }
                        }}
                      >
                        <span>{product.name}</span>
                        <span className="text-xs text-muted-foreground">SKU: {product.sku || "N/A"}</span>
                      </button>
                    )) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No products found</p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity *</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={draftQuantity}
                      onChange={e => setDraftQuantity(e.target.value)}
                    />
                  </div>
                  {returnType === "supplier" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={draftUnitPrice}
                        onChange={e => setDraftUnitPrice(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Item Reason (optional)</Label>
                  <Input
                    placeholder="Reason for this item"
                    value={draftItemReason}
                    onChange={e => setDraftItemReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedProductId || !draftQuantity || parseInt(draftQuantity) <= 0}
                    onClick={upsertItem}
                  >
                    {editingIndex !== null ? "Update Item" : "Add Item"}
                  </Button>
                  {editingIndex !== null && (
                    <Button type="button" size="sm" variant="outline" onClick={resetDraft}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </div>

              {/* Queued Items */}
              {items.length > 0 && (
                <div className="space-y-1">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${editingIndex === index ? "border-primary bg-primary/5" : "bg-background"}`}
                    >
                      <span className="flex-1 font-medium truncate">{item.product_name || item.product_id}</span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        Qty: {item.quantity}
                        {item.unit_price ? ` • MWK ${item.unit_price}` : ""}
                      </span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditItem(index)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveItem(index)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Return"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
