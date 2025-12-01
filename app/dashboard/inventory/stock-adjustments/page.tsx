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
import { Plus, ArrowUpDown } from "lucide-react"
import { useState } from "react"
import { StockAdjustmentModal } from "@/components/modals/stock-adjustment-modal"

export default function StockAdjustmentsPage() {
  const [showAdjustment, setShowAdjustment] = useState(false)

  // Mock adjustments data
  const adjustments = [
    { id: "1", date: "2024-01-15", product: "Product A", reason: "Damaged", quantity: -5, user: "John Doe" },
    { id: "2", date: "2024-01-14", product: "Product B", reason: "Found", quantity: 3, user: "Jane Smith" },
    { id: "3", date: "2024-01-13", product: "Product C", reason: "Theft", quantity: -2, user: "Admin" },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Stock Adjustments</h1>
            <p className="text-muted-foreground">Adjust inventory levels manually</p>
          </div>
          <Button onClick={() => setShowAdjustment(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Adjustment
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Adjustment History</CardTitle>
            <CardDescription>
              Track all manual stock adjustments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((adjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell>{new Date(adjustment.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{adjustment.product}</TableCell>
                    <TableCell>{adjustment.reason}</TableCell>
                    <TableCell className={adjustment.quantity > 0 ? "text-green-600" : "text-red-600"}>
                      {adjustment.quantity > 0 ? "+" : ""}{adjustment.quantity}
                    </TableCell>
                    <TableCell>{adjustment.user}</TableCell>
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

      <StockAdjustmentModal
        open={showAdjustment}
        onOpenChange={setShowAdjustment}
      />
    </DashboardLayout>
  )
}

