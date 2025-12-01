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
import { Search, Building2, Users, DollarSign, AlertTriangle, Eye, MoreVertical } from "lucide-react"
import { useState } from "react"
import { SuspendTenantModal } from "@/components/modals/suspend-tenant-modal"
import { ViewTenantDetailsModal } from "@/components/modals/view-tenant-details-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function AdminTenantsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [showViewDetails, setShowViewDetails] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("all")

  // Mock tenants data
  const tenants = [
    {
      id: "1",
      name: "ABC Restaurant",
      email: "contact@abcrestaurant.com",
      plan: "Professional",
      status: "Active",
      users: 5,
      outlets: 2,
      revenue: 12500.00,
      joined: "2024-01-01",
      subscriptionEnd: "2024-12-31",
    },
    {
      id: "2",
      name: "XYZ Retail Store",
      email: "info@xyzretail.com",
      plan: "Enterprise",
      status: "Active",
      users: 12,
      outlets: 5,
      revenue: 35000.00,
      joined: "2023-11-15",
      subscriptionEnd: "2024-11-15",
    },
    {
      id: "3",
      name: "City Bar",
      email: "hello@citybar.com",
      plan: "Starter",
      status: "Suspended",
      users: 3,
      outlets: 1,
      revenue: 4500.00,
      joined: "2024-02-10",
      subscriptionEnd: "2024-05-10",
    },
    {
      id: "4",
      name: "Pharma Plus",
      email: "contact@pharmaplus.com",
      plan: "Professional",
      status: "Active",
      users: 8,
      outlets: 3,
      revenue: 18900.00,
      joined: "2023-12-20",
      subscriptionEnd: "2024-12-20",
    },
  ]

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = 
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "active" && tenant.status === "Active") ||
      (activeTab === "suspended" && tenant.status === "Suspended")

    return matchesSearch && matchesTab
  })

  const activeTenants = tenants.filter(t => t.status === "Active").length
  const totalRevenue = tenants.reduce((sum, t) => sum + t.revenue, 0)
  const totalUsers = tenants.reduce((sum, t) => sum + t.users, 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
      case "Suspended":
        return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
      default:
        return ""
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tenant Management</h1>
            <p className="text-muted-foreground">Manage all registered businesses</p>
          </div>
        </div>

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
              <div className="text-2xl font-bold">MWK {totalRevenue.toLocaleString()}</div>
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

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tenant name or email..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tenants Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Tenants</CardTitle>
            <CardDescription>
              {filteredTenants.length} tenant{filteredTenants.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="suspended">Suspended</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Outlets</TableHead>
                      <TableHead>Revenue</TableHead>
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
                          <Badge variant="outline">{tenant.plan}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(tenant.status)}>
                            {tenant.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{tenant.users}</TableCell>
                        <TableCell>{tenant.outlets}</TableCell>
                        <TableCell className="font-semibold">
                          MWK {tenant.revenue.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {new Date(tenant.joined).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
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
                              {tenant.status === "Active" && (
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
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
      <SuspendTenantModal
        open={showSuspendModal}
        onOpenChange={setShowSuspendModal}
        tenant={selectedTenant}
      />
      <ViewTenantDetailsModal
        open={showViewDetails}
        onOpenChange={setShowViewDetails}
        tenant={selectedTenant}
      />
    </DashboardLayout>
  )
}

