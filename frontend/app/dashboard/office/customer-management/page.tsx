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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Search, Mail, Phone, Award, Calendar, Edit, Trash2, Merge, Menu } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { useState, useEffect, useCallback, useMemo } from "react"
import { AddEditCustomerModal } from "@/components/modals/add-edit-customer-modal"
import { LoyaltyPointsAdjustModal } from "@/components/modals/loyalty-points-adjust-modal"
import { MergeCustomerModal } from "@/components/modals/merge-customer-modal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { customerService, type Customer } from "@/lib/services/customerService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useI18n } from "@/contexts/i18n-context"

export default function CustomerManagementPage() {
  const { currentBusiness, currentOutlet, outlets } = useBusinessStore()
  const { toast } = useToast()
  const { t } = useI18n()
  const [searchTerm, setSearchTerm] = useState("")
  const [outletFilter, setOutletFilter] = useState<string>("all")
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showLoyaltyAdjust, setShowLoyaltyAdjust] = useState(false)
  const [showMerge, setShowMerge] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const useReal = useRealAPI()

  const loadCustomers = useCallback(async () => {
    if (!currentBusiness) {
      setCustomers([])
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)
    try {
      const response = await customerService.list({
        outlet: outletFilter !== "all" ? outletFilter : undefined,
        is_active: true,
      })
      // Handle both array and paginated response formats
      const customerList = Array.isArray(response) ? response : (response?.results || [])
      setCustomers(customerList)
    } catch (error) {
      console.error("Failed to load customers:", error)
      toast({
        title: "Error",
        description: "Failed to load customers. Please try again.",
        variant: "destructive",
      })
      setCustomers([])
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, outletFilter, toast])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const handleDeleteCustomer = useCallback(async (customerId: string) => {
    loadCustomers()
  }, [loadCustomers])

  // Filter customers based on search and outlet
  const filteredCustomers = useMemo(() => {
    // Apply search filter
    const searchFiltered = customers.filter(customer => {
      const matchesSearch = 
        customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm)
      return matchesSearch
    })

    // Apply outlet filter
    const outletFiltered = searchFiltered.filter(customer => {
      if (outletFilter === "all") return true
      const customerId = String(customer.outlet_id || customer.outlet || "")
      return customerId === outletFilter
    })

    return outletFiltered
  }, [customers, searchTerm, outletFilter])

  // Calculate statistics
  const stats = useMemo(() => {
    const allCustomers = customers
    const creditCustomers = customers.filter(c => c.credit_enabled === true)
    
    return {
      totalCustomers: allCustomers.length,
      creditEnabled: creditCustomers.length,
      totalOutstanding: creditCustomers.reduce((sum, c) => {
        const balance = Number(c.outstanding_balance) || 0
        return sum + balance
      }, 0),
    }
  }, [customers])

  const handleDelete = (customerId: string) => {
    setCustomerToDelete(customerId)
    setShowDelete(true)
  }

  const confirmDelete = async () => {
    if (!customerToDelete) return
    
    try {
      // TODO: Implement delete in customerService when backend supports it
      // await customerService.delete(customerToDelete)
      setCustomers(customers.filter(c => c.id !== customerToDelete))
      toast({
        title: "Customer Deleted",
        description: "Customer has been deleted successfully.",
      })
      setShowDelete(false)
      setCustomerToDelete(null)
    } catch (error: any) {
      console.error("Failed to delete customer:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer.",
        variant: "destructive",
      })
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={t("customers.menu.management")}
        description={t("customers.management.description")}
      >
        {/* Search and Filter Bar */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-3xl">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder={t("customers.search_placeholder")}
                className="pl-10 w-full bg-white border-gray-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={outletFilter} onValueChange={setOutletFilter}>
              <SelectTrigger className="w-[200px] bg-white border-gray-300">
                <SelectValue placeholder={t("common.outlet")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outlets</SelectItem>
                {outlets.map(outlet => (
                  <SelectItem key={outlet.id} value={outlet.id}>{outlet.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => {
                setSelectedCustomer(null)
                setShowAddCustomer(true)
              }}
              className="bg-[#1e3a8a] text-white hover:bg-blue-800"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </div>
        </div>

        {/* Unified Customer Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Customers</CardTitle>
            <CardDescription>
              {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-gray-300 bg-white overflow-hidden">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-gray-900 font-semibold w-[12%] whitespace-normal">Name</TableHead>
                    <TableHead className="text-gray-900 font-semibold w-[12%] whitespace-normal">Email</TableHead>
                    <TableHead className="text-gray-900 font-semibold w-[9%] whitespace-normal">Phone</TableHead>
                    <TableHead className="text-gray-900 font-semibold w-[12%] whitespace-normal">Address</TableHead>
                    <TableHead className="text-gray-900 font-semibold w-[8%] whitespace-normal">Outlet</TableHead>
                    <TableHead className="text-gray-900 font-semibold w-[8%] whitespace-normal">Loyalty</TableHead>
                    <TableHead className="text-gray-900 font-semibold w-[9%] whitespace-normal">Spent</TableHead>
                    <TableHead className="text-gray-900 font-semibold w-[10%] whitespace-normal">Credit</TableHead>
                    <TableHead className="text-gray-900 font-semibold w-[10%] whitespace-normal">Outstanding</TableHead>
                    <TableHead className="text-gray-900 font-semibold w-[7%] whitespace-normal">Last Visit</TableHead>
                    <TableHead className="text-gray-900 font-semibold w-[3%] whitespace-normal">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8">
                        <p className="text-gray-600">Loading customers...</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8">
                        <p className="text-gray-600">No customers found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => {
                      const customerPoints = customer.loyalty_points || 0
                      const totalSpent = customer.total_spent || 0
                      const lastVisit = customer.last_visit
                      
                      // Get outlet ID (string or number)
                      const outletId = String(customer.outlet_id || customer.outlet || "")
                      
                      // Find outlet name from outlets array
                      const outletName = outletId && outlets.length > 0
                        ? outlets.find(o => o.id === outletId)?.name || outletId || "N/A"
                        : "N/A"
                      
                      return (
                        <TableRow key={customer.id} className="border-gray-300">
                          <TableCell className="break-words">
                            <Link 
                              href={`/dashboard/office/customer-management/${customer.id}`}
                              className="font-medium hover:text-primary"
                            >
                              {customer.name}
                            </Link>
                          </TableCell>
                          <TableCell className="break-words">
                            {customer.email ? (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{customer.email}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="break-words">
                            {customer.phone ? (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{customer.phone}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="break-words">
                            <span className="text-sm text-muted-foreground">
                              {customer.address || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="break-words">
                            <span className="font-medium">{outletName}</span>
                          </TableCell>
                          <TableCell className="break-words">
                            <div className="flex items-center gap-2">
                              <Award className="h-4 w-4 text-yellow-500" />
                              <span className="font-semibold">{customerPoints.toLocaleString('en-US')}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold break-words">
                            {currentBusiness?.currencySymbol || "MWK"} {totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="break-words">
                            {customer.credit_enabled ? (
                              <div className="space-y-1">
                                <Badge variant={customer.credit_status === 'active' ? 'default' : 'secondary'}>
                                  {customer.credit_status || 'active'}
                                </Badge>
                                <div className="text-xs text-muted-foreground">
                                  Limit: {currentBusiness?.currencySymbol || "MWK"} {Number(customer.credit_limit || 0).toFixed(2)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No Credit</span>
                            )}
                          </TableCell>
                          <TableCell className="break-words">
                            {customer.credit_enabled && (Number(customer.outstanding_balance) || 0) > 0 ? (
                              <div className="space-y-1">
                                <span className="font-medium text-orange-600">
                                  {currentBusiness?.currencySymbol || "MWK"} {Number(customer.outstanding_balance || 0).toFixed(2)}
                                </span>
                                <div className="text-xs text-muted-foreground">
                                  Available: {currentBusiness?.currencySymbol || "MWK"} {Number(customer.available_credit || 0).toFixed(2)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="break-words">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {lastVisit ? new Date(lastVisit).toLocaleDateString() : "Never"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Menu className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedCustomer(customer)
                                    setShowAddCustomer(true)
                                  }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Customer
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedCustomer(customer)
                                    setShowLoyaltyAdjust(true)
                                  }}
                                >
                                  <Award className="mr-2 h-4 w-4" />
                                  Adjust Loyalty Points
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedCustomer(customer)
                                    setShowMerge(true)
                                  }}
                                >
                                  <Merge className="mr-2 h-4 w-4" />
                                  Merge Customer
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(customer.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Customer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </PageLayout>

      {/* Modals */}
      <AddEditCustomerModal
        open={showAddCustomer}
        onOpenChange={(open) => {
          setShowAddCustomer(open)
          if (!open) setSelectedCustomer(null)
        }}
        customer={selectedCustomer}
        onSuccess={loadCustomers}
      />
      <LoyaltyPointsAdjustModal
        open={showLoyaltyAdjust}
        onOpenChange={(open) => {
          setShowLoyaltyAdjust(open)
          if (!open) {
            setSelectedCustomer(null)
            loadCustomers()
          }
        }}
        customer={selectedCustomer}
      />
      <MergeCustomerModal
        open={showMerge}
        onOpenChange={(open) => {
          setShowMerge(open)
          if (!open) {
            setSelectedCustomer(null)
            loadCustomers()
          }
        }}
        customer={selectedCustomer}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this customer? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}

