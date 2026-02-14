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

export default function DiscountsPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet: storeOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet } = useTenant()
  const { toast } = useToast()

  const outlet = tenantOutlet || storeOutlet

  const [discountedSales, setDiscountedSales] = useState<SaleDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null)
  const [showSaleDetails, setShowSaleDetails] = useState(false)
  const [isLoadingSaleDetails, setIsLoadingSaleDetails] = useState(false)

  const PAGE_SIZE = 10

  const getTotalDiscount = (sale: any) => {
    const saleDiscount = Number(sale?._raw?.discount ?? sale?.discount ?? 0)
    const items = sale?._raw?.items || sale?.items || []
    const itemDiscount = Array.isArray(items)
      ? items.reduce((sum: number, item: any) => sum + Number(item?.discount ?? 0), 0)
      : 0
    const safeSale = isNaN(saleDiscount) ? 0 : saleDiscount
    const safeItems = isNaN(itemDiscount) ? 0 : itemDiscount
    return safeSale + safeItems
  }

  // Load discounted sales
  const loadDiscounts = useCallback(async () => {
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
      const allSales = response.results || []

      // Filter for sales with discount > 0
      const discounts = allSales.filter((sale: any) => getTotalDiscount(sale) > 0)

      const enrichedDiscounts = discounts.map((discount: any) => {
        const discountDetail: SaleDetail = { ...discount, _raw: discount._raw || discount }
        
        if (discount._raw?.customer_detail) {
          discountDetail.customer = {
            id: String(discount._raw.customer_detail.id),
            name: discount._raw.customer_detail.name || "",
            email: discount._raw.customer_detail.email,
            phone: discount._raw.customer_detail.phone,
          }
        }

        if (discount._raw?.outlet_detail) {
          discountDetail.outlet = {
            id: String(discount._raw.outlet_detail.id),
            name: discount._raw.outlet_detail.name || "",
          }
        }

        if (discount._raw?.user_detail) {
          discountDetail.user = {
            id: String(discount._raw.user_detail.id),
            email: discount._raw.user_detail.email || "",
            first_name: discount._raw.user_detail.first_name || "",
            last_name: discount._raw.user_detail.last_name || "",
          }
        }

        discountDetail.receipt_number = discount._raw?.receipt_number || discount.receipt_number
        discountDetail.payment_method = discount._raw?.payment_method || discount.payment_method || discount.paymentMethod

        return discountDetail
      })

      setDiscountedSales(enrichedDiscounts)
    } catch (error: any) {
      console.error("Failed to load discounted sales:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load discounted sales",
        variant: "destructive",
      })
      setDiscountedSales([])
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, outlet, toast])

  const getUserDisplay = (sale: SaleDetail) => {
    const user = sale.user
    if (!user) return "System"
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim()
    return fullName || user.email || "System"
  }

  useEffect(() => {
    loadDiscounts()

    if (typeof window === "undefined") return

    const handleRefresh = () => {
      loadDiscounts()
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadDiscounts()
      }
    }

    window.addEventListener("sale-completed", handleRefresh)
    window.addEventListener("focus", handleRefresh)
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      window.removeEventListener("sale-completed", handleRefresh)
      window.removeEventListener("focus", handleRefresh)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [loadDiscounts])

  // Reset page on search
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const filteredDiscounts = useMemo(() => {
    let filtered = discountedSales
    if (searchTerm) {
      filtered = filtered.filter((sale) => {
        const receiptNum = sale.receipt_number || sale.id.slice(-6)
        const customerName = sale.customer?.name || ""
        return (
          receiptNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customerName.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })
    }
    return filtered
  }, [discountedSales, searchTerm])

  const paginatedDiscounts = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE
    return filteredDiscounts.slice(startIdx, startIdx + PAGE_SIZE)
  }, [filteredDiscounts, currentPage])

  const totalDiscountAmount = filteredDiscounts.reduce((sum, sale) => sum + getTotalDiscount(sale), 0)

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
      setSelectedSale(sale)
      setShowSaleDetails(true)
    } finally {
      setIsLoadingSaleDetails(false)
    }
  }

  const renderPagination = () => {
    const totalPages = Math.ceil(filteredDiscounts.length / PAGE_SIZE)
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
        <h2 className="text-xl font-semibold text-gray-900">Discounted Sales</h2>
      </div>

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

        {!isLoading && filteredDiscounts.length > 0 && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
            <div className="text-sm text-blue-900">
              <p className="font-semibold">Total Discount Amount: {currentBusiness?.currencySymbol || "MWK"} {totalDiscountAmount.toFixed(2)}</p>
            </div>
          </div>
        )}

        <div className="px-6 py-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-600">Loading discounted sales...</div>
          ) : filteredDiscounts.length === 0 ? (
            <div className="text-center py-8 text-gray-600">No discounted sales found</div>
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
                    <TableHead className="text-right text-gray-900 font-semibold">Subtotal</TableHead>
                    <TableHead className="text-right text-gray-900 font-semibold">Discount</TableHead>
                    <TableHead className="text-right text-gray-900 font-semibold">Total</TableHead>
                    <TableHead className="text-right text-gray-900 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDiscounts.map((sale) => (
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
                      <TableCell className="text-right">
                        {currentBusiness?.currencySymbol || "MWK"} {Number(sale.subtotal || sale.total || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">
                          {currentBusiness?.currencySymbol || "MWK"} {getTotalDiscount(sale).toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {currentBusiness?.currencySymbol || "MWK"} {Number(sale.total || 0).toFixed(2)}
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
    </div>
  )
}
