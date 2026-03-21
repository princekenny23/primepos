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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Building2, Users, DollarSign, AlertTriangle, Eye, MoreVertical, Loader2, Edit, Trash2, Shield } from "lucide-react"
import { useState, useEffect } from "react"
import { SuspendTenantModal } from "@/components/modals/suspend-tenant-modal"
import { ViewTenantDetailsModal } from "@/components/modals/view-tenant-details-modal"
import { EditTenantModal } from "@/components/modals/edit-tenant-modal"
import { DeleteTenantModal } from "@/components/modals/delete-tenant-modal"
import { ManagePermissionsModal } from "@/components/modals/manage-permissions-modal"
import { RecordTenantPaymentModal } from "@/components/modals/record-tenant-payment-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { adminService, type AdminTenant } from "@/lib/services/adminService"

export default function AdminTenantsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showViewDetails, setShowViewDetails] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<AdminTenant | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTenants()
  }, [])

  const loadTenants = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Check if we have auth token
      const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
      if (!token) {
        setError("Please login to view tenants")
        setIsLoading(false)
        return
      }
      
      const data = await adminService.getTenants()
      // Data is already transformed to array by adminService
      setTenants(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.error("Failed to load tenants:", err)
      setError(err.message || "Failed to load tenants")
      setTenants([])
    } finally {
      setIsLoading(false)
    }
  }

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = 
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "active" && tenant.is_active) ||
      (activeTab === "suspended" && !tenant.is_active)

    return matchesSearch && matchesTab
  })

  const activeTenants = tenants.filter(t => t.is_active).length
  const totalRevenue = tenants.reduce((sum, t) => sum + (t.revenue || 0), 0)
  const totalUsers = tenants.reduce((sum, t) => {
    const userCount = Array.isArray(t.users) ? t.users.length : (typeof t.users === 'number' ? t.users : 0)
    return sum + userCount
  }, 0)

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
      : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
  }

  const handleSuspend = async (tenantId: string, reason: string) => {
    try {
      await adminService.suspendTenant(tenantId, reason)
      await loadTenants()
      setShowSuspendModal(false)
    } catch (err: any) {
      console.error("Failed to suspend tenant:", err)
      alert(err.message || "Failed to suspend tenant")
    }
  }

  const handleActivate = async (tenantId: string) => {
    try {
      await adminService.activateTenant(tenantId)
      await loadTenants()
    } catch (err: any) {
      console.error("Failed to activate tenant:", err)
      alert(err.message || "Failed to activate tenant")
    }
  }

  const handleDelete = async () => {
    // Clear selected tenant and close modal before reloading
    setSelectedTenant(null)
    setShowDeleteModal(false)
    await loadTenants()
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Tenant Management"
        description="Manage all registered businesses"
      >

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="text-destructive">{error}</div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tenants.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
              <Building2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeTenants}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">MWK {totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>
        </div>

     

        {/* Tenants Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Tenants</CardTitle>
                <CardDescription>
                  {filteredTenants.length} tenant{filteredTenants.length !== 1 ? "s" : ""} found
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tenants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {tenants.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No tenants found</p>
                <p className="text-sm text-muted-foreground">
                  Create your first tenant from the admin dashboard
                </p>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="suspended">Suspended</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-4">
                  {filteredTenants.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No tenants match your filters</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tenant Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Users</TableHead>
                          <TableHead>Outlets</TableHead>
                          <TableHead>Total Paid</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTenants.map((tenant) => (
                          <TableRow key={tenant.id}>
                            <TableCell className="font-medium">{tenant.name}</TableCell>
                            <TableCell>{tenant.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">{tenant.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(tenant.is_active)}>
                                {tenant.is_active ? "Active" : "Suspended"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {Array.isArray(tenant.users) ? tenant.users.length : (tenant.users || 0)}
                            </TableCell>
                            <TableCell>
                              {Array.isArray(tenant.outlets) ? tenant.outlets.length : (tenant.outlets || 0)}
                            </TableCell>
                            <TableCell className="font-semibold text-green-700 dark:text-green-300">
                              MWK {(tenant.total_manual_payments || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {new Date(tenant.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTenant(tenant)
                                      setShowViewDetails(true)
                                    }}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTenant(tenant)
                                      setShowEditModal(true)
                                    }}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Tenant
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTenant(tenant)
                                      setShowPaymentModal(true)
                                    }}
                                  >
                                    <DollarSign className="mr-2 h-4 w-4" />
                                    Record Payment
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTenant(tenant)
                                      setShowPermissionsModal(true)
                                    }}
                                  >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Manage Permissions
                                  </DropdownMenuItem>
                                  {tenant.is_active ? (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedTenant(tenant)
                                        setShowSuspendModal(true)
                                      }}
                                      className="text-destructive"
                                    >
                                      <AlertTriangle className="mr-2 h-4 w-4" />
                                      Suspend Tenant
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => handleActivate(tenant.id)}
                                    >
                                      <AlertTriangle className="mr-2 h-4 w-4" />
                                      Activate Tenant
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedTenant(tenant)
                                      setShowDeleteModal(true)
                                    }}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Tenant
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

      {/* Modals */}
      {selectedTenant && (
        <>
          <SuspendTenantModal
            open={showSuspendModal}
            onOpenChange={setShowSuspendModal}
            tenant={selectedTenant}
            onSuspend={handleSuspend}
          />
          <ViewTenantDetailsModal
            open={showViewDetails}
            onOpenChange={setShowViewDetails}
            tenant={selectedTenant}
          />
          <EditTenantModal
            open={showEditModal}
            onOpenChange={setShowEditModal}
            tenant={selectedTenant}
            onUpdate={loadTenants}
          />
          <ManagePermissionsModal
            open={showPermissionsModal}
            onOpenChange={setShowPermissionsModal}
            tenant={selectedTenant}
          />
          <RecordTenantPaymentModal
            open={showPaymentModal}
            onOpenChange={setShowPaymentModal}
            tenant={selectedTenant}
            onRecorded={loadTenants}
          />
          <DeleteTenantModal
            open={showDeleteModal}
            onOpenChange={setShowDeleteModal}
            tenant={selectedTenant}
            onDelete={handleDelete}
          />
        </>
      )}
      </PageLayout>
    </DashboardLayout>
  )
}

