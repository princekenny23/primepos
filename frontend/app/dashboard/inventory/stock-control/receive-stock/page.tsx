"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { inventoryService } from "@/lib/services/inventoryService"
import { useBusinessStore } from "@/stores/businessStore"
import { outletService } from "@/lib/services/outletService"
import type { Product } from "@/lib/types"
import { SelectProductModal } from "@/components/modals/select-product-modal"

interface ReceiveItem {
  id: string
  product_id: string
  product_name?: string
  quantity: string
}

export default function ReceiveStockPage() {
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
        console.error("[receive-stock] Failed to load outlets:", err)
        if (storeOutlets.length > 0) setAllOutlets(storeOutlets)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableOutlets = allOutlets.filter(
    (outlet) => String(outlet.id) !== String(currentOutlet?.id)
  )

  const [fromOutletId, setFromOutletId] = useState("")
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([])
  const [showProductSelector, setShowProductSelector] = useState(false)

  const handleAddItem = (product: Product) => {
    if (receiveItems.some((item) => item.product_id === String(product.id))) {
      toast({
        title: "Item already added",
        description: "This product is already in the receiving list",
      })
      return
    }

    const newItem: ReceiveItem = {
      id: String(Date.now()),
      product_id: String(product.id),
      product_name: product.name,
      quantity: "",
    }

    setReceiveItems((prev) => [...prev, newItem])
  }

  const handleRemoveItem = (itemId: string) => {
    setReceiveItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  const handleUpdateItem = (itemId: string, field: string, value: any) => {
    setReceiveItems((prev) =>
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

    const selectedSourceOutlet = availableOutlets.find((outlet) => String(outlet.id) === fromOutletId)

    if (!fromOutletId) {
      toast({
        title: "Validation Error",
        description: "Please select the source outlet",
        variant: "destructive",
      })
      return
    }

    if (receiveItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one product",
        variant: "destructive",
      })
      return
    }

    if (receiveItems.some((item) => !item.quantity || Number(item.quantity) === 0)) {
      toast({
        title: "Validation Error",
        description: "All items must have a quantity",
        variant: "destructive",
      })
      return
    }

    if (receiveItems.some((item) => !item.product_id)) {
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

    setIsSubmitting(true)
    try {
      // Create receive movements
      await Promise.all(
        receiveItems.map((item) => {
          const payload = {
            product_id: item.product_id,
            outlet_id: String(currentOutlet.id),
            movement_type: "transfer_in",
            quantity: Number(item.quantity),
            reason: `Received from outlet ${selectedSourceOutlet?.name || fromOutletId}`,
            reference_id: `outlet:${fromOutletId}`,
          }
          console.log("Creating receive movement with payload:", payload)
          return inventoryService.createMovement(payload)
        })
      )

      toast({
        title: "Success",
        description: `${receiveItems.length} product${receiveItems.length !== 1 ? "s" : ""} received successfully`,
      })

      router.push("/dashboard/inventory/stock-control")
    } catch (error: any) {
      console.error("Failed to receive stock:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to receive stock",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Receive Stock"
        description="Record incoming inventory from another outlet"
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
                  <CardTitle>Receiving Details</CardTitle>
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
                    <Label htmlFor="fromOutlet">From Outlet *</Label>
                    <Select value={fromOutletId} onValueChange={setFromOutletId}>
                      <SelectTrigger id="fromOutlet">
                        <SelectValue placeholder="Select source outlet" />
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
                    Use the add button to open the product picker and add items to this receiving batch.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Items to Receive ({receiveItems.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {receiveItems.length > 0 ? (
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
                          {receiveItems.map((item) => {
                            return (
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
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-600">
                      No products added yet. Search above to add products for receiving.
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
                    <p className="text-sm text-gray-600">Items to Receive</p>
                    <p className="text-2xl font-semibold">{receiveItems.length}</p>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600">Receive From</p>
                    <p className="text-base font-semibold">
                      {availableOutlets.find((outlet) => String(outlet.id) === fromOutletId)?.name || "Select outlet"}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Outlet</p>
                    <p className="text-sm text-gray-600">
                      {currentOutlet?.name || "No outlet"}
                    </p>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting || receiveItems.length === 0}
                    >
                      {isSubmitting ? "Receiving..." : "Receive Stock"}
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
