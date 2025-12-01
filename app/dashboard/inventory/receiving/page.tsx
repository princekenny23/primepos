"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
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
import { Plus, PackageCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export default function ReceivingPage() {
  // Mock receiving data
  const receiving = [
    { id: "1", date: "2024-01-15", supplier: "Supplier ABC", products: 5, total: 500.00, status: "received" },
    { id: "2", date: "2024-01-14", supplier: "Supplier XYZ", products: 3, total: 300.00, status: "pending" },
    { id: "3", date: "2024-01-13", supplier: "Supplier ABC", products: 8, total: 800.00, status: "received" },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Receiving</h1>
            <p className="text-muted-foreground">Manage incoming inventory from suppliers</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Receiving
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Receiving Orders</CardTitle>
            <CardDescription>
              Track incoming inventory shipments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search receiving orders..." className="pl-10" />
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiving.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{new Date(order.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{order.supplier}</TableCell>
                    <TableCell>{order.products} items</TableCell>
                    <TableCell>MWK {order.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        order.status === "received"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {order.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

