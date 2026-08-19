"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, UserPlus, CheckCircle, XCircle, Clock, ShoppingCart } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"
import { purchaseOrderService, type PurchaseOrder, type PurchaseOrderItem } from "@/lib/services/purchaseOrderService"
import { AssignSupplierModal } from "@/components/modals/assign-supplier-modal"

export default function PurchaseOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const poId = params.id as string
  
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<PurchaseOrderItem | null>(null)

  useEffect(() => {
    if (poId) {
      loadPurchaseOrder()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId])

  const loadPurchaseOrder = async () => {
    try {
      setLoading(true)
      const po = await purchaseOrderService.get(poId)
      setPurchaseOrder(po)
    } catch (error: any) {
      console.error("Failed to load purchase order:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load purchase order",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAssignSupplier = (item: PurchaseOrderItem) => {
    setSelectedItem(item)
    setAssignModalOpen(true)
  }

  const handleSupplierAssigned = () => {
    loadPurchaseOrder()
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      draft: { bg: "bg-gray-100", text: "text-gray-800", icon: Clock, label: "Draft" },
      pending_supplier: { bg: "bg-orange-100", text: "text-orange-800", icon: Clock, label: "Needs Supplier" },
      pending: { bg: "bg-yellow-100", text: "text-yellow-800", icon: Clock, label: "Pending" },
      approved: { bg: "bg-blue-100", text: "text-blue-800", icon: CheckCircle, label: "Approved" },
      ready_to_order: { bg: "bg-indigo-100", text: "text-indigo-800", icon: CheckCircle, label: "Ready to Order" },
      ordered: { bg: "bg-purple-100", text: "text-purple-800", icon: ShoppingCart, label: "Ordered" },
      received: { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle, label: "Received" },
      partial: { bg: "bg-orange-100", text: "text-orange-800", icon: Clock, label: "Partial" },
      cancelled: { bg: "bg-red-100", text: "text-red-800", icon: XCircle, label: "Cancelled" },
    }
    
    const config = statusConfig[status] || statusConfig.draft
    const Icon = config.icon
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${config.bg} ${config.text}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading purchase order...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (!purchaseOrder) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Purchase order not found</p>
        </div>
      </DashboardLayout>
    )
  }

  const itemsNeedingSupplier = purchaseOrder.items.filter(
    item => !item.supplier || item.supplier_status === 'no_supplier'
  )

  return (
    <DashboardLayout>
      <PageLayout
        title={purchaseOrder.po_number}
        description="Purchase Order Details"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/inventory/suppliers/purchases">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            {getStatusBadge(purchaseOrder.status)}
          </div>
        }
      >

        {/* PO Header Info */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier:</span>
                <span className="font-medium">
                  {purchaseOrder.supplier?.name || (
                    <span className="text-orange-600 italic">No Supplier Assigned</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outlet:</span>
                <span className="font-medium">{purchaseOrder.outlet?.name || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Date:</span>
                <span className="font-medium">
                  {new Date(purchaseOrder.order_date).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">MWK {parseFloat(purchaseOrder.subtotal || "0").toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax:</span>
                <span className="font-medium">MWK {parseFloat(purchaseOrder.tax || "0").toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount:</span>
                <span className="font-medium">MWK {parseFloat(purchaseOrder.discount || "0").toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span>MWK {parseFloat(purchaseOrder.total || "0").toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items Needing Supplier Alert */}
        {itemsNeedingSupplier.length > 0 && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                <UserPlus className="h-5 w-5" />
                Items Needing Supplier
              </CardTitle>
              <CardDescription>
                {itemsNeedingSupplier.length} item{itemsNeedingSupplier.length !== 1 ? "s" : ""} need supplier assignment
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>
              {purchaseOrder.items.length} item{purchaseOrder.items.length !== 1 ? "s" : ""} in this order
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrder.items.length === 0 ? (
                  <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No items in this purchase order
                    </TableCell>
                  </TableRow>
                ) : (
                  purchaseOrder.items.map((item) => {
                    const productName = item.product?.name || item.variation?.product?.name || "Unknown"
                    const variationName = item.variation?.name
                    const hasSupplier = item.supplier && item.supplier_status === 'supplier_assigned'
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{productName}</div>
                            {variationName && (
                              <div className="text-sm text-muted-foreground">{variationName}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          {item.received_quantity}
                        </TableCell>
                        <TableCell>MWK {parseFloat(item.unit_price || "0").toFixed(2)}</TableCell>
                        <TableCell>MWK {parseFloat(item.total || "0").toFixed(2)}</TableCell>
                        <TableCell>
                          {hasSupplier ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {item.supplier?.name || "Assigned"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-orange-300 text-orange-700 dark:text-orange-400">
                              <XCircle className="h-3 w-3 mr-1" />
                              No Supplier
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!hasSupplier && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignSupplier(item)}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Assign Supplier
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Notes */}
        {purchaseOrder.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{purchaseOrder.notes}</p>
            </CardContent>
          </Card>
        )}

        <AssignSupplierModal
          open={assignModalOpen}
          onOpenChange={setAssignModalOpen}
          item={selectedItem}
          poId={poId}
          onSupplierAssigned={handleSupplierAssigned}
        />
      </PageLayout>
    </DashboardLayout>
  )
}

