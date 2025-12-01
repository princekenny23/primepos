"use client"

import { useTenant } from "@/contexts/tenant-context"
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
import { MapPin, Phone, Mail, Edit, Trash2, Settings, BarChart3, Store } from "lucide-react"
import Link from "next/link"

export function OutletList() {
  const { outlets, currentOutlet, switchOutlet } = useTenant()

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Outlets</CardTitle>
        <CardDescription>View and manage all your business outlets</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Outlet Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {outlets.map((outlet) => (
              <TableRow key={outlet.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium">{outlet.name}</div>
                      {currentOutlet?.id === outlet.id && (
                        <span className="text-xs text-primary">Current</span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {outlet.address}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {outlet.phone}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {outlet.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      outlet.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {outlet.isActive ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {currentOutlet?.id !== outlet.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => switchOutlet(outlet.id)}
                      >
                        Switch
                      </Button>
                    )}
                    <Link href={`/dashboard/outlets/${outlet.id}/settings`}>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/dashboard/outlets/${outlet.id}/analytics`}>
                      <Button variant="ghost" size="sm">
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive">
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
  )
}

