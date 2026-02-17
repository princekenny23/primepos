"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, Receipt, Clock, Users, Eye, CreditCard, CheckCircle, AlertCircle } from "lucide-react"
import { useState } from "react"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import { kitchenService } from "@/lib/services/kitchenService"
import { useToast } from "@/components/ui/use-toast"
import { useTenant } from "@/contexts/tenant-context"
import { useShift } from "@/contexts/shift-context"
import { getOutletPosMode } from "@/lib/utils/outlet-settings"

export default function OrdersPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { currentBusiness, currentOutlet: businessOutlet, currentTill } = useBusinessStore()
  const { currentOutlet: tenantOutlet } = useTenant()
  const currentOutlet = tenantOutlet || businessOutlet
  const posMode = currentOutlet ? getOutletPosMode(currentOutlet, currentBusiness) : undefined
  const { activeShift } = useShift()
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("active")
  const [orders, setOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const useReal = useRealAPI()

  const loadOrders = async () => {
    if (!currentBusiness) {
      setOrders([])
      setIsLoading(false)
      return
    }
    
    if (!currentOutlet?.id) {
      toast({
        title: "Error",
        description: "Please select an outlet first",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)
    try {
      if (useReal) {
        // Use KOT model instead of Sale directly
        const filters: any = {
          outlet: currentOutlet.id.toString()
        }
        
        // Optionally filter by till if selected
        if (currentTill?.id) {
          filters.till = currentTill.id.toString()
        }
        
        const response = await kitchenService.list(filters)
        const kots = response.results || []
        
        // Transform KOT data to order format
        setOrders(kots.map((kot: any) => ({
          id: kot.id,
          kotId: kot.kot_number,
          orderId: kot.sale?.receipt_number || `ORD-${kot.id.slice(-6)}`,
          saleId: kot.sale?.id,
          table: kot.table?.number || "N/A",
          tableId: kot.table?.id,
          till: kot.till?.name || "N/A",
          tillId: kot.till?.id,
          guests: kot.sale?.guests || kot.items?.length || 0,
          items: kot.items || [],
          itemsCount: kot.items?.length || 0,
          total: parseFloat(kot.sale?.total || '0'),
          subtotal: parseFloat(kot.sale?.subtotal || '0'),
          tax: parseFloat(kot.sale?.tax || '0'),
          discount: parseFloat(kot.sale?.discount || '0'),
          // Use KOT status for kitchen workflow, Sale status for payment
          kotStatus: kot.status, // pending, preparing, ready, served, cancelled
          saleStatus: kot.sale?.status, // pending, completed, refunded, cancelled
          paymentStatus: kot.sale?.payment_status || 'paid', // unpaid, partially_paid, paid, overdue
          paymentMethod: kot.sale?.payment_method || 'cash',
          priority: kot.priority || 'normal',
          time: new Date(kot.sent_to_kitchen_at || kot.created_at).toLocaleTimeString(),
          server: kot.sale?.user?.name || kot.sale?.user?.username || "N/A",
          notes: kot.notes || kot.sale?.notes || "",
          // Timestamps
          sentToKitchenAt: kot.sent_to_kitchen_at,
          startedAt: kot.started_at,
          readyAt: kot.ready_at,
          servedAt: kot.served_at,
        })))
      } else {
        setOrders([])
      }
    } catch (error: any) {
      console.error("Failed to load orders:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load orders. Please try again.",
        variant: "destructive",
      })
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadOrders, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusiness, currentOutlet, useReal])

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.kotId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.table?.toString().includes(searchTerm) ||
      order.server?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Filter by tab using both KOT status and Sale status
    let matchesTab = false
    if (activeTab === "active") {
      // Active: pending, preparing, ready (not yet paid)
      matchesTab = ['pending', 'preparing', 'ready'].includes(order.kotStatus) && 
                   order.saleStatus !== 'completed'
    } else if (activeTab === "ready") {
      // Ready: kitchen ready but not paid
      matchesTab = order.kotStatus === 'ready' && order.saleStatus !== 'completed'
    } else if (activeTab === "completed") {
      // Completed: paid and served
      matchesTab = order.saleStatus === 'completed' || order.kotStatus === 'served'
    } else if (activeTab === "all") {
      matchesTab = true
    }

    return matchesSearch && matchesTab
  })

  const activeOrders = orders.filter(o => 
    ['pending', 'preparing', 'ready'].includes(o.kotStatus) && o.saleStatus !== 'completed'
  ).length
  const readyOrders = orders.filter(o => 
    o.kotStatus === 'ready' && o.saleStatus !== 'completed'
  ).length
  const totalRevenue = orders.filter(o => 
    o.saleStatus === 'completed' || o.kotStatus === 'served'
  ).reduce((sum, o) => sum + (o.total || 0), 0)

  const getStatusColor = (order: any) => {
    // Priority: Sale status > KOT status
    if (order.saleStatus === 'completed') {
      return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
    }
    if (order.kotStatus === 'ready') {
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
    }
    if (order.kotStatus === 'preparing') {
      return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
    }
    if (order.kotStatus === 'pending') {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
    }
    if (order.kotStatus === 'served') {
      return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200"
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-350"
  }

  const getStatusLabel = (order: any) => {
    if (order.saleStatus === 'completed') return "Completed"
    if (order.kotStatus === 'ready') return "Ready to Serve"
    if (order.kotStatus === 'preparing') return "Preparing"
    if (order.kotStatus === 'pending') return "Pending"
    if (order.kotStatus === 'served') return "Served"
    return "Unknown"
  }

  const handleViewDetails = (order: any) => {
    setSelectedOrder(order)
    setShowDetails(true)
  }

  const handleProcessPayment = async (order: any) => {
    if (!order.saleId) {
      toast({
        title: "Error",
        description: "Sale ID not found. Cannot process payment.",
        variant: "destructive",
      })
      return
    }
    
    if (!activeShift) {
      toast({
        title: "No Active Shift",
        description: "Please start a shift before processing payments.",
        variant: "destructive",
      })
      return
    }

    if (!currentOutlet) {
      toast({
        title: "Error",
        description: "Outlet not selected.",
        variant: "destructive",
      })
      return
    }

    // For existing sales, we just need to process payment
    // Show payment modal with existing sale data
    setSelectedOrder(order)
    setShowPayment(true)
  }

  const handlePaymentComplete = async () => {
    setShowPayment(false)
    setSelectedOrder(null)
    await loadOrders() // Refresh orders after payment
  }

  const canProcessPayment = (order: any) => {
    // Can process payment if:
    // 1. Order exists
    // 2. Sale exists
    // 3. Sale status is pending (not completed)
    // 4. KOT status is ready or served (food is ready)
    if (!order) return false
    return order.saleId && 
           order.saleStatus !== 'completed' && 
           (order.kotStatus === 'ready' || order.kotStatus === 'served')
  }

  // Redirect if not restaurant business
  useEffect(() => {
    if (currentBusiness && posMode !== "restaurant") {
      router.push("/dashboard")
    }
  }, [currentBusiness, posMode, router])

  // Show loading while checking business type
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
        title="Restaurant Orders"
        description="Manage orders, track service, and process payments"
      >
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeOrders}</div>
              <p className="text-xs text-muted-foreground">In kitchen or waiting</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready to Serve</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{readyOrders}</div>
              <p className="text-xs text-muted-foreground">Awaiting payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <Receipt className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {currentBusiness?.currencySymbol || "MWK"} {totalRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">From completed orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orders.length}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order ID, KOT number, table, or server..."
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
              Manage restaurant orders, track kitchen status, and process payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="ready">Ready to Serve</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>KOT</TableHead>
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
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          <p className="text-muted-foreground">Loading orders...</p>
                        </TableCell>
                      </TableRow>
                    ) : filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          <p className="text-muted-foreground">No orders found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.orderId}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{order.kotId}</TableCell>
                          <TableCell>Table {order.table}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              {order.guests}
                            </div>
                          </TableCell>
                          <TableCell>{order.itemsCount}</TableCell>
                          <TableCell className="font-semibold">
                            {currentBusiness?.currencySymbol || "MWK"} {order.total.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(order)}>
                              {getStatusLabel(order)}
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
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleViewDetails(order)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              {canProcessPayment(order) && (
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => handleProcessPayment(order)}
                                >
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Pay
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </PageLayout>

      {/* Order Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              {selectedOrder?.orderId} - Table {selectedOrder?.table}
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">KOT Number</p>
                  <p className="text-sm">{selectedOrder.kotId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(selectedOrder)}>
                    {getStatusLabel(selectedOrder)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Table</p>
                  <p className="text-sm">Table {selectedOrder.table}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Guests</p>
                  <p className="text-sm">{selectedOrder.guests}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Server</p>
                  <p className="text-sm">{selectedOrder.server}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Time</p>
                  <p className="text-sm">{selectedOrder.time}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Items</p>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="text-sm font-medium">
                          {item.quantity}x {item.product_name || item.name}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground italic">{item.notes}</p>
                        )}
                      </div>
                      <Badge variant={
                        item.kitchen_status === 'ready' ? 'default' :
                        item.kitchen_status === 'preparing' ? 'secondary' :
                        'outline'
                      }>
                        {item.kitchen_status === 'pending' ? 'Pending' :
                         item.kitchen_status === 'preparing' ? 'Preparing' :
                         item.kitchen_status === 'ready' ? 'Ready' :
                         item.kitchen_status === 'served' ? 'Served' : 'Cancelled'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{currentBusiness?.currencySymbol || "MWK"} {selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{currentBusiness?.currencySymbol || "MWK"} {selectedOrder.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Discount</span>
                  <span>{currentBusiness?.currencySymbol || "MWK"} {selectedOrder.discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>{currentBusiness?.currencySymbol || "MWK"} {selectedOrder.total.toFixed(2)}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {canProcessPayment(selectedOrder) && (
              <Button onClick={() => {
                setShowDetails(false)
                handleProcessPayment(selectedOrder)
              }}>
                <CreditCard className="h-4 w-4 mr-2" />
                Process Payment
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal removed - new payment system will be implemented */}
    </DashboardLayout>
  )
}
