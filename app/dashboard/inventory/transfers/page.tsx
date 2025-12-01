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
import { Plus, ArrowRightLeft } from "lucide-react"
import { useState } from "react"
import { TransferStockModal } from "@/components/modals/transfer-stock-modal"

export default function TransfersPage() {
  const [showTransfer, setShowTransfer] = useState(false)

  // Mock transfers data
  const transfers = [
    { id: "1", date: "2024-01-15", product: "Product A", from: "Downtown Branch", to: "Mall Location", quantity: 10, status: "completed" },
    { id: "2", date: "2024-01-14", product: "Product B", from: "Mall Location", to: "Airport Kiosk", quantity: 5, status: "pending" },
    { id: "3", date: "2024-01-13", product: "Product C", from: "Airport Kiosk", to: "Downtown Branch", quantity: 8, status: "completed" },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Stock Transfers</h1>
            <p className="text-muted-foreground">Transfer inventory between outlets</p>
          </div>
          <Button onClick={() => setShowTransfer(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Transfer
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transfer History</CardTitle>
            <CardDescription>
              Track all stock transfers between outlets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell>{new Date(transfer.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{transfer.product}</TableCell>
                    <TableCell>{transfer.from}</TableCell>
                    <TableCell>{transfer.to}</TableCell>
                    <TableCell>{transfer.quantity}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        transfer.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {transfer.status}
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

      <TransferStockModal
        open={showTransfer}
        onOpenChange={setShowTransfer}
      />
    </DashboardLayout>
  )
}

