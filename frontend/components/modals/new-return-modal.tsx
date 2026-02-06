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
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { returnService, type ReturnType, type ReturnItem, type CreateReturnData } from "@/lib/services/returnService"
import { productService } from "@/lib/services/productService"
import { supplierService } from "@/lib/services/supplierService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { Plus, Trash2, Search, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"

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
  const [selectedSupplier, setSelectedSupplier] = useState<string>("")
  const [fromOutlet, setFromOutlet] = useState<string>("")
  const [toOutlet, setToOutlet] = useState<string>("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<ReturnItem[]>([])
  const [showProductSearch, setShowProductSearch] = useState(false)

  // Load data
  useEffect(() => {
    if (!open) return

    const loadData = async () => {
      try {
        // Load suppliers
        const suppliersData = await supplierService.list()
        setSuppliers(Array.isArray(suppliersData) ? suppliersData : suppliersData.results || [])
        
        // Load products
        const productsData = await productService.list({ is_active: true })
        setProducts(Array.isArray(productsData) ? productsData : productsData.results || [])
      } catch (error) {
        console.error("Failed to load data:", error)
      }
    }

    loadData()
  }, [open])

  // Reset form when modal opens/closes
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
      setShowProductSearch(false)
    }
  }, [open])

  const handleAddItem = () => {
    setShowProductSearch(true)
  }

  const handleSelectProduct = (product: any) => {
    const newItem: ReturnItem = {
      product_id: String(product.id),
      product_name: product.name,
      quantity: 1,
      unit_price: product.price || product.retail_price || "0",
    }
    setItems([...items, newItem])
    setShowProductSearch(false)
    setSearchTerm("")
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof ReturnItem, value: any) => {
    const updatedItems = [...items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setItems(updatedItems)
  }

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

      // Supplier return
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
        returnData.return_date = new Date().toISOString().split('T')[0]
      } else if (returnType === "outlet") {
        // Outlet return
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Return</DialogTitle>
          <DialogDescription>
            Create a new return - customer, supplier, or outlet return
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
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
                rows={3}
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Items to Return</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {/* Product Search */}
              {showProductSearch && (
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredProducts.slice(0, 10).map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product)}
                        className="w-full text-left p-2 hover:bg-muted rounded flex items-center gap-2"
                      >
                        <Package className="h-4 w-4" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">SKU: {product.sku || "N/A"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Items List */}
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No items added. Click &quot;Add Item&quot; to add products.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{item.product_name || "Product"}</p>
                          <p className="text-xs text-muted-foreground">SKU: {item.product_id}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Quantity *</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)}
                            required
                          />
                        </div>
                        {returnType === "supplier" && (
                          <div className="space-y-2">
                            <Label>Unit Price</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unit_price || ""}
                              onChange={(e) => handleItemChange(index, "unit_price", e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Item Reason (Optional)</Label>
                        <Input
                          value={item.reason || ""}
                          onChange={(e) => handleItemChange(index, "reason", e.target.value)}
                          placeholder="Reason for this item"
                        />
                      </div>
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
