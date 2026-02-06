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
  CalendarIcon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { saleService } from "@/lib/services/saleService"
import { useToast } from "@/components/ui/use-toast"
import { format, subDays } from "date-fns"
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

export default function ReturnsPage() {
  const router = useRouter()
  const { currentBusiness } = useBusinessStore()
  const { currentOutlet } = useTenant()
  const { toast } = useToast()

  const [returns, setReturns] = useState<SaleDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null)
  const [showSaleDetails, setShowSaleDetails] = useState(false)
  const [isLoadingSaleDetails, setIsLoadingSaleDetails] = useState(false)

  // Load returns
  const loadReturns = useCallback(async () => {
    if (!currentBusiness || !currentOutlet) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const filters: any = {
        status: "refunded",
        outlet: currentOutlet.id,
      }
      
      if (dateRange.from) {
        filters.date_from = format(dateRange.from, "yyyy-MM-dd")
      }
      if (dateRange.to) {
        filters.date_to = format(dateRange.to, "yyyy-MM-dd")
      }

      const response = await saleService.list(filters)
      const returnsData = response.results || []

      const enrichedReturns = returnsData.map((ret: any) => {
        const returnDetail: SaleDetail = { ...ret, _raw: ret._raw || ret }
        
        if (ret._raw?.customer_detail) {
          returnDetail.customer = {
            id: String(ret._raw.customer_detail.id),
            name: ret._raw.customer_detail.name || "",
            email: ret._raw.customer_detail.email,
            phone: ret._raw.customer_detail.phone,
          }
        }

        if (ret._raw?.outlet_detail) {
          returnDetail.outlet = {
            id: String(ret._raw.outlet_detail.id),
            name: ret._raw.outlet_detail.name || "",
          }
        }

        if (ret._raw?.user_detail) {
          returnDetail.user = {
            id: String(ret._raw.user_detail.id),
            email: ret._raw.user_detail.email || "",
            first_name: ret._raw.user_detail.first_name || "",
            last_name: ret._raw.user_detail.last_name || "",
          }
        }

        returnDetail.receipt_number = ret._raw?.receipt_number || ret.receipt_number
        returnDetail.payment_method = ret._raw?.payment_method || ret.payment_method || ret.paymentMethod

        return returnDetail
      })

      setReturns(enrichedReturns)
    } catch (error: any) {
      console.error("Failed to load returns:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load returns",
        variant: "destructive",
      })
      setReturns([])
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, currentOutlet, dateRange, toast])

  const getUserDisplay = (sale: SaleDetail) => {
    const user = sale.user
    if (!user) return "System"
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim()
    return fullName || user.email || "System"
  }

  useEffect(() => {
    loadReturns()
  }, [loadReturns])

  const filteredReturns = useMemo(() => {
    if (!searchTerm) return returns
    return returns.filter((ret) => {
      const receiptNum = ret.receipt_number || ret.id.slice(-6)
      const customerName = ret.customer?.name || ""
      return (
        receiptNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    })
  }, [returns, searchTerm])

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

  return (
    <div className="w-full">
      <div className="px-6 pt-4 pb-2">
        <h2 className="text-xl font-semibold text-gray-900">Returns & Refunds</h2>
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
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="bg-white border-white text-[#1e3a8a] hover:bg-blue-50">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from && dateRange.to
                    ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
                    : "Select date range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{
                    from: dateRange.from,
                    to: dateRange.to,
                  }}
                  onSelect={(range) => {
                    setDateRange({
                      from: range?.from,
                      to: range?.to,
                    })
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="px-6 py-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-600">Loading returns...</div>
          ) : filteredReturns.length === 0 ? (
            <div className="text-center py-8 text-gray-600">No returns found</div>
          ) : (
            <div className="rounded-md border border-gray-300 bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-gray-900 font-semibold">Receipt #</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Customer</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Date</TableHead>
                    <TableHead className="text-gray-900 font-semibold">User</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Outlet</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Payment Method</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Amount Refunded</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                    <TableHead className="text-right text-gray-900 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturns.map((ret) => (
                    <TableRow key={ret.id} className="border-gray-300">
                      <TableCell className="font-medium">
                        {ret._raw?.receipt_number || ret.receipt_number || ret.id.slice(-6)}
                      </TableCell>
                      <TableCell>{ret.customer?.name || "Walk-in"}</TableCell>
                      <TableCell>
                        {format(new Date((ret as any).created_at || ret.createdAt), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>{getUserDisplay(ret)}</TableCell>
                      <TableCell>{ret.outlet?.name || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize border-gray-300">
                          {ret._raw?.payment_method || ret.payment_method || ret.paymentMethod || "cash"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {currentBusiness?.currencySymbol || "MWK"} {ret.total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">Refunded</Badge>
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
                              onClick={() => handleViewSale(ret)}
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
            status: selectedSale.status || "refunded",
          }}
        />
      )}
    </div>
  )
}
