"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { 
  Search,
  Menu,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { saleService } from "@/lib/services/saleService"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { ViewSaleDetailsModal } from "@/components/modals/view-sale-details-modal"
import { RefundReturnModal } from "@/components/modals/refund-return-modal"
import { useI18n } from "@/contexts/i18n-context"
import type { Sale } from "@/lib/types"

interface SaleDetail extends Sale {
  payment_method?: string
  receipt_number?: string
  created_at?: string
  _raw?: any
  customer?: {
    id: string
    name: string
    email?: string
    phone?: string
  }
  user?: {
    id: string
    email: string
    first_name?: string
    last_name?: string
  }
  outlet?: {
    id: string
    name: string
  }
}

export default function TransactionsPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet: storeOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet } = useTenant()
  const { toast } = useToast()
  const { t } = useI18n()

  const outlet = tenantOutlet || storeOutlet

  const [sales, setSales] = useState<SaleDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null)
  const [showSaleDetails, setShowSaleDetails] = useState(false)
  const [isLoadingSaleDetails, setIsLoadingSaleDetails] = useState(false)
  const [showRefundReturn, setShowRefundReturn] = useState(false)
  const [refundReceiptNumber, setRefundReceiptNumber] = useState("")

  const enrichSale = useCallback((sale: any): SaleDetail => {
    const saleDetail: SaleDetail = { ...sale, _raw: sale._raw || sale }

    if (sale._raw?.customer_detail) {
      saleDetail.customer = {
        id: String(sale._raw.customer_detail.id),
        name: sale._raw.customer_detail.name,
        email: sale._raw.customer_detail.email || "",
        phone: sale._raw.customer_detail.phone || "",
      }
    }

    if (sale._raw?.outlet_detail) {
      saleDetail.outlet = {
        id: String(sale._raw.outlet_detail.id),
        name: sale._raw.outlet_detail.name,
      }
    }

    if (sale._raw?.user_detail) {
      saleDetail.user = {
        id: String(sale._raw.user_detail.id),
        email: sale._raw.user_detail.email || "",
        first_name: sale._raw.user_detail.first_name || "",
        last_name: sale._raw.user_detail.last_name || "",
      }
    }

    saleDetail.receipt_number = sale._raw?.receipt_number || sale.receipt_number
    saleDetail.payment_method = sale._raw?.payment_method || sale.payment_method || sale.paymentMethod

    return saleDetail
  }, [])

  const upsertSale = useCallback((sale: SaleDetail) => {
    setSales((prev) => {
      const existingIndex = prev.findIndex((item) => String(item.id) === String(sale.id))
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = sale
        return updated
      }
      return [sale, ...prev]
    })
  }, [])

  // Load transactions
  const loadTransactions = useCallback(async () => {
    if (!currentBusiness) {
      setIsLoading(false)
      return
    }

    const outletId = outlet?.id || (typeof window !== "undefined" ? localStorage.getItem("currentOutletId") : null)
    if (!outletId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const filters: any = {
        outlet: outletId,
      }

      const response = await saleService.list(filters)
      const salesData = (response.results || []).filter((sale: any) => {
        const status = String(sale?.status || sale?._raw?.status || "").toLowerCase()
        return status === "completed" || status === "pending"
      })

      const enrichedSales = salesData.map(enrichSale)

      setSales(enrichedSales)
    } catch (error: any) {
      console.error("Failed to load transactions:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load transactions",
        variant: "destructive",
      })
      setSales([])
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, outlet, toast, enrichSale])

  const getUserDisplay = (sale: SaleDetail) => {
    const user = sale.user
    if (!user) return "System"
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim()
    return fullName || user.email || "System"
  }

  useEffect(() => {
    loadTransactions()

    if (typeof window === "undefined") return

    const handleRefresh = () => {
      loadTransactions()
    }

    const handleSaleCreated = async (event: Event) => {
      const outletId = outlet?.id || (typeof window !== "undefined" ? localStorage.getItem("currentOutletId") : null)
      if (!outletId) return

      const detail = (event as CustomEvent)?.detail
      const saleId = detail?.saleId

      if (detail?.sale) {
        const detailOutletId = detail?.outletId
        if (!detailOutletId || String(detailOutletId) === String(outletId)) {
          upsertSale(enrichSale(detail.sale))
          return
        }
      }

      if (saleId) {
        try {
          const fullSale = await saleService.get(String(saleId))
          upsertSale(enrichSale(fullSale))
          return
        } catch (error) {
          console.error("Failed to fetch sale after creation:", error)
        }
      }

      try {
        const response = await saleService.list({ outlet: String(outletId), limit: 1 })
        const latestSale = response.results?.[0]
        if (latestSale) {
          upsertSale(enrichSale(latestSale))
        }
      } catch (error) {
        console.error("Failed to refresh latest sale:", error)
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadTransactions()
      }
    }

    window.addEventListener("sale-completed", handleSaleCreated)
    window.addEventListener("focus", handleRefresh)
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      window.removeEventListener("sale-completed", handleSaleCreated)
      window.removeEventListener("focus", handleRefresh)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [loadTransactions, outlet?.id, enrichSale, upsertSale])

  // Reset page on search
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const filteredSales = useMemo(() => {
    if (!searchTerm) return sales
    return sales.filter((sale) => {
      const receiptNum = sale.receipt_number || sale.id.slice(-6)
      const customerName = sale.customer?.name || ""
      return (
        receiptNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    })
  }, [sales, searchTerm])

  const paginatedSales = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE
    return filteredSales.slice(startIdx, startIdx + PAGE_SIZE)
  }, [filteredSales, currentPage])

  const handleViewSale = async (sale: SaleDetail) => {
    setIsLoadingSaleDetails(true)
    try {
      const fullSale = await saleService.get(sale.id)
      const saleDetail: SaleDetail = {
        ...fullSale,
        _raw: (fullSale as any)._raw || fullSale,
        customer: (fullSale as any).customer || sale.customer,
        outlet: (fullSale as any).outlet || sale.outlet,
        receipt_number: (fullSale as any)._raw?.receipt_number || (fullSale as any).receipt_number || sale.receipt_number,
        payment_method: (fullSale as any)._raw?.payment_method || (fullSale as any).payment_method || sale.payment_method,
      }
      setSelectedSale(saleDetail)
      setShowSaleDetails(true)
    } catch (error: any) {
      console.error("Failed to load sale details:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load sale details",
        variant: "destructive",
      })
      setSelectedSale(sale)
      setShowSaleDetails(true)
    } finally {
      setIsLoadingSaleDetails(false)
    }
  }

  const handleRefundReturn = (sale: SaleDetail) => {
    const receipt = sale._raw?.receipt_number || sale.receipt_number || ""
    setRefundReceiptNumber(String(receipt || ""))
    setShowRefundReturn(true)
  }

  const renderPagination = () => {
    const totalPages = Math.ceil(filteredSales.length / PAGE_SIZE)
    if (totalPages <= 1) return null

    return (
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-300 bg-gray-50">
        <div className="text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="border-gray-300"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="border-gray-300"
          >
            Next
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-xl font-semibold text-gray-900">Transactions</h2>
      </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-300">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by receipt number or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-gray-300"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="px-6 py-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-600">Loading transactions...</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8 text-gray-600">No transactions found</div>
          ) : (
            <div className="rounded-md border border-gray-300 bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-gray-900 font-semibold">Receipt #</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Customer</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Date & Time</TableHead>
                    <TableHead className="text-gray-900 font-semibold">User</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Outlet</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Payment Method</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Amount</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                    <TableHead className="text-right text-gray-900 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSales.map((sale) => (
                    <TableRow key={sale.id} className="border-gray-300">
                      <TableCell className="font-medium">
                        {sale._raw?.receipt_number || sale.receipt_number || sale.id.slice(-6)}
                      </TableCell>
                      <TableCell>{sale.customer?.name || "Walk-in"}</TableCell>
                      <TableCell>
                        {format(new Date((sale as any).created_at || sale.createdAt), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{getUserDisplay(sale)}</TableCell>
                      <TableCell>{sale.outlet?.name || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize border-gray-300">
                          {sale._raw?.payment_method || sale.payment_method || sale.paymentMethod || "cash"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {currentBusiness?.currencySymbol || "MWK"} {sale.total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">Completed</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="border-gray-300">
                              <Menu className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleViewSale(sale)}
                              disabled={isLoadingSaleDetails}
                            >
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRefundReturn(sale)}>
                              Refund / Return
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {renderPagination()}
            </div>
          )}
        </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <ViewSaleDetailsModal
          open={showSaleDetails}
          onOpenChange={(open) => {
            setShowSaleDetails(open)
            if (!open) {
              setSelectedSale(null)
            }
          }}
          sale={{
            id: selectedSale._raw?.receipt_number || selectedSale.receipt_number || selectedSale.id,
            date: (selectedSale as any).created_at || selectedSale.createdAt,
            customer: selectedSale.customer?.name,
            outlet: selectedSale.outlet?.name,
            items: (selectedSale.items || []).map((item: any, index: number) => ({
              id: item.id || item.productId || `item-${index}`,
              name: item.productName || item.name || "Unknown Product",
              quantity: item.quantity || 0,
              price: item.price || 0,
              total: item.total || (item.price || 0) * (item.quantity || 0),
            })),
            subtotal: selectedSale.subtotal || 0,
            tax: selectedSale.tax || 0,
            discount: selectedSale.discount || 0,
            total: selectedSale.total || 0,
            paymentMethod: selectedSale._raw?.payment_method || selectedSale.payment_method || selectedSale.paymentMethod || "cash",
            status: selectedSale.status || "completed",
          }}
        />
      )}

      <RefundReturnModal
        open={showRefundReturn}
        onOpenChange={setShowRefundReturn}
        initialReceiptNumber={refundReceiptNumber}
      />
    </div>
  )
}
