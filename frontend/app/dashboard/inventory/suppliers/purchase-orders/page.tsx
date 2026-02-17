"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Search, ShoppingCart, CheckCircle, XCircle, Clock } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

import { purchaseOrderService } from "@/lib/services/purchaseOrderService"
import { useBusinessStore } from "@/stores/businessStore"

export default function PurchaseOrdersPage() {
  const { toast } = useToast()
  const { currentOutlet } = useBusinessStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    purchaseOrderService.list({
      outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
    })
      .then((response) => setPurchaseOrders(response.results))
      .catch((error) => {
        console.error("Failed to load purchase orders:", error)
        toast({
          title: "Error",
          description: "Failed to load purchase orders",
          variant: "destructive",
        })
      })
      .finally(() => setLoading(false))
  }, [currentOutlet?.id, toast])

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

  return (
    <DashboardLayout>
      <PageLayout
        title="Purchase Orders"
        description="Create and manage purchase orders from suppliers"
        actions={
          <Link href="/dashboard/inventory/suppliers/purchase-orders/new">
            <Button className="bg-white border-white text-[#1e3a8a] hover:bg-blue-50 hover:border-blue-50">
              <Plus className="mr-2 h-4 w-4" />
              New Purchase Order
            </Button>
          </Link>
        }
      >
        {/* Filters */}
        <div className="mb-6 pb-4 border-b border-gray-300">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search purchase orders..."
                className="pl-10 bg-white border-gray-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Purchase Orders Table */}
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">All Purchase Orders</h3>
            <p className="text-sm text-gray-600">
              {purchaseOrders.length} purchase order{purchaseOrders.length !== 1 ? "s" : ""} found
            </p>
          </div>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No purchase orders found. Create your first purchase order to get started.</p>
            </div>
          ) : (
            <div className="rounded-md border border-gray-300 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-gray-900 font-semibold">PO Number</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Supplier</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Order Date</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Expected Delivery</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Total</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id} className="border-gray-300">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {po.po_number}
                          {po.status === 'pending_supplier' && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800">
                              Needs Supplier
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {po.supplier?.name || (
                          <span className="text-gray-600 italic">No Supplier</span>
                        )}
                      </TableCell>
                      <TableCell>{new Date(po.order_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {po.expected_delivery_date
                          ? new Date(po.expected_delivery_date).toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                      <TableCell>${po.total?.toFixed(2) || "0.00"}</TableCell>
                      <TableCell>{getStatusBadge(po.status)}</TableCell>
                      <TableCell>
                        <Link href={`/dashboard/inventory/suppliers/purchase-orders/${po.id}`}>
                          <Button variant="ghost" size="sm" className="border-gray-300">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </PageLayout>
    </DashboardLayout>
  )
}

