"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
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
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Search, Receipt, Clock, Users } from "lucide-react"
import { useState } from "react"
import { AddOrderModal } from "@/components/modals/add-order-modal"

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [activeTab, setActiveTab] = useState("active")

  // Mock orders data
  const orders = [
    {
      id: "1",
      orderId: "#ORD-001",
      table: 1,
      guests: 3,
      items: 4,
      total: 125.50,
      status: "Active",
      time: "10:30",
      server: "John Waiter",
    },
    {
      id: "2",
      orderId: "#ORD-002",
      table: 4,
      guests: 4,
      items: 6,
      total: 189.99,
      status: "Active",
      time: "11:15",
      server: "Jane Server",
    },
    {
      id: "3",
      orderId: "#ORD-003",
      table: 6,
      guests: 6,
      items: 8,
      total: 245.75,
      status: "Preparing",
      time: "09:45",
      server: "Bob Staff",
    },
    {
      id: "4",
      orderId: "#ORD-004",
      table: 8,
      guests: 2,
      items: 3,
      total: 67.50,
      status: "Completed",
      time: "11:30",
      server: "Alice Waiter",
    },
  ]

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.table.toString().includes(searchTerm) ||
      order.server.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesTab = 
      activeTab === "active" && (order.status === "Active" || order.status === "Preparing") ||
      activeTab === "completed" && order.status === "Completed" ||
      activeTab === "all"

    return matchesSearch && matchesTab
  })

  const activeOrders = orders.filter(o => o.status === "Active" || o.status === "Preparing").length
  const totalRevenue = orders.filter(o => o.status === "Completed").reduce((sum, o) => sum + o.total, 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
      case "Preparing":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
      case "Completed":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
      default:
        return ""
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Orders</h1>
            <p className="text-muted-foreground">Manage restaurant orders and service</p>
          </div>
          <Button onClick={() => setShowAddOrder(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orders.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">MWK {totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Order Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">45 min</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order ID, table, or server..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Orders</CardTitle>
            <CardDescription>
              Manage restaurant orders and track service
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Guests</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Server</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.orderId}</TableCell>
                        <TableCell>Table {order.table}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {order.guests}
                          </div>
                        </TableCell>
                        <TableCell>{order.items}</TableCell>
                        <TableCell className="font-semibold">
                          MWK {order.total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.server}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {order.time}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <AddOrderModal
        open={showAddOrder}
        onOpenChange={setShowAddOrder}
      />
    </DashboardLayout>
  )
}

