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
import { Plus, Search, Building2, Mail, Phone, Trash2, Edit, Eye, Filter } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { AddSupplierModal } from "@/components/modals/add-supplier-modal"
import { ViewSupplierModal } from "@/components/modals/view-supplier-modal"
import { supplierService, type Supplier } from "@/lib/services/supplierService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import { useToast } from "@/components/ui/use-toast"
import { APP_REFRESH_EVENT } from "@/lib/utils/page-refresh"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

export default function SuppliersListPage() {
  const { currentBusiness } = useBusinessStore()
  const { toast } = useToast()
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [showViewSupplier, setShowViewSupplier] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const useReal = useRealAPI()

  const loadSuppliers = useCallback(async () => {
    if (!currentBusiness) {
      setSuppliers([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      if (useReal) {
        // Load all suppliers (not just active) to allow filtering
        const response = await supplierService.list()
        setSuppliers(response.results || [])
      } else {
        setSuppliers([])
      }
    } catch (error: any) {
      console.error("Failed to load suppliers:", error)
      setSuppliers([])
      toast({
        title: "Could not load suppliers",
        description: error?.message || "Check your outlet selection and inventory access, then retry.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, useReal, toast])

  useEffect(() => {
    void loadSuppliers()
    window.addEventListener(APP_REFRESH_EVENT, loadSuppliers)
    return () => window.removeEventListener(APP_REFRESH_EVENT, loadSuppliers)
  }, [loadSuppliers])
  
  const handleDeleteSupplier = useCallback(async (supplierId: string) => {
    if (currentBusiness) {
      loadSuppliers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusiness?.id])

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = 
      supplier.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.phone?.includes(searchTerm)
    
    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "active" && supplier.is_active) ||
      (statusFilter === "inactive" && !supplier.is_active)
    
    return matchesSearch && matchesStatus
  })

  const totalSuppliers = suppliers.length
  const activeSuppliers = suppliers.filter(s => s.is_active).length
  const inactiveSuppliers = suppliers.filter(s => !s.is_active).length

  const handleDelete = (supplierId: string) => {
    setSupplierToDelete(supplierId)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!supplierToDelete) return

    try {
      await supplierService.delete(supplierToDelete)
      toast({
        title: "Supplier Deleted",
        description: "Supplier has been deleted successfully.",
      })
      loadSuppliers()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete supplier.",
        variant: "destructive",
      })
    } finally {
      setShowDeleteDialog(false)
      setSupplierToDelete(null)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Suppliers"
        description="Manage your supplier relationships"
        actions={
          <Button 
            onClick={() => {
              setSelectedSupplier(null)
              setShowAddSupplier(true)
            }}
            className="bg-white border-white text-[#1e3a8a] hover:bg-blue-50 hover:border-blue-50"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
        }
      >
        {/* Filters */}
        <div className="mb-6 pb-4 border-b border-gray-300">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search suppliers..."
                className="pl-10 bg-white border-gray-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={statusFilter || "all"} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] bg-white border-gray-300">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Suppliers Table */}
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">All Suppliers</h3>
            <p className="text-sm text-gray-600">
              {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <div className="rounded-md border border-gray-300 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-gray-900 font-semibold">Supplier</TableHead>
                  <TableHead className="text-gray-900 font-semibold">Contact</TableHead>
                  <TableHead className="text-gray-900 font-semibold">Payment Terms</TableHead>
                  <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                  <TableHead className="text-gray-900 font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-gray-600">Loading suppliers...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-gray-600">No suppliers found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="border-gray-300">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <div>
                            <span className="font-medium">{supplier.name}</span>
                            {supplier.contact_name && (
                              <p className="text-sm text-muted-foreground">{supplier.contact_name}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {supplier.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{supplier.email}</span>
                            </div>
                          )}
                          {supplier.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{supplier.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {supplier.payment_terms || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          supplier.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {supplier.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSupplier(supplier)
                              setShowViewSupplier(true)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSupplier(supplier)
                              setShowAddSupplier(true)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDelete(supplier.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </PageLayout>

      <AddSupplierModal
        open={showAddSupplier}
        onOpenChange={(open) => {
          setShowAddSupplier(open)
          if (!open) setSelectedSupplier(null)
        }}
        supplier={selectedSupplier}
        onSuccess={loadSuppliers}
      />

      <ViewSupplierModal
        open={showViewSupplier}
        onOpenChange={setShowViewSupplier}
        supplier={selectedSupplier}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this supplier? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}

