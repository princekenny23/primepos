"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, MapPin } from "lucide-react"
import { useState } from "react"
import { AddEditOutletModal } from "@/components/modals/add-edit-outlet-modal"

export function OutletManagementTab() {
  const [showAddOutlet, setShowAddOutlet] = useState(false)
  const [selectedOutlet, setSelectedOutlet] = useState<any>(null)

  // Mock outlets
  const outlets = [
    { id: "1", name: "Downtown Branch", address: "123 Main St", phone: "+1 (555) 111-1111", status: "Active" },
    { id: "2", name: "Mall Location", address: "456 Oak Ave", phone: "+1 (555) 222-2222", status: "Active" },
    { id: "3", name: "Airport Kiosk", address: "789 Airport Rd", phone: "+1 (555) 333-3333", status: "Inactive" },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Outlet Management</CardTitle>
            <CardDescription>Manage your business outlets and branches</CardDescription>
          </div>
          <Button onClick={() => {
            setSelectedOutlet(null)
            setShowAddOutlet(true)
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Outlet
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {outlets.map((outlet) => (
              <TableRow key={outlet.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {outlet.name}
                  </div>
                </TableCell>
                <TableCell>{outlet.address}</TableCell>
                <TableCell>{outlet.phone}</TableCell>
                <TableCell>
                  <Badge variant={outlet.status === "Active" ? "default" : "secondary"}>
                    {outlet.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedOutlet(outlet)
                      setShowAddOutlet(true)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <AddEditOutletModal
        open={showAddOutlet}
        onOpenChange={setShowAddOutlet}
        outlet={selectedOutlet}
      />
    </Card>
  )
}

