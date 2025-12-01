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
import { Plus, Search, ArrowLeft, DollarSign, Calendar } from "lucide-react"
import { useState } from "react"
import { NewReturnModal } from "@/components/modals/new-return-modal"
import { RefundConfirmationModal } from "@/components/modals/refund-confirmation-modal"

export default function ReturnsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showNewReturn, setShowNewReturn] = useState(false)
  const [showRefundConfirm, setShowRefundConfirm] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<any>(null)

  // Mock returns data
  const returns = [
    {
      id: "1",
      returnId: "RET-001",
      saleId: "#1001",
      customer: "John Doe",
      date: "2024-01-15",
      items: 2,
      amount: 89.99,
      reason: "Defective Product",
      status: "Completed",
      refundMethod: "Card",
    },
    {
      id: "2",
      returnId: "RET-002",
      saleId: "#1002",
      customer: "Jane Smith",
      date: "2024-01-14",
      items: 1,
      amount: 45.00,
      reason: "Wrong Item",
      status: "Pending",
      refundMethod: "Cash",
    },
    {
      id: "3",
      returnId: "RET-003",
      saleId: "#1003",
      customer: "Bob Johnson",
      date: "2024-01-13",
      items: 3,
      amount: 125.50,
      reason: "Customer Request",
      status: "Completed",
      refundMethod: "Store Credit",
    },
  ]

  const filteredReturns = returns.filter(ret =>
    ret.returnId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ret.saleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ret.customer.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalReturns = returns.length
  const totalAmount = returns.reduce((sum, r) => sum + r.amount, 0)
  const pendingReturns = returns.filter(r => r.status === "Pending").length

  const handleRefund = (returnItem: any) => {
    setSelectedReturn(returnItem)
    setShowRefundConfirm(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Returns & Refunds</h1>
            <p className="text-muted-foreground">Manage product returns and refunds</p>
          </div>
          <Button onClick={() => setShowNewReturn(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Return
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Returns</CardTitle>
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalReturns}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Refunded</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">MWK {totalAmount.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Returns</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingReturns}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by return ID, sale ID, or customer..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Returns Table */}
        <Card>
          <CardHeader>
            <CardTitle>Return History</CardTitle>
            <CardDescription>
              {filteredReturns.length} return{filteredReturns.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return ID</TableHead>
                  <TableHead>Sale ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReturns.map((returnItem) => (
                  <TableRow key={returnItem.id}>
                    <TableCell className="font-medium">{returnItem.returnId}</TableCell>
                    <TableCell>{returnItem.saleId}</TableCell>
                    <TableCell>{returnItem.customer}</TableCell>
                    <TableCell>
                      {new Date(returnItem.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{returnItem.items}</TableCell>
                    <TableCell className="font-semibold">
                      MWK {returnItem.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>{returnItem.reason}</TableCell>
                    <TableCell>
                      <Badge
                        variant={returnItem.status === "Completed" ? "default" : "secondary"}
                      >
                        {returnItem.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {returnItem.status === "Pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefund(returnItem)}
                        >
                          Process Refund
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <NewReturnModal
        open={showNewReturn}
        onOpenChange={setShowNewReturn}
      />
      <RefundConfirmationModal
        open={showRefundConfirm}
        onOpenChange={setShowRefundConfirm}
        returnItem={selectedReturn}
      />
    </DashboardLayout>
  )
}

