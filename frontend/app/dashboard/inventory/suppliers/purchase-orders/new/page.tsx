"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Plus, X, Trash2, Search } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { purchaseOrderService } from "@/lib/services/purchaseOrderService"
import type { PurchaseOrder } from "@/lib/services/purchaseOrderService"
import { supplierService } from "@/lib/services/supplierService"
import { productService } from "@/lib/services/productService"
import { productSupplierService } from "@/lib/services/productSupplierService"
import { useTenant } from "@/contexts/tenant-context"
import { useBusinessStore } from "@/stores/businessStore"

interface PurchaseOrderItem {
  product_id: number
  product_name: string
  quantity: number
  unit_price: string
  notes?: string
}

export default function NewPurchaseOrderPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { outlets } = useTenant()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [supplierProducts, setSupplierProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form state
  const [supplierId, setSupplierId] = useState<string>("")
  const [outletId, setOutletId] = useState<string>("")
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [items, setItems] = useState<PurchaseOrderItem[]>([])
  const [productSearch, setProductSearch] = useState<string>("")
  const [selectedProductId, setSelectedProductId] = useState<string>("")

  // Load suppliers and outlets on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const suppliersResponse = await supplierService.list({ is_active: true })
        setSuppliers(suppliersResponse.results || [])
      } catch (error) {
        console.error("Failed to load suppliers:", error)
        toast({
          title: "Error",
          description: "Failed to load suppliers",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [toast])

  // Load products when supplier is selected
  useEffect(() => {
    if (!supplierId) {
      setSupplierProducts([])
      return
    }

    const loadSupplierProducts = async () => {
      try {
        const outletFilter = outletId || currentOutlet?.id
        // Get products available from this supplier
        const response = await productSupplierService.list({
          supplier: supplierId,
          is_active: true,
        })
        setSupplierProducts(response.results || [])
        
        // Also load all products for search
        const productsResponse = await productService.list({
          is_active: true,
          outlet: outletFilter ? String(outletFilter) : undefined,
        })
        setProducts(productsResponse.results || [])
      } catch (error) {
        console.error("Failed to load supplier products:", error)
      }
    }

    loadSupplierProducts()
  }, [supplierId, outletId, currentOutlet?.id])

  // Filter products based on search
  const filteredProducts = products.filter((product) =>
    product.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.sku?.toLowerCase().includes(productSearch.toLowerCase())
  )

  const addItem = () => {
    if (!selectedProductId) {
      toast({
        title: "Error",
        description: "Please select a product",
        variant: "destructive",
      })
      return
    }

    const product = products.find((p) => String(p.id) === selectedProductId)
    if (!product) return

    // Check if item already exists
    const existingItem = items.find((item) => item.product_id === Number(product.id))
    if (existingItem) {
      toast({
        title: "Item already added",
        description: "This product is already in the order. Update the quantity instead.",
        variant: "default",
      })
      return
    }

    const newItem: PurchaseOrderItem = {
      product_id: Number(product.id),
      product_name: product.name,
      quantity: 1,
      unit_price: product.cost?.toString() || product.cost_price?.toString() || "0.00",
      notes: "",
    }

    setItems([...items, newItem])
    setSelectedProductId("")
    setProductSearch("")
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const updatedItems = [...items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    
    // Recalculate total if quantity or price changed
    if (field === "quantity" || field === "unit_price") {
      // Total is calculated on backend, but we can show preview
    }
    
    setItems(updatedItems)
  }

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      const quantity = item.quantity || 0
      const price = parseFloat(item.unit_price) || 0
      return sum + quantity * price
    }, 0)
  }

  const subtotal = calculateSubtotal()
  const tax = 0 // Tax can be added later
  const discount = 0 // Discount can be added later
  const total = subtotal + tax - discount

  const handleSubmit = async () => {
    if (!supplierId) {
      toast({
        title: "Error",
        description: "Please select a supplier",
        variant: "destructive",
      })
      return
    }

    if (!outletId) {
      toast({
        title: "Error",
        description: "Please select an outlet",
        variant: "destructive",
      })
      return
    }

    if (items.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the order",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const purchaseOrderData = {
        supplier_id: Number(supplierId),
        outlet_id: Number(outletId),
        order_date: orderDate,
        expected_delivery_date: expectedDeliveryDate || undefined,
        status: "draft",
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        discount: discount.toFixed(2),
        total: total.toFixed(2),
        notes: notes || undefined,
        items_data: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes || undefined,
        })),
      }

      const createdPO = await purchaseOrderService.create(purchaseOrderData as Partial<PurchaseOrder>)
      
      toast({
        title: "Success",
        description: "Purchase order created successfully",
      })

      // Redirect to view the created purchase order
      router.push(`/dashboard/inventory/suppliers/purchases/${createdPO.id}`)
    } catch (error: any) {
      console.error("Failed to create purchase order:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase order",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="New Purchase Order"
        description="Create a new purchase order from a supplier"
        actions={
          <Link href="/dashboard/inventory/suppliers/purchases">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        }
      >

        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Column - Form */}
          <div className="md:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Select supplier and outlet for this purchase order</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier *</Label>
                    <Select value={supplierId} onValueChange={setSupplierId} required>
                      <SelectTrigger id="supplier">
                        <SelectValue placeholder="Select supplier" />
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

                  <div className="space-y-2">
                    <Label htmlFor="outlet">Outlet *</Label>
                    <Select value={outletId} onValueChange={setOutletId} required>
                      <SelectTrigger id="outlet">
                        <SelectValue placeholder="Select outlet" />
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
                    <Label htmlFor="orderDate">Order Date *</Label>
                    <Input
                      id="orderDate"
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expectedDelivery">Expected Delivery Date</Label>
                    <Input
                      id="expectedDelivery"
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add Items */}
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
                <CardDescription>Add products to this purchase order</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      className="pl-10"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProducts.slice(0, 50).map((product) => (
                        <SelectItem key={product.id} value={String(product.id)}>
                          {product.name} {product.sku ? `(${product.sku})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addItem} disabled={!selectedProductId}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>

                {items.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => {
                        const itemTotal = (item.quantity || 0) * (parseFloat(item.unit_price) || 0)
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(index, "quantity", parseInt(e.target.value) || 1)
                                }
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) =>
                                  updateItem(index, "unit_price", e.target.value)
                                }
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>${itemTotal.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
                <CardDescription>Additional information about this purchase order</CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter any notes or special instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium">${discount.toFixed(2)}</span>
                </div>
                <div className="border-t pt-4 flex justify-between">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-lg">${total.toFixed(2)}</span>
                </div>
                <div className="pt-4 space-y-2">
                  <Button
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={isSubmitting || items.length === 0}
                  >
                    {isSubmitting ? "Creating..." : "Create Purchase Order"}
                  </Button>
                  <Link href="/dashboard/inventory/suppliers/purchases">
                    <Button variant="outline" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageLayout>
    </DashboardLayout>
  )
}

