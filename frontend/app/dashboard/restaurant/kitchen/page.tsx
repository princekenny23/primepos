"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, Printer, CheckCircle, AlertCircle } from "lucide-react"
import { useState } from "react"
import { KitchenOrderTicketModal } from "@/components/modals/kitchen-order-ticket-modal"
import { kitchenService } from "@/lib/services/kitchenService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import { useToast } from "@/components/ui/use-toast"
import { getOutletPosMode } from "@/lib/utils/outlet-settings"

export default function KitchenPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const posMode = getOutletPosMode(currentOutlet, currentBusiness)
  const [showKOT, setShowKOT] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("pending")
  const [kitchenOrders, setKitchenOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const useReal = useRealAPI()
  
  // Redirect if not restaurant business
  useEffect(() => {
    if (currentBusiness && posMode !== "restaurant") {
      router.push("/dashboard")
    }
  }, [currentBusiness, posMode, router])
  
  const loadKitchenOrders = async () => {
    if (!currentBusiness) {
      setKitchenOrders([])
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)
    try {
      if (useReal) {
        const filters: any = {}
        if (currentOutlet?.id) {
          filters.outlet = currentOutlet.id.toString()
        }
        
        const response = await kitchenService.list(filters)
        const orders = response.results || []
        
        setKitchenOrders(orders.map((kot: any) => ({
          id: kot.id,
          kotId: kot.kot_number,
          orderId: kot.sale?.receipt_number || `ORD-${kot.id.slice(-6)}`,
          table: kot.table?.number || "N/A",
          time: new Date(kot.sent_to_kitchen_at).toLocaleTimeString(),
          items: kot.items || [],
          priority: kot.priority || "normal",
          status: kot.status,
        })))
      } else {
        setKitchenOrders([])
      }
    } catch (error: any) {
      console.error("Failed to load kitchen orders:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load kitchen orders. Please try again.",
        variant: "destructive",
      })
      setKitchenOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadKitchenOrders()
    // Refresh every 30 seconds
    const interval = setInterval(loadKitchenOrders, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusiness, currentOutlet, useReal])

  const pendingOrders = kitchenOrders.filter(o => 
    o.status === "pending" || o.status === "preparing" ||
    o.items.some((item: any) => item.kitchen_status === "pending" || item.kitchen_status === "preparing")
  )
  const readyOrders = kitchenOrders.filter(o => 
    o.status === "ready" ||
    o.items.every((item: any) => item.kitchen_status === "ready" || item.kitchen_status === "served")
  )

  const filteredOrders = activeTab === "pending" ? pendingOrders : readyOrders

  const handleItemStatusChange = async (kotId: string, itemId: string, newStatus: string) => {
    try {
      if (useReal) {
        await kitchenService.updateItemStatus(kotId, itemId, newStatus)
        toast({
          title: "Status Updated",
          description: "Item status has been updated successfully.",
        })
        // Reload orders
        await loadKitchenOrders()
      }
    } catch (error: any) {
      console.error("Failed to update item status:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update item status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePrintKOT = (order: any) => {
    setSelectedOrder(order)
    setShowKOT(true)
  }

  if (!currentBusiness || posMode !== "restaurant") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Kitchen Display"
        description="Kitchen Order Tickets (KOT) management"
      >

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingOrders.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready Orders</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{readyOrders.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kitchenOrders.reduce((sum, o) => sum + o.items.length, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Prep Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">18 min</div>
            </CardContent>
          </Card>
        </div>

        {/* Kitchen Orders */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="ready">Ready</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading kitchen orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No {activeTab === "pending" ? "pending" : "ready"} orders</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredOrders.map((order) => (
                <Card key={order.id} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{order.orderId}</CardTitle>
                        <CardDescription>Table {order.table} • {order.time}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge
                          variant={order.priority === "High" ? "destructive" : "outline"}
                        >
                          {order.priority}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePrintKOT(order)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {order.items.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 border rounded-lg ${
                            item.kitchen_status === "ready" ? "bg-green-50 dark:bg-green-950 border-green-200" :
                            item.kitchen_status === "preparing" ? "bg-orange-50 dark:bg-orange-950 border-orange-200" :
                            "bg-gray-50 dark:bg-gray-950"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-medium">
                              {item.quantity}x {item.product_name || item.name}
                            </div>
                            <Badge
                              variant={
                                item.kitchen_status === "ready" ? "default" :
                                item.kitchen_status === "preparing" ? "secondary" :
                                "outline"
                              }
                            >
                              {item.kitchen_status === "pending" ? "Pending" :
                               item.kitchen_status === "preparing" ? "Preparing" :
                               item.kitchen_status === "ready" ? "Ready" :
                               item.kitchen_status === "served" ? "Served" : "Cancelled"}
                            </Badge>
                          </div>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground italic">
                              Note: {item.notes}
                            </p>
                          )}
                          <div className="flex gap-2 mt-2">
                            {item.kitchen_status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleItemStatusChange(order.id, item.id, "preparing")}
                              >
                                Start
                              </Button>
                            )}
                            {item.kitchen_status === "preparing" && (
                              <Button
                                size="sm"
                                onClick={() => handleItemStatusChange(order.id, item.id, "ready")}
                              >
                                Mark Ready
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageLayout>

      {/* Modals */}
      <KitchenOrderTicketModal
        open={showKOT}
        onOpenChange={setShowKOT}
        order={selectedOrder}
      />
    </DashboardLayout>
  )
}

