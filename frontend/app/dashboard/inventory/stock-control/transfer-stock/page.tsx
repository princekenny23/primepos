"use client"

import { useState, useMemo } from "react"
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

interface TransferItem {
  id: string
  product_id: string
  product_name?: string
  current_qty: number
  quantity: string
}

export default function TransferStockPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { currentOutlet, outlets } = useBusinessStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [toOutlet, setToOutlet] = useState("")
  const [reason, setReason] = useState("")
  const [transferItems, setTransferItems] = useState<TransferItem[]>([])
  const [showProductSelector, setShowProductSelector] = useState(false)

  const availableOutlets = useMemo(() => {
    return outlets.filter((o) => String(o.id) !== String(currentOutlet?.id))
  }, [outlets, currentOutlet?.id])

  const handleAddItem = (product: Product) => {
    if (transferItems.some((item) => item.product_id === String(product.id))) {
      toast({
        title: "Item already added",
        description: "This product is already in the transfer list",
      })
      return
    }

    const newItem: TransferItem = {
      id: String(Date.now()),
      product_id: String(product.id),
      product_name: product.name,
      current_qty: product.stock || 0,
      quantity: "",
    }

    setTransferItems((prev) => [...prev, newItem])
  }

  const handleRemoveItem = (itemId: string) => {
    setTransferItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  const handleUpdateItem = (itemId: string, field: string, value: any) => {
    setTransferItems((prev) =>
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
        description: "Please select a source outlet",
        variant: "destructive",
      })
      return
    }

    if (!toOutlet) {
      toast({
        title: "Validation Error",
        description: "Please select a destination outlet",
        variant: "destructive",
      })
      return
    }

    if (transferItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one product to transfer",
        variant: "destructive",
      })
      return
    }

    if (transferItems.some((item) => !item.quantity || Number(item.quantity) === 0)) {
      toast({
        title: "Validation Error",
        description: "All items must have a quantity",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      await Promise.all(
        transferItems.map((item) =>
          inventoryService.createMovement({
            product_id: item.product_id,
            outlet_id: String(currentOutlet.id),
            movement_type: "transfer_out",
            quantity: Number(item.quantity),
            reason: `Transfer to ${availableOutlets.find((o) => String(o.id) === toOutlet)?.name || "outlet"}`,
            reference_id: toOutlet,
          })
        )
      )

      toast({
        title: "Success",
        description: `${transferItems.length} product${transferItems.length !== 1 ? "s" : ""} transferred successfully`,
      })

      router.push("/dashboard/inventory/stock-control")
    } catch (error: any) {
      console.error("Failed to transfer stock:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to transfer stock",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Transfer Stock"
        description="Transfer inventory between outlets"
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
                  <CardTitle>Transfer Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>From Outlet</Label>
                    <Input
                      disabled
                      value={currentOutlet?.name || "No outlet selected"}
                      className="bg-gray-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="toOutlet">To Outlet *</Label>
                    <Select value={toOutlet} onValueChange={setToOutlet}>
                      <SelectTrigger id="toOutlet">
                        <SelectValue placeholder="Select destination outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOutlets.length > 0 ? (
                          availableOutlets.map((outlet) => (
                            <SelectItem key={outlet.id} value={String(outlet.id)}>
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
                    <Label htmlFor="reason">Reason for Transfer</Label>
                    <Textarea
                      id="reason"
                      placeholder="e.g., Rebalancing stock, high demand at destination..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
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
                    Use the add button to open the product picker and add items to this transfer.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Items to Transfer ({transferItems.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {transferItems.length > 0 ? (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Product</TableHead>
                            <TableHead>Current Qty</TableHead>
                            <TableHead>Quantity to Transfer</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transferItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.product_name}
                              </TableCell>
                              <TableCell>{item.current_qty}</TableCell>
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
                      No products added yet. Search above to add products for transfer.
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
                    <p className="text-sm text-gray-600">Items to Transfer</p>
                    <p className="text-2xl font-semibold">{transferItems.length}</p>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">From</p>
                    <p className="text-sm text-gray-600">
                      {currentOutlet?.name || "No outlet"}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">To</p>
                    <p className="text-sm text-gray-600">
                      {toOutlet
                        ? availableOutlets.find((o) => String(o.id) === toOutlet)?.name ||
                          "Unknown outlet"
                        : "Not selected"}
                    </p>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting || transferItems.length === 0 || !toOutlet}
                    >
                      {isSubmitting ? "Transferring..." : "Transfer Stock"}
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
