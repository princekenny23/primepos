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
import { Search, DollarSign, TrendingUp, CreditCard, Calendar } from "lucide-react"
import { useState } from "react"

export default function AdminBillingPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  // Mock billing data
  const billingRecords = [
    {
      id: "1",
      tenant: "ABC Restaurant",
      plan: "Professional",
      amount: 99.00,
      status: "Paid",
      date: "2024-01-15",
      invoice: "INV-001",
      paymentMethod: "Credit Card",
    },
    {
      id: "2",
      tenant: "XYZ Retail Store",
      plan: "Enterprise",
      amount: 299.00,
      status: "Paid",
      date: "2024-01-14",
      invoice: "INV-002",
      paymentMethod: "Bank Transfer",
    },
    {
      id: "3",
      tenant: "City Bar",
      plan: "Starter",
      amount: 49.00,
      status: "Pending",
      date: "2024-01-20",
      invoice: "INV-003",
      paymentMethod: "Credit Card",
    },
    {
      id: "4",
      tenant: "Pharma Plus",
      plan: "Professional",
      amount: 99.00,
      status: "Paid",
      date: "2024-01-13",
      invoice: "INV-004",
      paymentMethod: "Credit Card",
    },
  ]

  const filteredRecords = billingRecords.filter(record => {
    const matchesSearch = 
      record.tenant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.invoice.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "paid" && record.status === "Paid") ||
      (activeTab === "pending" && record.status === "Pending")

    return matchesSearch && matchesTab
  })

  const totalRevenue = billingRecords.filter(r => r.status === "Paid").reduce((sum, r) => sum + r.amount, 0)
  const pendingAmount = billingRecords.filter(r => r.status === "Pending").reduce((sum, r) => sum + r.amount, 0)
  const paidCount = billingRecords.filter(r => r.status === "Paid").length

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
      case "Pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
      case "Failed":
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
            <h1 className="text-3xl font-bold">Billing Management</h1>
            <p className="text-muted-foreground">Manage tenant subscriptions and payments</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">MWK {totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">MWK {pendingAmount.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
              <CreditCard className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{paidCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{billingRecords.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tenant name or invoice number..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Billing Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Billing Records</CardTitle>
            <CardDescription>
              {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.invoice}</TableCell>
                        <TableCell>{record.tenant}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{record.plan}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          MWK {record.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(record.status)}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.paymentMethod}</TableCell>
                        <TableCell>
                          {new Date(record.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">View</Button>
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
    </DashboardLayout>
  )
}

