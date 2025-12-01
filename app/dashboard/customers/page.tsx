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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Search, Users, Mail, Phone, Award, Calendar, Edit, Trash2, Merge } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
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

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [pointsFilter, setPointsFilter] = useState<string>("all")
  const [outletFilter, setOutletFilter] = useState<string>("all")
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showLoyaltyAdjust, setShowLoyaltyAdjust] = useState(false)
  const [showMerge, setShowMerge] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null)

  // Mock customers data
  const customers = [
    { id: "1", name: "John Doe", email: "john@example.com", phone: "+1 (555) 111-1111", points: 1250, lastVisit: "2024-01-15", totalSpent: 4523.50, outlet: "Downtown Branch" },
    { id: "2", name: "Jane Smith", email: "jane@example.com", phone: "+1 (555) 222-2222", points: 890, lastVisit: "2024-01-14", totalSpent: 3210.75, outlet: "Mall Location" },
    { id: "3", name: "Bob Johnson", email: "bob@example.com", phone: "+1 (555) 333-3333", points: 2340, lastVisit: "2024-01-15", totalSpent: 6789.25, outlet: "Downtown Branch" },
    { id: "4", name: "Alice Williams", email: "alice@example.com", phone: "+1 (555) 444-4444", points: 450, lastVisit: "2024-01-10", totalSpent: 1234.00, outlet: "Airport Kiosk" },
    { id: "5", name: "Charlie Brown", email: "charlie@example.com", phone: "+1 (555) 555-5555", points: 1670, lastVisit: "2024-01-13", totalSpent: 5678.90, outlet: "Mall Location" },
  ]

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm)
    
    const matchesPoints = pointsFilter === "all" || 
      (pointsFilter === "high" && customer.points >= 1000) ||
      (pointsFilter === "medium" && customer.points >= 500 && customer.points < 1000) ||
      (pointsFilter === "low" && customer.points < 500)
    
    const matchesOutlet = outletFilter === "all" || customer.outlet === outletFilter

    return matchesSearch && matchesPoints && matchesOutlet
  })

  const outlets = ["Downtown Branch", "Mall Location", "Airport Kiosk"]

  const handleDelete = (customerId: string) => {
    setCustomerToDelete(customerId)
    setShowDelete(true)
  }

  const confirmDelete = () => {
    // In production, this would call API
    setShowDelete(false)
    setCustomerToDelete(null)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customers</h1>
            <p className="text-muted-foreground">Manage your customer relationships and loyalty programs</p>
          </div>
          <Button onClick={() => {
            setSelectedCustomer(null)
            setShowAddCustomer(true)
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customers.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Points</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {customers.reduce((sum, c) => sum + c.points, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                MWK {customers.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Points</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(customers.reduce((sum, c) => sum + c.points, 0) / customers.length)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={pointsFilter} onValueChange={setPointsFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Loyalty Points" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Points</SelectItem>
                  <SelectItem value="high">High (1000+)</SelectItem>
                  <SelectItem value="medium">Medium (500-999)</SelectItem>
                  <SelectItem value="low">Low (&lt;500)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={outletFilter} onValueChange={setOutletFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Outlet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outlets</SelectItem>
                  {outlets.map(outlet => (
                    <SelectItem key={outlet} value={outlet}>{outlet}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Customers</CardTitle>
            <CardDescription>
              {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Loyalty Points</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link 
                        href={`/dashboard/customers/${customer.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{customer.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{customer.phone}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-yellow-500" />
                        <span className="font-semibold">{customer.points.toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      MWK {customer.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(customer.lastVisit).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>{customer.outlet}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCustomer(customer)
                            setShowAddCustomer(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCustomer(customer)
                            setShowLoyaltyAdjust(true)
                          }}
                        >
                          <Award className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCustomer(customer)
                            setShowMerge(true)
                          }}
                        >
                          <Merge className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDelete(customer.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <AddEditCustomerModal
        open={showAddCustomer}
        onOpenChange={setShowAddCustomer}
        customer={selectedCustomer}
      />
      <LoyaltyPointsAdjustModal
        open={showLoyaltyAdjust}
        onOpenChange={setShowLoyaltyAdjust}
        customer={selectedCustomer}
      />
      <MergeCustomerModal
        open={showMerge}
        onOpenChange={setShowMerge}
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

