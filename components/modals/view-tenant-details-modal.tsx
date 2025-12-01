"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Building2, Users, DollarSign, Calendar, Mail, Phone } from "lucide-react"

interface ViewTenantDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant?: any
}

export function ViewTenantDetailsModal({ open, onOpenChange, tenant }: ViewTenantDetailsModalProps) {
  if (!tenant) return null

  // Mock detailed data
  const tenantDetails = {
    ...tenant,
    phone: "+1 234-567-8900",
    address: "123 Main St, City, State 12345",
    taxId: "TAX-123456",
    registrationDate: tenant.joined,
    lastActivity: "2024-01-15T14:30:00",
    outlets: [
      { id: "1", name: "Main Outlet", location: "Downtown", status: "Active" },
      { id: "2", name: "Branch 1", location: "Uptown", status: "Active" },
    ],
    users: [
      { id: "1", name: "John Manager", email: "john@tenant.com", role: "Manager" },
      { id: "2", name: "Jane Staff", email: "jane@tenant.com", role: "Staff" },
    ],
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Tenant Details - {tenant.name}
          </DialogTitle>
          <DialogDescription>
            Complete information about this tenant
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Basic Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Business Name</p>
                <p className="font-medium">{tenantDetails.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  {tenantDetails.email}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  {tenantDetails.phone}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{tenantDetails.address}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Tax ID</p>
                <p className="font-medium">{tenantDetails.taxId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={tenantDetails.status === "Active" ? "default" : "destructive"}>
                  {tenantDetails.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Subscription Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Subscription</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Plan</p>
                <Badge variant="outline">{tenantDetails.plan}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Registration Date</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {new Date(tenantDetails.registrationDate).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Subscription End</p>
                <p className="font-medium">
                  {new Date(tenantDetails.subscriptionEnd).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="font-medium flex items-center gap-2">
                  <DollarSign className="h-3 w-3" />
                  ${tenantDetails.revenue.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Outlets */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Outlets</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantDetails.outlets.map((outlet: any) => (
                  <TableRow key={outlet.id}>
                    <TableCell className="font-medium">{outlet.name}</TableCell>
                    <TableCell>{outlet.location}</TableCell>
                    <TableCell>
                      <Badge variant={outlet.status === "Active" ? "default" : "secondary"}>
                        {outlet.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Users */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Users</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantDetails.users.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.role}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

