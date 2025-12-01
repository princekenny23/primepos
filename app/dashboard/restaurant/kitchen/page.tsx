"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, Printer, CheckCircle, AlertCircle } from "lucide-react"
import { useState } from "react"
import { KitchenOrderTicketModal } from "@/components/modals/kitchen-order-ticket-modal"

export default function KitchenPage() {
  const [showKOT, setShowKOT] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("pending")

  // Mock kitchen orders (KOT - Kitchen Order Tickets)
  const kitchenOrders = [
    {
      id: "1",
      orderId: "#ORD-001",
      table: 1,
      time: "10:30",
      items: [
        { name: "Burger", quantity: 2, notes: "No onions", status: "Pending" },
        { name: "Fries", quantity: 1, notes: "", status: "Preparing" },
        { name: "Salad", quantity: 1, notes: "Extra dressing", status: "Pending" },
      ],
      priority: "Normal",
    },
    {
      id: "2",
      orderId: "#ORD-002",
      table: 4,
      time: "11:15",
      items: [
        { name: "Pizza", quantity: 1, notes: "Thin crust", status: "Preparing" },
        { name: "Pasta", quantity: 2, notes: "", status: "Pending" },
      ],
      priority: "High",
    },
    {
      id: "3",
      orderId: "#ORD-003",
      table: 6,
      time: "09:45",
      items: [
        { name: "Steak", quantity: 3, notes: "Medium rare", status: "Ready" },
        { name: "Soup", quantity: 3, notes: "", status: "Ready" },
      ],
      priority: "Normal",
    },
  ]

  const pendingOrders = kitchenOrders.filter(o => 
    o.items.some(item => item.status === "Pending" || item.status === "Preparing")
  )
  const readyOrders = kitchenOrders.filter(o => 
    o.items.every(item => item.status === "Ready")
  )

  const filteredOrders = activeTab === "pending" ? pendingOrders : readyOrders

  const handleItemStatusChange = (orderId: string, itemName: string, newStatus: string) => {
    // In production, this would call API
  }

  const handlePrintKOT = (order: any) => {
    setSelectedOrder(order)
    setShowKOT(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Kitchen Display</h1>
            <p className="text-muted-foreground">Kitchen Order Tickets (KOT) management</p>
          </div>
        </div>

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
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-3 border rounded-lg ${
                            item.status === "Ready" ? "bg-green-50 dark:bg-green-950 border-green-200" :
                            item.status === "Preparing" ? "bg-orange-50 dark:bg-orange-950 border-orange-200" :
                            "bg-gray-50 dark:bg-gray-950"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-medium">
                              {item.quantity}x {item.name}
                            </div>
                            <Badge
                              variant={
                                item.status === "Ready" ? "default" :
                                item.status === "Preparing" ? "secondary" :
                                "outline"
                              }
                            >
                              {item.status}
                            </Badge>
                          </div>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground italic">
                              Note: {item.notes}
                            </p>
                          )}
                          <div className="flex gap-2 mt-2">
                            {item.status === "Pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleItemStatusChange(order.id, item.name, "Preparing")}
                              >
                                Start
                              </Button>
                            )}
                            {item.status === "Preparing" && (
                              <Button
                                size="sm"
                                onClick={() => handleItemStatusChange(order.id, item.name, "Ready")}
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <KitchenOrderTicketModal
        open={showKOT}
        onOpenChange={setShowKOT}
        order={selectedOrder}
      />
    </DashboardLayout>
  )
}

