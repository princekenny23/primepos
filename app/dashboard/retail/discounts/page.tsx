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
import { Plus, Search, Percent, Calendar, Tag } from "lucide-react"
import { useState } from "react"
import { CreateDiscountModal } from "@/components/modals/create-discount-modal"

export default function DiscountsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showCreateDiscount, setShowCreateDiscount] = useState(false)
  const [activeTab, setActiveTab] = useState("active")

  // Mock discounts data
  const discounts = [
    {
      id: "1",
      code: "SAVE20",
      name: "20% Off Sale",
      type: "Percentage",
      value: 20,
      minPurchase: 50,
      maxDiscount: 100,
      usage: 45,
      limit: 100,
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      status: "Active",
    },
    {
      id: "2",
      code: "WELCOME10",
      name: "Welcome Discount",
      type: "Percentage",
      value: 10,
      minPurchase: 0,
      maxDiscount: 50,
      usage: 100,
      limit: 100,
      startDate: "2024-01-10",
      endDate: "2024-02-10",
      status: "Active",
    },
    {
      id: "3",
      code: "FLASH50",
      name: "Flash Sale",
      type: "Percentage",
      value: 50,
      minPurchase: 100,
      maxDiscount: 200,
      usage: 0,
      limit: 50,
      startDate: "2024-02-01",
      endDate: "2024-02-05",
      status: "Upcoming",
    },
    {
      id: "4",
      code: "HOLIDAY15",
      name: "Holiday Special",
      type: "Percentage",
      value: 15,
      minPurchase: 25,
      maxDiscount: 75,
      usage: 200,
      limit: 200,
      startDate: "2023-12-01",
      endDate: "2023-12-31",
      status: "Expired",
    },
  ]

  const filteredDiscounts = discounts.filter(discount => {
    const matchesSearch = 
      discount.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      discount.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesTab = 
      activeTab === "active" && discount.status === "Active" ||
      activeTab === "upcoming" && discount.status === "Upcoming" ||
      activeTab === "expired" && discount.status === "Expired" ||
      activeTab === "all"

    return matchesSearch && matchesTab
  })

  const activeCount = discounts.filter(d => d.status === "Active").length
  const expiredCount = discounts.filter(d => d.status === "Expired").length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Discounts & Promotions</h1>
            <p className="text-muted-foreground">Manage discount codes and promotional offers</p>
          </div>
          <Button onClick={() => setShowCreateDiscount(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Discount
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Discounts</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Discounts</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{discounts.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expired</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expiredCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code or name..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Discounts Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Discounts</CardTitle>
            <CardDescription>
              Manage your discount codes and promotional offers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="expired">Expired</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Min Purchase</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDiscounts.map((discount) => (
                      <TableRow key={discount.id}>
                        <TableCell className="font-medium font-mono">
                          {discount.code}
                        </TableCell>
                        <TableCell>{discount.name}</TableCell>
                        <TableCell>{discount.type}</TableCell>
                        <TableCell className="font-semibold">
                          {discount.value}%
                        </TableCell>
                        <TableCell>MWK {discount.minPurchase}</TableCell>
                        <TableCell>
                          {discount.usage} / {discount.limit === 0 ? "∞" : discount.limit}
                        </TableCell>
                        <TableCell>
                          {new Date(discount.endDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              discount.status === "Active" ? "default" :
                              discount.status === "Upcoming" ? "secondary" :
                              "outline"
                            }
                          >
                            {discount.status}
                          </Badge>
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
      <CreateDiscountModal
        open={showCreateDiscount}
        onOpenChange={setShowCreateDiscount}
      />
    </DashboardLayout>
  )
}

