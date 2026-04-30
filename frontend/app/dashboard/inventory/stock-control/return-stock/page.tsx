"use client"

import { useState, useEffect } from "react"
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
import { outletService } from "@/lib/services/outletService"
import type { Product } from "@/lib/types"
import { SelectProductModal } from "@/components/modals/select-product-modal"

interface ReturnItem {
  id: string
  product_id: string
  product_name?: string
  quantity: string
}

export default function ReturnStockPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { currentOutlet, outlets: storeOutlets } = useBusinessStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [allOutlets, setAllOutlets] = useState<typeof storeOutlets>([])

  useEffect(() => {
    outletService.list()
      .then((fetched) => {
        if (fetched.length > 0) {
          setAllOutlets(fetched)
        } else if (storeOutlets.length > 0) {
          setAllOutlets(storeOutlets)
        }
      })
      .catch((err) => {
        console.error("[return-stock] Failed to load outlets:", err)
        if (storeOutlets.length > 0) setAllOutlets(storeOutlets)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableOutlets = allOutlets.filter(
    (outlet) => String(outlet.id) !== String(currentOutlet?.id)
  )

  const [toOutletId, setToOutletId] = useState("")
  const [reason, setReason] = useState("")
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])
  const [showProductSelector, setShowProductSelector] = useState(false)

  const handleAddItem = (product: Product) => {
    if (returnItems.some((item) => item.product_id === String(product.id))) {
      toast({
        title: "Item already added",
        description: "This product is already in the return list",
      })
      return
    }

    const newItem: ReturnItem = {
      id: String(Date.now()),
      product_id: String(product.id),
      product_name: product.name,
      quantity: "",
    }

    setReturnItems((prev) => [...prev, newItem])
  }

  const handleRemoveItem = (itemId: string) => {
    setReturnItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  const handleUpdateItem = (itemId: string, field: string, value: any) => {
    setReturnItems((prev) =>
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
        description: "Please provide a reason for return",
        variant: "destructive",
      })
      return
    }

    if (!toOutletId) {
      toast({
        title: "Validation Error",
        description: "Please select the destination outlet",
        variant: "destructive",
      })
      return
    }

    if (returnItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one product",
        variant: "destructive",
      })
      return
    }

    if (returnItems.some((item) => !item.quantity || Number(item.quantity) === 0)) {
      toast({
        title: "Validation Error",
        description: "All items must have a quantity",
        variant: "destructive",
      })
      return
    }

    if (returnItems.some((item) => !item.product_id)) {
      toast({
        title: "Validation Error",
        description: "All items must have a product selected",
        variant: "destructive",
      })
      return
    }

    if (!currentOutlet || !currentOutlet.id) {
      toast({
        title: "Validation Error",
        description: "Outlet is required but not selected",
        variant: "destructive",
      })
      return
    }

    const selectedDestinationOutlet = availableOutlets.find(
      (outlet) => String(outlet.id) === toOutletId
    )

    setIsSubmitting(true)
    try {
      await Promise.all(
        returnItems.map((item) => {
          const payload = {
            product_id: item.product_id,
            outlet_id: String(currentOutlet.id),
            movement_type: "transfer_out",
            quantity: Number(item.quantity),
            reason: `Returned to ${selectedDestinationOutlet?.name || "outlet"}. ${reason}`,
            reference_id: `outlet:${toOutletId}`,
          }
          return inventoryService.createMovement(payload)
        })
      )

      toast({
        title: "Success",
        description: `${returnItems.length} product${returnItems.length !== 1 ? "s" : ""} returned to outlet successfully`,
      })

      router.push("/dashboard/inventory/stock-control")
    } catch (error: any) {
      console.error("Failed to create return:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create return",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Return Stock"
        description="Move stock from this outlet back to another outlet"
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
                  <CardTitle>Return Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Outlet</Label>
                    <Input
                      disabled
                      value={currentOutlet?.name || "No outlet selected"}
                      className="bg-gray-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="toOutlet">Return To Outlet *</Label>
                    <Select value={toOutletId} onValueChange={setToOutletId}>
                      <SelectTrigger id="toOutlet">
                        <SelectValue placeholder="Select destination outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOutlets.length > 0 ? (
                          availableOutlets.map((outlet) => (
                            <SelectItem key={String(outlet.id)} value={String(outlet.id)}>
                              {outlet.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-gray-600">
                            No other outlets available
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Return *</Label>
                    <Textarea
                      id="reason"
                      placeholder="e.g., Returning stock to main branch"
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
                    Use the add button to open the product picker and add items to return to another outlet.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Items to Return ({returnItems.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {returnItems.length > 0 ? (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Product</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {returnItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.product_name}
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
                      No products added yet. Search above to add products for return.
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
                    <p className="text-sm text-gray-600">Items to Return</p>
                    <p className="text-2xl font-semibold">{returnItems.length}</p>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Return To</p>
                    <p className="text-sm text-gray-600">
                      {availableOutlets.find((outlet) => String(outlet.id) === toOutletId)?.name || "Not selected"}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Reason</p>
                    <p className="text-sm text-gray-600">{reason || "Not provided"}</p>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting || returnItems.length === 0}
                    >
                      {isSubmitting ? "Processing..." : "Return To Outlet"}
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
