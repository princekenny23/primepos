"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageCard } from "@/components/layouts/page-card"
import { PageHeader } from "@/components/layouts/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { storefrontService, type StorefrontOrder, type StorefrontAdmin } from "@/lib/services/storefrontService"
import { CheckCircle2, ClipboardList, Eye, Loader2, MoreHorizontal, RefreshCw, XCircle } from "lucide-react"

const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  cancelled: "destructive",
  completed: "default",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default function StorefrontOrdersPage() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<StorefrontOrder[]>([])
  const [sites, setSites] = useState<StorefrontAdmin[]>([])
  const [selectedSiteSlug, setSelectedSiteSlug] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)
  const [updatingRef, setUpdatingRef] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<StorefrontOrder | null>(null)

  const loadOrders = async (siteSlug?: string) => {
    setIsLoading(true)
    try {
      const data = await storefrontService.listOrders(siteSlug)
      setOrders(data)
    } catch (err: any) {
      toast({
        title: "Failed to load orders",
        description: err.message || "Orders could not be loaded.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadSites = async () => {
    try {
      const data = await storefrontService.listStorefronts()
      setSites(data)
    } catch {
      // non-blocking for orders page
    }
  }

  const handleUpdateStatus = async (
    publicOrderRef: string,
    status: "pending" | "confirmed" | "cancelled"
  ) => {
    setUpdatingRef(publicOrderRef)
    try {
      const updatedOrder = await storefrontService.updateOrderStatus(publicOrderRef, status)
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.public_order_ref === publicOrderRef ? updatedOrder : order
        )
      )
      toast({
        title: "Order updated",
        description: `Order ${publicOrderRef} marked as ${status}.`,
      })
    } catch (err: any) {
      toast({
        title: "Failed to update order",
        description: err.message || "The order status could not be updated.",
        variant: "destructive",
      })
    } finally {
      setUpdatingRef(null)
    }
  }

  useEffect(() => {
    loadSites()
  }, [])

  useEffect(() => {
    const slug = selectedSiteSlug === "all" ? undefined : selectedSiteSlug
    loadOrders(slug)
  }, [])

  const filteredOrders = orders.filter((order) => {
    const q = search.trim().toLowerCase()
    const matchesSearch =
      q.length === 0 ||
      order.public_order_ref.toLowerCase().includes(q) ||
      order.customer_name.toLowerCase().includes(q) ||
      (order.customer_phone || "").toLowerCase().includes(q)

    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <DashboardLayout>
      <PageCard className="mt-6">
        <PageHeader title="Online Orders" />

        <div className="mb-4 mt-4 grid gap-3 md:grid-cols-4">
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="orders-search">Search</Label>
            <Input
              id="orders-search"
              placeholder="Order ref, customer, or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="orders-site">Site</Label>
            <Select
              value={selectedSiteSlug}
              onValueChange={(value) => {
                setSelectedSiteSlug(value)
                const slug = value === "all" ? undefined : value
                loadOrders(slug)
              }}
            >
              <SelectTrigger id="orders-site">
                <SelectValue placeholder="All sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sites</SelectItem>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.slug}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="orders-status">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="orders-status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-end">
          <Button
            variant="outline"
            size="icon"
            onClick={() => loadOrders(selectedSiteSlug === "all" ? undefined : selectedSiteSlug)}
            disabled={isLoading}
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {isLoading && orders.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p>No matching online orders.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Order Ref</th>
                  <th className="px-3 py-2 text-left font-medium">Customer</th>
                  <th className="px-3 py-2 text-left font-medium">Phone</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Channel</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.public_order_ref} className="border-b transition-colors hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono text-xs">{order.public_order_ref}</td>
                    <td className="px-3 py-2 font-medium">{order.customer_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{order.customer_phone || "-"}</td>
                    <td className="px-3 py-2 text-right font-medium">{order.total}</td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_VARIANT[order.status] ?? "outline"} className="capitalize text-xs">
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">{order.channel}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(order.created_at)}</td>
                    <td className="px-3 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Order actions">
                            {updatingRef === order.public_order_ref ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Order
                          </DropdownMenuItem>
                          {order.status === "pending" && (
                            <DropdownMenuItem
                              onClick={() => handleUpdateStatus(order.public_order_ref, "confirmed")}
                              disabled={updatingRef === order.public_order_ref}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                              Confirm
                            </DropdownMenuItem>
                          )}
                          {(order.status === "pending" || order.status === "confirmed") && (
                            <DropdownMenuItem
                              onClick={() => handleUpdateStatus(order.public_order_ref, "cancelled")}
                              disabled={updatingRef === order.public_order_ref}
                            >
                              <XCircle className="mr-2 h-4 w-4 text-destructive" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={Boolean(selectedOrder)} onOpenChange={(open) => !open && setSelectedOrder(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Order {selectedOrder?.public_order_ref}</DialogTitle>
              <DialogDescription>View storefront order details.</DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <div className="grid gap-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedOrder.customer_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <p className="text-muted-foreground">Phone</p>
                  <p>{selectedOrder.customer_phone || "-"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <p className="text-muted-foreground">Status</p>
                  <p className="capitalize">{selectedOrder.status}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <p className="text-muted-foreground">Channel</p>
                  <p className="capitalize">{selectedOrder.channel}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-semibold">{selectedOrder.total}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <p className="text-muted-foreground">Receipt</p>
                  <p>{selectedOrder.receipt_number || "-"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <p className="text-muted-foreground">Created</p>
                  <p>{formatDate(selectedOrder.created_at)}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageCard>
    </DashboardLayout>
  )
}
