"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { inventoryService } from "@/lib/services/inventoryService"
import { useBusinessStore } from "@/stores/businessStore"
import type { Product } from "@/lib/types"
import { SelectProductModal } from "@/components/modals/select-product-modal"

interface AdjustmentItem {
  id: string
  product_id: string
  product_name?: string
  current_qty: number
  adjustmentType: "increase" | "decrease"
  quantity: string
}

export default function AdjustStockPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [reason, setReason] = useState("")
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>([])
  const [showProductSelector, setShowProductSelector] = useState(false)

  const handleAddItem = (product: Product) => {
    if (adjustmentItems.some((item) => item.product_id === String(product.id))) {
      toast({
        title: "Item already added",
        description: "This product is already in the adjustment list",
      })
      return
    }

    const newItem: AdjustmentItem = {
      id: String(Date.now()),
      product_id: String(product.id),
      product_name: product.name,
      current_qty: product.stock || 0,
      adjustmentType: "increase",
      quantity: "",
    }

    setAdjustmentItems((prev) => [...prev, newItem])
  }

  const handleRemoveItem = (itemId: string) => {
    setAdjustmentItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  const handleUpdateItem = (
    itemId: string,
    field: string,
    value: any
  ) => {
    setAdjustmentItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentOutlet) {
      toast({
        title: "Validation Error",
        description: "Please select an outlet",
        variant: "destructive",
      })
      return
    }

    if (!reason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for adjustment",
        variant: "destructive",
      })
      return
    }

    if (adjustmentItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one product to adjust",
        variant: "destructive",
      })
      return
    }

    // Validate all items have quantity
    if (adjustmentItems.some((item) => !item.quantity || Number(item.quantity) === 0)) {
      toast({
        title: "Validation Error",
        description: "All items must have a quantity",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Create adjustment movements
      await Promise.all(
        adjustmentItems.map((item) =>
          inventoryService.createMovement({
            product_id: item.product_id,
            outlet_id: String(currentOutlet.id),
            movement_type: "adjustment",
            quantity: Number(item.quantity),
            reason: reason,
            reference_id: item.adjustmentType === "decrease" ? "negative" : "positive",
          })
        )
      )

      toast({
        title: "Success",
        description: `${adjustmentItems.length} product${adjustmentItems.length !== 1 ? "s" : ""} adjusted successfully`,
      })

      router.push("/dashboard/inventory/stock-control")
    } catch (error: any) {
      console.error("Failed to create adjustment:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create adjustment",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Adjust Stock"
        description="Adjust inventory stock levels for products"
        actions={
          <Link href="/dashboard/inventory/stock-control">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left Column - Form */}
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Adjustment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Adjustment *</Label>
                    <Textarea
                      id="reason"
                      placeholder="e.g., Stock count correction, damage, theft..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Add Products</CardTitle>
                    <Button type="button" variant="outline" onClick={() => setShowProductSelector(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Product
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Use the add button to open the product picker and add items to this adjustment.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Items to Adjust ({adjustmentItems.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {adjustmentItems.length > 0 ? (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Product</TableHead>
                            <TableHead>Current Qty</TableHead>
                            <TableHead>Adjustment Type</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adjustmentItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.product_name}
                              </TableCell>
                              <TableCell>{item.current_qty}</TableCell>
                              <TableCell>
                                <Select
                                  value={item.adjustmentType}
                                  onValueChange={(value) =>
                                    handleUpdateItem(item.id, "adjustmentType", value as "increase" | "decrease")
                                  }
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="increase">Increase</SelectItem>
                                    <SelectItem value="decrease">Decrease</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateItem(item.id, "quantity", e.target.value)
                                  }
                                  className="w-24"
                                  min="0"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-600">
                      No products added yet. Search above to add products for adjustment.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Summary */}
            <div>
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Items to Adjust</p>
                    <p className="text-2xl font-semibold">{adjustmentItems.length}</p>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Outlet</p>
                    <p className="text-sm text-gray-600">
                      {currentOutlet?.name || "No outlet selected"}
                    </p>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting || adjustmentItems.length === 0}
                    >
                      {isSubmitting ? "Saving..." : "Submit Adjustment"}
                    </Button>
                    <Link href="/dashboard/inventory/stock-control" className="w-full">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                      >
                        Cancel
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>

        <SelectProductModal
          open={showProductSelector}
          onOpenChange={setShowProductSelector}
          onSelect={handleAddItem}
          outletId={currentOutlet?.id ? String(currentOutlet.id) : undefined}
        />
      </PageLayout>
    </DashboardLayout>
  )
}
