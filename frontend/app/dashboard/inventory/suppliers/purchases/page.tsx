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
import { Badge } from "@/components/ui/badge"
import { Plus, Search, ShoppingCart, CheckCircle, XCircle, Clock, RotateCcw, Package, MoreHorizontal, Eye, ThumbsUp, Ban } from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"
import { purchaseOrderService } from "@/lib/services/purchaseOrderService"
import { purchaseReturnService } from "@/lib/services/purchaseReturnService"
import { reportService } from "@/lib/services/reportService"
import { DateRangeFilter } from "@/components/dashboard/date-range-filter"
import { FilterableTabs, TabsContent, type TabConfig } from "@/components/ui/filterable-tabs"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import { format } from "date-fns"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function PurchasesPage() {
  const { toast } = useToast()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const useReal = useRealAPI()
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("orders")
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [loadingReturns, setLoadingReturns] = useState(true)
  const [summary, setSummary] = useState({ total_purchases: 0, purchase_count: 0, items_purchased: 0 })
  const [selectedRange, setSelectedRange] = useState<{ start?: Date; end?: Date }>(() => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 29)
    return { start, end }
  })

  const formatDate = (date?: Date) => date ? date.toISOString().slice(0, 10) : undefined

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get("created") === "1") {
      const purchaseNumber = searchParams.get("purchase") || "Purchase"
      toast({ title: "Purchase created", description: `${purchaseNumber} was created successfully.` })
      window.history.replaceState({}, "", "/dashboard/inventory/suppliers/purchases")
    }
  }, [toast])

  const loadPurchaseOrders = useCallback(async () => {
    if (!currentBusiness || !currentOutlet) {
      setPurchaseOrders([])
      setLoadingOrders(false)
      return
    }

    setLoadingOrders(true)
    try {
      if (useReal) {
        const response = await purchaseOrderService.list({
          outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
        })
        setPurchaseOrders(response.results || response || [])
      } else {
        setPurchaseOrders([])
      }
    } catch (error) {
      console.error("Failed to load purchase orders:", error)
      toast({
        title: "Error",
        description: "Failed to load purchase orders",
        variant: "destructive",
      })
      setPurchaseOrders([])
    } finally {
      setLoadingOrders(false)
    }
  }, [currentBusiness, currentOutlet, useReal, toast])

  const loadPurchaseReturns = useCallback(async () => {
    if (!currentBusiness || !currentOutlet) {
      setPurchaseReturns([])
      setLoadingReturns(false)
      return
    }

    setLoadingReturns(true)
    try {
      if (useReal) {
        const response = await purchaseReturnService.list({ outlet: currentOutlet.id })
        setPurchaseReturns(response.results || [])
      } else {
        setPurchaseReturns([])
      }
    } catch (error) {
      console.error("Failed to load purchase returns:", error)
      toast({
        title: "Error",
        description: "Failed to load purchase returns",
        variant: "destructive",
      })
      setPurchaseReturns([])
    } finally {
      setLoadingReturns(false)
    }
  }, [currentBusiness, currentOutlet, useReal, toast])

  useEffect(() => {
    reportService.getPurchasesSummary({
      outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
      start_date: formatDate(selectedRange.start),
      end_date: formatDate(selectedRange.end),
    })
      .then(setSummary)
      .catch(() => setSummary({ total_purchases: 0, purchase_count: 0, items_purchased: 0 }))
  }, [currentOutlet?.id, selectedRange])

  useEffect(() => {
    if (currentBusiness && currentOutlet) {
      loadPurchaseOrders()
      loadPurchaseReturns()

      const handleOutletChange = () => {
        loadPurchaseOrders()
        loadPurchaseReturns()
      }
      window.addEventListener("outlet-changed", handleOutletChange)

      return () => {
        window.removeEventListener("outlet-changed", handleOutletChange)
      }
    }
  }, [currentBusiness, currentOutlet, loadPurchaseOrders, loadPurchaseReturns])

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
      returned: { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle, label: "Returned" },
    }
    
    const config = statusConfig[status] || statusConfig.draft
    const Icon = config.icon
    
    return (
      <Badge className={`${config.bg} ${config.text} border-0`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  const filteredPurchaseOrders = useMemo(() => {
    if (!searchTerm) return purchaseOrders
    const term = searchTerm.toLowerCase()
    return purchaseOrders.filter((po) =>
      po.po_number?.toLowerCase().includes(term) ||
      po.supplier?.name?.toLowerCase().includes(term) ||
      po.notes?.toLowerCase().includes(term)
    )
  }, [purchaseOrders, searchTerm])

  const filteredPurchaseReturns = useMemo(() => {
    if (!searchTerm) return purchaseReturns
    const term = searchTerm.toLowerCase()
    return purchaseReturns.filter((pr) =>
      pr.return_number?.toLowerCase().includes(term) ||
      pr.supplier?.name?.toLowerCase().includes(term) ||
      pr.reason?.toLowerCase().includes(term)
    )
  }, [purchaseReturns, searchTerm])

  const canReview = (status: string) => ["draft", "pending", "pending_supplier"].includes(status)

  const handleApproval = async (poId: string) => {
    try {
      await purchaseOrderService.approve(poId)
      await loadPurchaseOrders()
      toast({ title: "Purchase approved" })
    } catch (error: any) {
      toast({ title: "Approval failed", description: error.message || "Could not approve purchase", variant: "destructive" })
    }
  }

  const handleRejection = async (poId: string) => {
    try {
      await purchaseOrderService.reject(poId)
      await loadPurchaseOrders()
      toast({ title: "Purchase rejected" })
    } catch (error: any) {
      toast({ title: "Rejection failed", description: error.message || "Could not reject purchase", variant: "destructive" })
    }
  }

  const tabsConfig: TabConfig[] = [
    {
      value: "orders",
      label: "Purchase Orders",
      icon: ShoppingCart,
      badgeCount: purchaseOrders.length,
      badgeVariant: "secondary",
    },
    {
      value: "returns",
      label: "Purchase Returns",
      icon: RotateCcw,
      badgeCount: purchaseReturns.length,
      badgeVariant: "secondary",
    },
  ]

  return (
    <DashboardLayout>
      <PageLayout
        title="Purchases"
        description="Manage purchase orders and returns from suppliers"
        actions={
          <Link href="/dashboard/inventory/suppliers/purchases/new">
            <Button className="bg-white border-white text-[#1e3a8a] hover:bg-blue-50 hover:border-blue-50">
              <Plus className="mr-2 h-4 w-4" />
              New Purchase Order
            </Button>
          </Link>
        }
        noPadding={true}
      >
        <div className="px-6 pt-4 border-b border-gray-300">
          <FilterableTabs
            tabs={tabsConfig}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            afterTabs={
              <div className="px-0 pt-2">
                <div className="mb-4 flex justify-end">
                  <DateRangeFilter defaultPreset="last30" onRangeChange={setSelectedRange} />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2"><CardDescription>Total Purchases</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">MWK {Number(summary.total_purchases || 0).toFixed(2)}</div><p className="text-xs text-muted-foreground">Total value in selected period</p></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardDescription>Purchase Orders</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{summary.purchase_count}</div><p className="text-xs text-muted-foreground">Committed purchases in selected period</p></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardDescription>Items Purchased</CardDescription></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{summary.items_purchased}</div><p className="text-xs text-muted-foreground">Total quantity received</p></CardContent>
                  </Card>
                </div>
              </div>
            }
          >
            <TabsContent value="orders" className="mt-0">
              <div className="px-6 py-4">
                <div className="mb-4 pb-4 border-b border-gray-300">
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
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Purchase Orders</h3>
                  <p className="text-sm text-gray-600">
                    {purchaseOrders.length} purchase order{purchaseOrders.length !== 1 ? "s" : ""} found
                  </p>
                </div>
                {loadingOrders ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Loading purchase orders...</p>
                  </div>
                ) : filteredPurchaseOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50 text-gray-400" />
                    <p className="text-gray-600">No purchase orders found.</p>
                    <p className="text-sm mt-2 text-gray-500">Create your first purchase order to get started.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-gray-900 font-semibold">PO Number</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Supplier</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Order Date</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Total</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPurchaseOrders.map((po) => (
                          <TableRow key={po.id} className="border-gray-300">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {po.po_number}
                                {po.status === 'pending_supplier' && (
                                  <Badge variant="outline" className="text-xs">
                                    Needs Supplier
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {po.supplier?.name || (
                                <span className="text-gray-600 italic">No Supplier</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {po.order_date ? format(new Date(po.order_date), "MMM dd, yyyy") : "N/A"}
                            </TableCell>
                            <TableCell>
                              {currentBusiness?.currencySymbol || "MWK"}{parseFloat(po.total || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>{getStatusBadge(po.status)}</TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label={`Actions for ${po.po_number}`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/inventory/suppliers/purchases/${po.id}`}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View
                                    </Link>
                                  </DropdownMenuItem>
                                  {canReview(po.status) && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleApproval(String(po.id))}>
                                        <ThumbsUp className="mr-2 h-4 w-4" />
                                        Approve
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleRejection(String(po.id))} className="text-destructive focus:text-destructive">
                                        <Ban className="mr-2 h-4 w-4" />
                                        Reject
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="returns" className="mt-0">
              <div className="px-6 py-4">
                <div className="mb-4 pb-4 border-b border-gray-300">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                      <Input
                        placeholder="Search purchase returns..."
                        className="pl-10 bg-white border-gray-300"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Purchase Returns</h3>
                  <p className="text-sm text-gray-600">
                    {purchaseReturns.length} purchase return{purchaseReturns.length !== 1 ? "s" : ""} found
                  </p>
                </div>
                {loadingReturns ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Loading purchase returns...</p>
                  </div>
                ) : filteredPurchaseReturns.length === 0 ? (
                  <div className="text-center py-8">
                    <RotateCcw className="h-12 w-12 mx-auto mb-4 opacity-50 text-gray-400" />
                    <p className="text-gray-600">No purchase returns found.</p>
                    <p className="text-sm mt-2 text-gray-500">Purchase returns will appear here when you return items to suppliers.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-gray-900 font-semibold">Return Number</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Supplier</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Return Date</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Purchase Order</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Total</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPurchaseReturns.map((pr) => (
                          <TableRow key={pr.id} className="border-gray-300">
                            <TableCell className="font-medium">{pr.return_number}</TableCell>
                            <TableCell>
                              {pr.supplier?.name || (
                                <span className="text-gray-600 italic">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {pr.return_date ? format(new Date(pr.return_date), "MMM dd, yyyy") : "N/A"}
                            </TableCell>
                            <TableCell>
                              {pr.purchase_order?.po_number || (
                                <span className="text-gray-600 italic">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {currentBusiness?.currencySymbol || "MWK"}{parseFloat(pr.total || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>{getStatusBadge(pr.status)}</TableCell>
                            <TableCell>
                              <Link href={`/dashboard/inventory/suppliers/purchases/returns/${pr.id}`}>
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
            </TabsContent>
          </FilterableTabs>
        </div>
      </PageLayout>
    </DashboardLayout>
  )
}

